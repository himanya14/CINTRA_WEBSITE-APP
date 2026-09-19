import { authenticatedFetch } from "./api.js";


async function parse(response) {
  let data = {};

  try {
    data =
      await response.json();
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


async function request(
  path,
  options = {}
) {
  return parse(
    await authenticatedFetch(
      path,
      options
    )
  );
}


export const featureApi = {

  /* =======================================================
     FEATURE REGISTRY
     ======================================================= */

  featureRegistry: () =>
    request("/features"),


  /* =======================================================
     FORENSICS
     ======================================================= */

  forensicOverview: () =>
    request("/forensics/overview"),

  forensicCases: () =>
    request("/forensics/cases"),


  /* =======================================================
     CASE INTELLIGENCE
     ======================================================= */

  caseIntelligence: (caseId) =>
    request(
      `/case-intelligence/case/${caseId}`
    ),

  generateLeads: (caseId) =>
    request(
      `/case-intelligence/case/${caseId}/generate-leads`,
      {
        method: "POST",
      }
    ),

  reviewLead: (
    id,
    status
  ) =>
    request(
      `/case-intelligence/leads/${id}/review`,
      {
        method: "PATCH",

        body: JSON.stringify({
          status,
        }),
      }
    ),


  /* =======================================================
     GLOBAL CROSS-CASE GRAPH

     THIS is the endpoint used by the Cross-Case page.
     It loads the complete authorized graph in ONE request.
     ======================================================= */

  globalCrossCaseNetwork: ({
    entityTypes = "",
    bridgesOnly = false,
    limit = 300,
  } = {}) => {

    const params =
      new URLSearchParams();


    if (entityTypes) {
      params.set(
        "entity_types",
        entityTypes
      );
    }


    params.set(
      "bridges_only",
      String(bridgesOnly)
    );


    params.set(
      "limit",
      String(limit)
    );


    return request(
      `/cross-case-graph/network?${params.toString()}`
    );
  },


  /* =======================================================
     EXISTING CROSS-CASE ENDPOINTS
     ======================================================= */

  crossCaseForCase: (caseId) =>
    request(
      `/cross-case/case/${caseId}/overlaps`
    ),

  crossCaseNetwork: (caseId) =>
    request(
      `/cross-case/network/${caseId}`
    ),

  crossCaseSearch: (q) =>
    request(
      `/cross-case/search?q=${encodeURIComponent(q)}`
    ),

  entityAppearances: (
    type,
    value
  ) =>
    request(
      `/cross-case/entity/${encodeURIComponent(type)}/${encodeURIComponent(value)}`
    ),


  /* =======================================================
     LEGAL
     ======================================================= */

  legalFrameworks: () =>
    request(
      "/legal/frameworks"
    ),

  legalSections: (
    q = "",
    framework = ""
  ) =>
    request(
      `/legal/sections?q=${encodeURIComponent(q)}${
        framework
          ? `&framework=${encodeURIComponent(framework)}`
          : ""
      }`
    ),

  caseLegalSections: (
    caseId
  ) =>
    request(
      `/legal/cases/${caseId}/sections`
    ),

  suggestCaseLegalSections: (
    caseId
  ) =>
    request(
      `/legal/cases/${caseId}/suggest`,
      {
        method: "POST",
      }
    ),

  addCaseLegalSection: (
    caseId,
    payload
  ) =>
    request(
      `/legal/cases/${caseId}/sections`,
      {
        method: "POST",

        body:
          JSON.stringify(
            payload
          ),
      }
    ),

  reviewCaseLegalSection: (
    caseId,
    linkId,
    status
  ) =>
    request(
      `/legal/cases/${caseId}/sections/${linkId}/review`,
      {
        method: "PATCH",

        body:
          JSON.stringify({
            status,
          }),
      }
    ),

  removeCaseLegalSection: (
    caseId,
    linkId
  ) =>
    request(
      `/legal/cases/${caseId}/sections/${linkId}`,
      {
        method: "DELETE",
      }
    ),


  /* =======================================================
     MASTER DATA
     ======================================================= */

  masterCategories: () =>
    request(
      "/master-data/categories"
    ),

  masterData: (
    category = ""
  ) =>
    request(
      `/master-data${
        category
          ? `?category=${encodeURIComponent(category)}`
          : ""
      }`
    ),

  createMasterData: (
    payload
  ) =>
    request(
      "/master-data",
      {
        method: "POST",

        body:
          JSON.stringify(
            payload
          ),
      }
    ),


  /* =======================================================
     TIMELINE
     ======================================================= */

  timeline: (
    caseId
  ) =>
    request(
      `/timeline/case/${caseId}`
    ),

  createTimelineEvent: (
    payload
  ) =>
    request(
      "/timeline",
      {
        method: "POST",

        body:
          JSON.stringify(
            payload
          ),
      }
    ),


  /* =======================================================
     CUSTODY
     ======================================================= */

  custody: (
    evidenceId
  ) =>
    request(
      `/custody/evidence/${evidenceId}`
    ),


  /* =======================================================
     RELATIONSHIPS
     ======================================================= */

  relationshipExplain: (
    id
  ) =>
    request(
      `/relationships/${id}/explain`
    ),

  relationshipReview: (
    id,
    status,
    explanation = null
  ) =>
    request(
      `/relationships/${id}/review`,
      {
        method: "PATCH",

        body:
          JSON.stringify({
            status,
            explanation,
          }),
      }
    ),

  reviewAnalysisEdge: (
    caseId,
    payload
  ) =>
    request(
      `/relationships/case/${caseId}/review-analysis-edge`,
      {
        method: "POST",

        body:
          JSON.stringify(
            payload
          ),
      }
    ),
};
