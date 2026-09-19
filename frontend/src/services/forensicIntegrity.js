import {
  getAccessToken,
} from "./api.js";


const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";


/* =========================================================
   RESPONSE HANDLER
   ========================================================= */

async function parseResponse(
  response
) {
  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }


  if (!response.ok) {
    const detail =
      data?.detail;

    let message = "";


    if (
      typeof detail ===
      "string"
    ) {
      message =
        detail;
    } else if (
      Array.isArray(detail)
    ) {
      message =
        detail
          .map(
            (item) =>
              item?.msg ||
              "Validation error"
          )
          .join(", ");
    } else {
      message =
        data?.message ||
        `Request failed (${response.status})`;
    }


    throw new Error(
      message
    );
  }


  return data;
}


/* =========================================================
   AUTH
   ========================================================= */

function getAuthHeaders() {
  const token =
    getAccessToken();


  if (!token) {
    throw new Error(
      "Authentication token is unavailable. Please sign in again."
    );
  }


  return {
    Authorization:
      `Bearer ${token}`,
  };
}


/* =========================================================
   VERIFY ORIGINAL EVIDENCE INTEGRITY
   ========================================================= */

export async function verifyEvidenceIntegrity(
  evidenceDatabaseId
) {
  if (
    evidenceDatabaseId === null ||
    evidenceDatabaseId === undefined
  ) {
    throw new Error(
      "Evidence database ID is required."
    );
  }


  const response =
    await fetch(
      `${API_BASE_URL}/forensics/evidence/${encodeURIComponent(
        evidenceDatabaseId
      )}/verify-integrity`,
      {
        method:
          "POST",

        headers:
          getAuthHeaders(),
      }
    );


  return parseResponse(
    response
  );
}


/* =========================================================
   GET INTEGRITY VERIFICATION HISTORY
   ========================================================= */

export async function getEvidenceIntegrityHistory(
  evidenceDatabaseId
) {
  if (
    evidenceDatabaseId === null ||
    evidenceDatabaseId === undefined
  ) {
    return [];
  }


  const response =
    await fetch(
      `${API_BASE_URL}/forensics/evidence/${encodeURIComponent(
        evidenceDatabaseId
      )}/integrity-history`,
      {
        method:
          "GET",

        headers:
          getAuthHeaders(),
      }
    );


  const data =
    await parseResponse(
      response
    );


  return Array.isArray(
    data
  )
    ? data
    : [];
}


/* =========================================================
   GET FORENSIC ARTIFACTS FOR ASSIGNED CASE
   ========================================================= */

export async function getForensicArtifacts(
  caseId
) {
  if (
    caseId === null ||
    caseId === undefined
  ) {
    return [];
  }


  const response =
    await fetch(
      `${API_BASE_URL}/forensics/cases/${encodeURIComponent(
        caseId
      )}/artifacts`,
      {
        method:
          "GET",

        headers:
          getAuthHeaders(),
      }
    );


  const data =
    await parseResponse(
      response
    );


  return Array.isArray(
    data
  )
    ? data
    : [];
}


/* =========================================================
   CREATE FORENSIC ARTIFACT
   ========================================================= */

export async function createForensicArtifact({
  caseId,
  sourceEvidenceId = null,
  title,
  artifactType,
  description = "",
  file,
}) {
  if (
    caseId === null ||
    caseId === undefined
  ) {
    throw new Error(
      "Assigned case is required."
    );
  }


  if (
    !title ||
    !String(
      title
    ).trim()
  ) {
    throw new Error(
      "Artifact title is required."
    );
  }


  if (
    !artifactType ||
    !String(
      artifactType
    ).trim()
  ) {
    throw new Error(
      "Artifact type is required."
    );
  }


  if (!file) {
    throw new Error(
      "Choose a forensic artifact file."
    );
  }


  const formData =
    new FormData();


  formData.append(
    "case_id",
    String(
      caseId
    )
  );


  if (
    sourceEvidenceId !== null &&
    sourceEvidenceId !== undefined
  ) {
    formData.append(
      "source_evidence_id",
      String(
        sourceEvidenceId
      )
    );
  }


  formData.append(
    "title",
    String(
      title
    ).trim()
  );


  formData.append(
    "artifact_type",
    String(
      artifactType
    ).trim()
  );


  if (
    description &&
    String(
      description
    ).trim()
  ) {
    formData.append(
      "description",
      String(
        description
      ).trim()
    );
  }


  formData.append(
    "file",
    file
  );


  const response =
    await fetch(
      `${API_BASE_URL}/forensics/artifacts`,
      {
        method:
          "POST",

        headers:
          getAuthHeaders(),

        body:
          formData,
      }
    );


  return parseResponse(
    response
  );
}
