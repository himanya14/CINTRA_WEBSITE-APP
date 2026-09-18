import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
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

function safeExtension(fileName, fallback = '.bin') {
  const match = String(fileName || '').match(/(\.[A-Za-z0-9]{1,8})$/);
  return match ? match[1] : fallback;
}

async function ensureUploadableFileUri(uri, preferredName = 'upload.bin') {
  const value = String(uri || '').trim();
  if (!value) throw new Error('No local file URI was provided.');

  // expo-file-system native uploads require file:// on Android. Camera output
  // normally already uses file://, while gallery/document pickers may return
  // content:// URIs. Copy those into the app cache before upload.
  if (value.startsWith('file://')) return value;

  const ext = safeExtension(preferredName);
  const destination = `${FileSystem.cacheDirectory}cintra-upload-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}${ext}`;

  await FileSystem.copyAsync({ from: value, to: destination });
  return destination;
}

function parseUploadBody(result) {
  const raw = String(result?.body || '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { detail: raw };
  }
}

async function nativeMultipartUpload(
  url,
  fileUri,
  { fieldName, fileName, mimeType, parameters = {} }
) {
  const uploadUri = await ensureUploadableFileUri(fileUri, fileName);
  const token = getAccessToken();

  const result = await FileSystem.uploadAsync(url, uploadUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName,
    mimeType: mimeType || 'application/octet-stream',
    parameters: Object.fromEntries(
      Object.entries(parameters)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, String(value)])
    ),
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = parseUploadBody(result);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(data?.detail || `Upload failed (${result.status}).`);
  }
  return data;
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

  try {
    const data = await nativeMultipartUpload(targetUrl, imageUri, {
      fieldName: 'image',
      fileName: 'scan.jpg',
      mimeType: 'image/jpeg',
    });
    console.log('[CINTRA Scanner] Face request reached backend successfully.');
    return data;
  } catch (error) {
    resolvedBasePromise = null;
    throw new Error(
      `Cannot upload face scan to ${targetUrl}: ${error?.message || 'Upload failed'}`
    );
  }
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

  try {
    const data = await nativeMultipartUpload(targetUrl, fileUri, {
      fieldName: 'file',
      fileName: fileName || 'evidence_file.bin',
      mimeType: mimeType || 'application/octet-stream',
      parameters: {
        type: evidenceType,
        case_id: options.caseId,
        person_id: options.personId,
        title: options.title,
        description: options.description,
        source: options.source || 'CINTRA Mobile Field App',
        relationship_type: options.relationshipType || 'SUPPORTED_BY_EVIDENCE',
      },
    });
    console.log('[CINTRA API] Evidence upload reached backend successfully.');
    return data;
  } catch (netErr) {
    resolvedBasePromise = null;
    console.error('[CINTRA API] Evidence upload error:', netErr);
    throw new Error(
      `Cannot upload evidence to ${targetUrl}: ${netErr?.message || 'Upload failed'}`
    );
  }
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
