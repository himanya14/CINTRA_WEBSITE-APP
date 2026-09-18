import Constants from 'expo-constants';
import { getAccessToken } from './sessionStore';

const PORT = 8000;

function cleanUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function expoHostIp() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.developer?.manifest?.debuggerHost ||
    '';

  const clean = String(hostUri)
    .replace(/^exp:\/\//i, '')
    .replace(/^https?:\/\//i, '')
    .split('/')[0];

  if (!clean) return '';

  // Expo hostUri is normally LAPTOP_IP:8081. The backend runs on :8000.
  return clean.split(':')[0];
}

function candidateBaseUrls() {
  const configured = cleanUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  const expoIp = expoHostIp();
  const candidates = [];

  // Prefer the current Expo LAN host because college/home Wi-Fi can change the
  // laptop IPv4 address between runs. The .env address remains a fallback.
  if (expoIp) candidates.push(`http://${expoIp}:${PORT}`);
  if (configured) candidates.push(configured);
  candidates.push(`http://127.0.0.1:${PORT}`);

  return [...new Set(candidates.filter(Boolean))];
}

export let BASE_URL = candidateBaseUrls()[0] || `http://127.0.0.1:${PORT}`;
let resolvedBasePromise = null;

async function ping(baseUrl, timeoutMs = 4500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Resolve the backend on the CURRENT network rather than blindly trusting an
 * old .env IP. This is important for Expo Go when the laptop Wi-Fi address
 * changes. Both the mobile app and website still use the same FastAPI backend.
 */
export async function resolveBaseUrl(force = false) {
  if (!force && resolvedBasePromise) return resolvedBasePromise;

  resolvedBasePromise = (async () => {
    const candidates = candidateBaseUrls();
    for (const candidate of candidates) {
      if (await ping(candidate)) {
        BASE_URL = candidate;
        console.log('[CINTRA API] Connected backend:', BASE_URL);
        return BASE_URL;
      }
    }

    resolvedBasePromise = null;
    throw new Error(
      `Cannot reach CINTRA backend. Tried: ${candidates.join(', ')}. ` +
      'Keep FastAPI running on 0.0.0.0:8000 and start Expo with --lan.'
    );
  })();

  return resolvedBasePromise;
}

const DEFAULT_HEADERS = {
  Accept: 'application/json',
};

function authHeaders(extra = {}) {
  const token = getAccessToken();
  return {
    ...DEFAULT_HEADERS,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

let localScanCount = 0;

export function getGlobalScanCount() {
  return localScanCount;
}

export function incrementGlobalScanCount() {
  localScanCount += 1;
  return localScanCount;
}

export function resetGlobalScanCount() {
  localScanCount = 0;
  return localScanCount;
}

function makeImageFormData(imageUri) {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    name: 'scan.jpg',
    type: 'image/jpeg',
  });
  return formData;
}

/**
 * Sends a captured image to the central CINTRA backend for face matching.
 * SFace enrollment can take longer on the first request, so the old 12-second
 * abort has been replaced by a 60-second field-scan timeout.
 */
export async function identifyFace(imageUri) {
  if (!imageUri) throw new Error('No image was provided.');

  const baseUrl = await resolveBaseUrl();
  const targetUrl = `${baseUrl}/api/v1/identify`;
  let response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      body: makeImageFormData(imageUri),
      headers: authHeaders(),
      signal: controller.signal,
    });
  } catch (error) {
    resolvedBasePromise = null;
    const message = error?.name === 'AbortError'
      ? 'Face matching exceeded 60 seconds.'
      : error?.message || 'Network request failed';
    throw new Error(`Cannot connect to CINTRA face service at ${targetUrl}: ${message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    throw new Error(data?.detail || `Face identification failed (${response.status}).`);
  }
  return data;
}

export async function searchSuspect(suspectCode) {
  if (!suspectCode) throw new Error('Person ID or name is required.');

  const baseUrl = await resolveBaseUrl();
  const targetUrl = `${baseUrl}/api/v1/suspects/${encodeURIComponent(suspectCode.trim())}`;
  console.log('[CINTRA API] Fetching person:', targetUrl);

  let response;
  try {
    response = await fetch(targetUrl, { headers: authHeaders() });
  } catch (netErr) {
    resolvedBasePromise = null;
    console.error('[CINTRA API] Person search error:', netErr);
    throw new Error(`Cannot connect to server at ${targetUrl}`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Person '${suspectCode}' was not found in the central database.`);
    }
    throw new Error(`Search failed with status ${response.status}`);
  }

  return await response.json();
}

function makeEvidenceFormData(fileUri, fileName, mimeType, evidenceType, options) {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName || 'evidence_file',
    type: mimeType || 'application/octet-stream',
  });
  formData.append('type', evidenceType);
  formData.append('case_id', String(options.caseId));
  if (options.personId) formData.append('person_id', String(options.personId));
  if (options.title) formData.append('title', options.title);
  if (options.description) formData.append('description', options.description);
  formData.append('source', options.source || 'CINTRA Mobile Field App');
  formData.append('relationship_type', options.relationshipType || 'SUPPORTED_BY_EVIDENCE');
  return formData;
}

export async function uploadEvidence(
  fileUri,
  fileName,
  mimeType,
  evidenceType = 'Evidence',
  options = {}
) {
  if (!fileUri) throw new Error('No file selected for upload.');
  if (!options.caseId) throw new Error('Select a case before uploading evidence.');

  const baseUrl = await resolveBaseUrl();
  const targetUrl = `${baseUrl}/api/v1/evidence/upload`;
  let response;

  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      body: makeEvidenceFormData(fileUri, fileName, mimeType, evidenceType, options),
      headers: authHeaders(),
    });
  } catch (netErr) {
    resolvedBasePromise = null;
    console.error('[CINTRA API] Evidence upload error:', netErr);
    throw new Error(`Cannot connect to evidence server at ${targetUrl}`);
  }

  if (!response.ok) {
    let errorMessage = `Upload failed with status ${response.status}.`;
    try {
      const errorData = await response.json();
      if (errorData.detail) errorMessage = errorData.detail;
    } catch {}
    throw new Error(errorMessage);
  }

  return await response.json();
}

export async function listCases() {
  const baseUrl = await resolveBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/cases`, { headers: authHeaders() });
  if (!response.ok) throw new Error(`Unable to load cases (${response.status}).`);
  return await response.json();
}

export async function listCasePersons(caseId) {
  if (!caseId) return [];
  const baseUrl = await resolveBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/cases/${encodeURIComponent(caseId)}/persons`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`Unable to load case persons (${response.status}).`);
  return await response.json();
}

export async function checkBackendHealth() {
  const baseUrl = await resolveBaseUrl(true);
  const response = await fetch(`${baseUrl}/api/v1/health`, { headers: authHeaders() });
  if (!response.ok) throw new Error(`Backend health check failed with status ${response.status}.`);
  return await response.json();
}
