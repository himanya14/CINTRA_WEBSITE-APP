import { authenticatedFetch } from "./api";

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
        `Request failed (${response.status})`
    );
  }

  return data;
}

export async function getOfficers() {
  const response = await authenticatedFetch(
    "/admin/officers"
  );

  return parseResponse(response);
}

export async function createOfficer(payload) {
  const response = await authenticatedFetch(
    "/admin/officers",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return parseResponse(response);
}

export async function updateOfficerRole(
  officerId,
  systemRole
) {
  const response = await authenticatedFetch(
    `/admin/officers/${encodeURIComponent(
      officerId
    )}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({
        system_role: systemRole,
      }),
    }
  );

  return parseResponse(response);
}

export async function updateOfficerStatus(
  officerId,
  active
) {
  const response = await authenticatedFetch(
    `/admin/officers/${encodeURIComponent(
      officerId
    )}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        active,
      }),
    }
  );

  return parseResponse(response);
}

export async function resetOfficerMFA(officerId) {
  const response = await authenticatedFetch(
    `/admin/officers/${encodeURIComponent(
      officerId
    )}/reset-mfa`,
    {
      method: "POST",
    }
  );

  return parseResponse(response);
}

export async function getOfficerSessions(officerId) {
  const response = await authenticatedFetch(
    `/admin/officers/${encodeURIComponent(
      officerId
    )}/sessions`
  );

  return parseResponse(response);
}

export async function revokeOfficerSessions(officerId) {
  const response = await authenticatedFetch(
    `/admin/officers/${encodeURIComponent(
      officerId
    )}/revoke-sessions`,
    {
      method: "POST",
    }
  );

  return parseResponse(response);
}

export async function getAuditLogs(limit = 100) {
  const response = await authenticatedFetch(
    `/admin/audit-logs?limit=${limit}`
  );

  return parseResponse(response);
}

export async function getDevices() {
  const response = await authenticatedFetch(
    "/admin/devices"
  );

  return parseResponse(response);
}

export async function registerDevice(payload) {
  const response = await authenticatedFetch(
    "/admin/devices",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return parseResponse(response);
}

export async function updateDeviceApproval(
  deviceId,
  approved
) {
  const response = await authenticatedFetch(
    `/admin/devices/${encodeURIComponent(
      deviceId
    )}/approval`,
    {
      method: "PATCH",
      body: JSON.stringify({
        approved,
      }),
    }
  );

  return parseResponse(response);
}