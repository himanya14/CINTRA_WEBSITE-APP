import { Platform } from 'react-native';
import { BASE_URL } from './api';
import {
  clearSession,
  getAccessToken,
  getOfficer,
  hasSession,
  setSession,
} from './sessionStore';

async function parseResponse(response) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        `Authentication failed (${response.status}).`
    );
  }
  return data;
}

export function getDeviceId() {
  return `CINTRA-MOBILE-${Platform.OS}`;
}

/**
 * Password stage. This is the exact same /auth/login flow used by the web app.
 * It normally returns an MFA challenge for website officers such as SH-001.
 */
export async function login(officerId, password) {
  const cleanOfficerId = String(officerId || '').trim();
  if (!cleanOfficerId || !password) {
    throw new Error('Enter your Officer ID and password.');
  }

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      officer_id: cleanOfficerId,
      password,
    }),
  });

  const data = await parseResponse(response);

  // Kept for compatibility if an administrator ever disables MFA on a
  // development account. The real website flow returns requires_mfa=true.
  if (data?.access_token && data?.officer) {
    setSession(data);
  }

  return data;
}

export async function verifyMFA(challengeToken, code) {
  const cleanCode = String(code || '').replace(/\s/g, '');
  if (!challengeToken) {
    throw new Error('Authenticator challenge is missing. Sign in again.');
  }
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('Enter the 6-digit code from your authenticator app.');
  }

  const response = await fetch(`${BASE_URL}/auth/verify-mfa`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      challenge_token: challengeToken,
      code: cleanCode,
      device_id: getDeviceId(),
    }),
  });

  const data = await parseResponse(response);
  if (!data?.access_token || !data?.officer) {
    throw new Error('The CINTRA backend did not return an authenticated session.');
  }

  setSession(data);
  return data;
}

export function logout() {
  clearSession();
}

export function isAuthenticated() {
  return hasSession();
}

// Existing App.js calls this for activity tracking. Server-side session/JWT
// validity is authoritative, matching the website.
export function updateActivity() {}

export function getCurrentUser() {
  return getOfficer();
}

export function getToken() {
  return getAccessToken();
}

export function getRemainingSessionTime() {
  return isAuthenticated() ? Number.POSITIVE_INFINITY : 0;
}
