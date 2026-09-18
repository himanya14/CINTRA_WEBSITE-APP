import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAccessToken } from './sessionStore';

const PORT = 8000;

const getBaseUrl = () => {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.developer?.manifest?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) {
      return `http://${ip}:${PORT}`;
    }
  }

  return `http://127.0.0.1:${PORT}`;
};

export const BASE_URL = getBaseUrl();

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

/**
 * Sends a captured image to the central CINTRA backend for face matching.
 * No deterministic/mobile-only fallback is used.
 */
export async function identifyFace(imageUri) {
  if (!imageUri) {
    throw new Error('No image was provided.');
  }

  const targetUrl = `${BASE_URL}/api/v1/identify`;
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    name: 'scan.jpg',
    type: 'image/jpeg',
  });

  let response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    response = await fetch(targetUrl, {
      method: 'POST',
      body: formData,
      headers: authHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (error) {
    throw new Error(`Cannot connect to CINTRA face service at ${targetUrl}: ${error.message}`);
  }

  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    throw new Error(data?.detail || `Face identification failed (${response.status}).`);
  }
  return data;
}

/**
 * Fetches suspect details by suspect_code / criminal_id
 * GET /api/v1/suspects/{suspectCode}
 */
export async function searchSuspect(suspectCode) {
  if (!suspectCode) {
    throw new Error('Suspect ID is required.');
  }

  const targetUrl = `${BASE_URL}/api/v1/suspects/${encodeURIComponent(suspectCode.trim())}`;
  console.log('[CINTRA API] Fetching suspect:', targetUrl);

  let response;
  try {
    response = await fetch(targetUrl, {
      headers: authHeaders(),
    });
  } catch (netErr) {
    console.error('[CINTRA API] Suspect search error:', netErr);
    throw new Error(`Cannot connect to server at ${targetUrl}`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Suspect ID '${suspectCode}' was not found in the database.`);
    }
    throw new Error(`Search failed with status ${response.status}`);
  }

  return await response.json();
}

/**
 * Uploads evidence (image, video, audio, document) to backend
 * POST /api/v1/evidence/upload
 */
export async function uploadEvidence(
  fileUri,
  fileName,
  mimeType,
  evidenceType = 'Evidence',
  options = {}
) {
  if (!fileUri) {
    throw new Error('No file selected for upload.');
  }

  const targetUrl = `${BASE_URL}/api/v1/evidence/upload`;

  const formData = new FormData();

  formData.append('file', {
    uri: fileUri,
    name: fileName || 'evidence_file',
    type: mimeType || 'application/octet-stream',
  });

  formData.append('type', evidenceType);
  if (!options.caseId) {
    throw new Error('Select a case before uploading evidence.');
  }
  formData.append('case_id', String(options.caseId));
  if (options.personId) {
    formData.append('person_id', String(options.personId));
  }
  if (options.title) {
    formData.append('title', options.title);
  }
  if (options.description) {
    formData.append('description', options.description);
  }
  formData.append('source', options.source || 'CINTRA Mobile Field App');
  formData.append('relationship_type', options.relationshipType || 'SUPPORTED_BY_EVIDENCE');

  let response;
  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      body: formData,
      headers: authHeaders(),
    });
  } catch (netErr) {
    console.error('[CINTRA API] Evidence upload error:', netErr);
    throw new Error(`Cannot connect to evidence server at ${targetUrl}`);
  }

  if (!response.ok) {
    let errorMessage = `Upload failed with status ${response.status}.`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = errorData.detail;
      }
    } catch (error) {}
    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * List central investigation cases available to the mobile field app.
 */
export async function listCases() {
  const response = await fetch(`${BASE_URL}/api/v1/cases`, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(`Unable to load cases (${response.status}).`);
  }
  return await response.json();
}

/**
 * List persons already linked to one central case.
 */
export async function listCasePersons(caseId) {
  if (!caseId) return [];
  const response = await fetch(`${BASE_URL}/api/v1/cases/${encodeURIComponent(caseId)}/persons`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Unable to load case persons (${response.status}).`);
  }
  return await response.json();
}

/**
 * Optional health-check function.
 */
export async function checkBackendHealth() {
  const response = await fetch(`${BASE_URL}/api/v1/health`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Backend health check failed with status ${response.status}.`);
  }
  return await response.json();
}

