let accessToken = null;
let refreshToken = null;
let currentOfficer = null;

export function setSession(data) {
  accessToken = data?.access_token || null;
  refreshToken = data?.refresh_token || null;

  const officer = data?.officer || null;
  currentOfficer = officer
    ? {
        ...officer,
        // Keep compatibility with existing mobile screens/components.
        badgeId: officer.officer_id,
      }
    : null;
}

export function clearSession() {
  accessToken = null;
  refreshToken = null;
  currentOfficer = null;
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export function getOfficer() {
  return currentOfficer;
}

export function hasSession() {
  return Boolean(accessToken && currentOfficer);
}
