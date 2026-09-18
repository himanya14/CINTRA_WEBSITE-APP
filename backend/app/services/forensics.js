import {
  authenticatedFetch,
} from "./api.js";


async function parseResponse(response) {
  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    if (typeof data?.detail === "string") {
      message = data.detail;
    } else if (typeof data?.message === "string") {
      message = data.message;
    }

    throw new Error(message);
  }

  return data;
}


/* =========================================================
   FORENSIC OVERVIEW
   ========================================================= */

export async function getForensicOverview() {
  const response = await authenticatedFetch(
    "/forensics/overview"
  );

  return parseResponse(response);
}


/* =========================================================
   ASSIGNMENTS
   ========================================================= */

export async function getMyForensicAssignments() {
  const response = await authenticatedFetch(
    "/forensics/assignments/me"
  );

  return parseResponse(response);
}


export async function getForensicAssignment(
  assignmentId
) {
  const response = await authenticatedFetch(
    `/forensics/assignments/${assignmentId}`
  );

  return parseResponse(response);
}


export async function updateForensicAssignmentStatus(
  assignmentId,
  status
) {
  const response = await authenticatedFetch(
    `/forensics/assignments/${assignmentId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    }
  );

  return parseResponse(response);
}


/* =========================================================
   CASES
   ========================================================= */

export async function getForensicCases() {
  const response = await authenticatedFetch(
    "/forensics/cases"
  );

  return parseResponse(response);
}


/* =========================================================
   EVIDENCE
   ========================================================= */

export async function getForensicEvidence() {
  const response = await authenticatedFetch(
    "/forensics/evidence"
  );

  return parseResponse(response);
}


export async function getForensicCaseEvidence(
  caseId
) {
  const response = await authenticatedFetch(
    `/forensics/cases/${caseId}/evidence`
  );

  return parseResponse(response);
}