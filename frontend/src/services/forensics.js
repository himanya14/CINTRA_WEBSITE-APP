import { authenticatedFetch } from "./api.js";

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


// ============================================================
// FORENSIC OVERVIEW
// ============================================================

export async function getForensicOverview() {
  const response = await authenticatedFetch(
    "/forensics/overview"
  );

  return parseResponse(response);
}


// ============================================================
// MY ASSIGNMENTS
// ============================================================

export async function getMyForensicAssignments() {
  const response = await authenticatedFetch(
    "/forensics/assignments/me"
  );

  return parseResponse(response);
}


// ============================================================
// SINGLE ASSIGNMENT
// ============================================================

export async function getForensicAssignment(
  assignmentId
) {
  const response = await authenticatedFetch(
    `/forensics/assignments/${encodeURIComponent(
      assignmentId
    )}`
  );

  return parseResponse(response);
}


// ============================================================
// UPDATE ASSIGNMENT STATUS
// ============================================================

export async function updateForensicAssignmentStatus(
  assignmentId,
  status
) {
  const response = await authenticatedFetch(
    `/forensics/assignments/${encodeURIComponent(
      assignmentId
    )}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    }
  );

  return parseResponse(response);
}


// ============================================================
// ASSIGNED CASES
// ============================================================

export async function getForensicCases() {
  const response = await authenticatedFetch(
    "/forensics/cases"
  );

  return parseResponse(response);
}


// ============================================================
// ASSIGNED EVIDENCE
// ============================================================

export async function getForensicEvidence() {
  const response = await authenticatedFetch(
    "/forensics/evidence"
  );

  return parseResponse(response);
}


// ============================================================
// EVIDENCE FOR ONE ASSIGNED CASE
// ============================================================

export async function getForensicCaseEvidence(
  caseId
) {
  const response = await authenticatedFetch(
    `/forensics/cases/${encodeURIComponent(
      caseId
    )}/evidence`
  );

  return parseResponse(response);
}


// ============================================================
// CREATE ASSIGNMENT
// SUPERVISOR / SYSTEM ADMIN
// ============================================================

export async function createForensicAssignment(
  payload
) {
  const response = await authenticatedFetch(
    "/forensics/assignments",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return parseResponse(response);
}