const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";


// ============================================================
// STORAGE HELPERS
// ============================================================

function getStorage() {
  if (
    localStorage.getItem("cintra_access_token") ||
    localStorage.getItem("cintra_token")
  ) {
    return localStorage;
  }

  if (
    sessionStorage.getItem("cintra_access_token") ||
    sessionStorage.getItem("cintra_token")
  ) {
    return sessionStorage;
  }

  return null;
}


function getSessionStorageTarget() {
  return getStorage() || sessionStorage;
}


// ============================================================
// RESPONSE PARSER
// ============================================================

async function parseResponse(response) {
  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(
      data?.detail ||
        data?.message ||
        `Request failed (${response.status})`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}


// ============================================================
// LOGIN
// ============================================================

export async function loginOfficer(
  officerId,
  password
) {
  const response = await fetch(
    `${API_BASE_URL}/auth/login`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        officer_id: officerId.trim(),
        password,
      }),
    }
  );

  return parseResponse(response);
}


// ============================================================
// MFA
// ============================================================

export async function verifyMFA(
  challengeToken,
  code,
  deviceId
) {
  const response = await fetch(
    `${API_BASE_URL}/auth/verify-mfa`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        challenge_token: challengeToken,
        code: code.trim(),
        device_id: deviceId,
      }),
    }
  );

  return parseResponse(response);
}


// ============================================================
// SAVE SESSION
// ============================================================

export function saveSession(
  data,
  rememberMe = false
) {
  clearSession();

  const storage = rememberMe
    ? localStorage
    : sessionStorage;

  if (data?.access_token) {
    storage.setItem(
      "cintra_access_token",
      data.access_token
    );

    /*
     * Legacy compatibility.
     */
    storage.setItem(
      "cintra_token",
      data.access_token
    );
  }

  if (data?.refresh_token) {
    storage.setItem(
      "cintra_refresh_token",
      data.refresh_token
    );
  }

  if (data?.officer) {
    storage.setItem(
      "cintra_officer",
      JSON.stringify(data.officer)
    );
  }
}


// ============================================================
// ACCESS TOKEN
// ============================================================

export function getAccessToken() {
  return (
    localStorage.getItem(
      "cintra_access_token"
    ) ||
    sessionStorage.getItem(
      "cintra_access_token"
    ) ||
    localStorage.getItem(
      "cintra_token"
    ) ||
    sessionStorage.getItem(
      "cintra_token"
    )
  );
}


// ============================================================
// REFRESH TOKEN
// ============================================================

export function getRefreshToken() {
  return (
    localStorage.getItem(
      "cintra_refresh_token"
    ) ||
    sessionStorage.getItem(
      "cintra_refresh_token"
    )
  );
}


// ============================================================
// OFFICER
// ============================================================

export function getOfficer() {
  const value =
    localStorage.getItem(
      "cintra_officer"
    ) ||
    sessionStorage.getItem(
      "cintra_officer"
    );

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}


// ============================================================
// UPDATE ACCESS TOKEN
// ============================================================

function updateAccessToken(
  accessToken,
  refreshToken = null
) {
  if (!accessToken) {
    return;
  }

  const storage =
    getSessionStorageTarget();

  storage.setItem(
    "cintra_access_token",
    accessToken
  );

  /*
   * Keep old key synchronized because some older CINTRA
   * services may still read cintra_token.
   */
  storage.setItem(
    "cintra_token",
    accessToken
  );

  if (refreshToken) {
    storage.setItem(
      "cintra_refresh_token",
      refreshToken
    );
  }
}


// ============================================================
// CLEAR SESSION
// ============================================================

export function clearSession() {
  const keys = [
    "cintra_access_token",
    "cintra_refresh_token",
    "cintra_token",
    "cintra_officer",
  ];

  keys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}


// ============================================================
// REFRESH LOCK
//
// If several requests receive 401 simultaneously, CINTRA
// should make ONE refresh request instead of every API call
// trying to refresh independently.
// ============================================================

let refreshPromise = null;


// ============================================================
// REFRESH ACCESS TOKEN
// ============================================================

async function refreshAccessToken() {
  const refreshToken =
    getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/refresh`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            refresh_token:
              refreshToken,
          }),
        }
      );

      if (!response.ok) {
        return null;
      }

      let data = {};

      try {
        data =
          await response.json();
      } catch {
        return null;
      }

      const newAccessToken =
        data?.access_token;

      if (!newAccessToken) {
        return null;
      }

      updateAccessToken(
        newAccessToken,
        data?.refresh_token || null
      );

      return newAccessToken;
    } catch (error) {
      console.error(
        "CINTRA token refresh failed:",
        error
      );

      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}


// ============================================================
// AUTHENTICATED FETCH
// ============================================================

export async function authenticatedFetch(
  path,
  options = {}
) {
  const makeRequest =
    async (token) => {
      const headers =
        new Headers(
          options.headers || {}
        );

      /*
       * Do NOT automatically set JSON content type for
       * FormData uploads. Browser must create the multipart
       * boundary itself.
       */
      if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has("Content-Type")
      ) {
        headers.set(
          "Content-Type",
          "application/json"
        );
      }

      if (token) {
        headers.set(
          "Authorization",
          `Bearer ${token}`
        );
      }

      return fetch(
        `${API_BASE_URL}${path}`,
        {
          ...options,
          headers,
        }
      );
    };


  // --------------------------------------------------------
  // FIRST REQUEST
  // --------------------------------------------------------

  let token =
    getAccessToken();

  let response =
    await makeRequest(token);


  // --------------------------------------------------------
  // SUCCESS / NON-AUTH ERROR
  // --------------------------------------------------------

  if (response.status !== 401) {
    return response;
  }


  // --------------------------------------------------------
  // ACCESS TOKEN EXPIRED
  //
  // Do NOT immediately clear the session.
  // First attempt to use the refresh token.
  // --------------------------------------------------------

  const newAccessToken =
    await refreshAccessToken();


  // --------------------------------------------------------
  // REFRESH FAILED
  // --------------------------------------------------------

  if (!newAccessToken) {
    clearSession();

    return response;
  }


  // --------------------------------------------------------
  // RETRY ORIGINAL REQUEST
  // --------------------------------------------------------

  response =
    await makeRequest(
      newAccessToken
    );


  // --------------------------------------------------------
  // STILL UNAUTHORIZED
  //
  // At this point the session really is invalid.
  // --------------------------------------------------------

  if (response.status === 401) {
    clearSession();
  }


  return response;
}


// ============================================================
// CURRENT OFFICER
// ============================================================

export async function fetchCurrentOfficer() {
  const response =
    await authenticatedFetch(
      "/auth/me"
    );

  return parseResponse(response);
}


// ============================================================
// LOGOUT
// ============================================================

export async function logoutOfficer() {
  try {
    const response =
      await authenticatedFetch(
        "/auth/logout",
        {
          method: "POST",
        }
      );

    if (
      response.ok ||
      response.status === 401
    ) {
      clearSession();
      return;
    }

    await parseResponse(response);
  } finally {
    clearSession();
  }
}


// ============================================================
// LOGOUT ALL SESSIONS
// ============================================================

export async function logoutAllSessions() {
  try {
    const response =
      await authenticatedFetch(
        "/auth/logout-all",
        {
          method: "POST",
        }
      );

    if (
      response.ok ||
      response.status === 401
    ) {
      clearSession();
      return;
    }

    await parseResponse(response);
  } finally {
    clearSession();
  }
}


// ============================================================
// EXPORT API URL
// ============================================================

export {
  API_BASE_URL,
};