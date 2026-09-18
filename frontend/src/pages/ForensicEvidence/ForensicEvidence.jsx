import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Database,
  FileSearch,
  FolderOpen,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import ForensicPageLayout from "../../components/layout/ForensicPageLayout.jsx";

import {
  getForensicAssignment,
  getForensicCaseEvidence,
  getForensicCases,
} from "../../services/forensics.js";

import "./ForensicEvidence.css";


/* =========================================================
   HELPERS
   ========================================================= */

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


function getCaseReference(
  caseRecord
) {
  return (
    caseRecord?.case_id ||
    caseRecord?.fir_number ||
    `Case #${caseRecord?.id ?? "—"}`
  );
}


function getCaseTitle(
  caseRecord
) {
  return (
    caseRecord?.title ||
    caseRecord?.offence ||
    "Assigned investigation"
  );
}


function getEvidenceReference(
  item
) {
  return (
    item?.evidence_id ||
    `Evidence #${item?.id ?? "—"}`
  );
}


function getEvidenceTitle(
  item
) {
  return (
    item?.title ||
    "Untitled Evidence"
  );
}


function getEvidenceType(
  item
) {
  return (
    item?.evidence_type ||
    "Evidence"
  );
}


function getEvidenceStatus(
  item
) {
  return (
    item?.status ||
    "Recorded"
  );
}


/* =========================================================
   CHOOSE FORENSIC TOOL
   ========================================================= */

function getRecommendedTool(
  item
) {
  const value =
    [
      item?.evidence_type,
      item?.title,
      item?.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();


  if (
    value.includes("cdr") ||
    value.includes(
      "call detail"
    ) ||
    value.includes(
      "communication"
    ) ||
    value.includes(
      "call record"
    )
  ) {
    return "cdr";
  }


  if (
    value.includes("cctv") ||
    value.includes("video") ||
    value.includes("image") ||
    value.includes("photo") ||
    value.includes("audio")
  ) {
    return "media";
  }


  return "integrity";
}


/* =========================================================
   DEDUPLICATION
   ========================================================= */

function deduplicateEvidence(
  items
) {
  const map =
    new Map();

  items.forEach(
    (item) => {
      const key =
        item?.id ??
        item?.evidence_id;

      if (
        key === null ||
        key === undefined
      ) {
        return;
      }

      map.set(
        String(key),
        item
      );
    }
  );

  return Array.from(
    map.values()
  );
}


/* =========================================================
   PAGE
   ========================================================= */

function ForensicEvidence() {
  const navigate =
    useNavigate();

  const [searchParams] =
    useSearchParams();


  const caseParam =
    searchParams.get("case");

  const assignmentParam =
    searchParams.get(
      "assignment"
    );


  const caseId =
    caseParam &&
    !Number.isNaN(
      Number(caseParam)
    )
      ? Number(caseParam)
      : null;


  const assignmentId =
    assignmentParam &&
    !Number.isNaN(
      Number(
        assignmentParam
      )
    )
      ? Number(
          assignmentParam
        )
      : null;


  const caseMode =
    Number.isInteger(
      caseId
    ) &&
    caseId > 0;


  const [evidence, setEvidence] =
    useState([]);

  const [cases, setCases] =
    useState([]);

  const [
    assignment,
    setAssignment,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [error, setError] =
    useState("");


  /* =======================================================
     ALL ASSIGNED CASE EVIDENCE
     ======================================================= */

  async function loadAllEvidence(
    assignedCases
  ) {
    if (
      !Array.isArray(
        assignedCases
      ) ||
      assignedCases.length ===
        0
    ) {
      return [];
    }


    const results =
      await Promise.allSettled(
        assignedCases.map(
          (caseRecord) =>
            getForensicCaseEvidence(
              caseRecord.id
            )
        )
      );


    const combined = [];


    results.forEach(
      (result) => {
        if (
          result.status ===
            "fulfilled" &&
          Array.isArray(
            result.value
          )
        ) {
          combined.push(
            ...result.value
          );
        }
      }
    );


    return deduplicateEvidence(
      combined
    );
  }


  /* =======================================================
     LOAD
     ======================================================= */

  const loadData =
    useCallback(
      async (
        manualRefresh = false
      ) => {
        if (manualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        try {
          const caseData =
            await getForensicCases();


          const assignedCases =
            Array.isArray(
              caseData
            )
              ? caseData
              : [];


          setCases(
            assignedCases
          );


          /*
           * CASEWORK MODE
           */

          if (caseMode) {
            const evidenceData =
              await getForensicCaseEvidence(
                caseId
              );


            setEvidence(
              Array.isArray(
                evidenceData
              )
                ? evidenceData
                : []
            );


            if (
              Number.isInteger(
                assignmentId
              ) &&
              assignmentId > 0
            ) {
              const assignmentData =
                await getForensicAssignment(
                  assignmentId
                );

              setAssignment(
                assignmentData ||
                  null
              );
            } else {
              setAssignment(
                null
              );
            }

            return;
          }


          /*
           * INTERNAL ALL-EVIDENCE VIEW
           */

          const allEvidence =
            await loadAllEvidence(
              assignedCases
            );

          setEvidence(
            allEvidence
          );

          setAssignment(null);

        } catch (
          requestError
        ) {
          console.error(
            "Forensic evidence load error:",
            requestError
          );

          setEvidence([]);

          setError(
            requestError?.message ||
              "Unable to load forensic evidence."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        caseMode,
        caseId,
        assignmentId,
      ]
    );


  useEffect(() => {
    loadData();
  }, [loadData]);


  /* =======================================================
     SELECTED CASE
     ======================================================= */

  const selectedCase =
    useMemo(() => {
      if (!caseMode) {
        return null;
      }

      return (
        cases.find(
          (caseRecord) =>
            Number(
              caseRecord.id
            ) ===
            Number(caseId)
        ) || null
      );
    }, [
      cases,
      caseId,
      caseMode,
    ]);


  /* =======================================================
     CASE LOOKUP
     ======================================================= */

  const caseMap =
    useMemo(() => {
      const map =
        new Map();

      cases.forEach(
        (caseRecord) => {
          map.set(
            Number(
              caseRecord.id
            ),
            caseRecord
          );
        }
      );

      return map;
    }, [cases]);


  /* =======================================================
     ANALYZE
     ======================================================= */

  function analyzeEvidence(
    item
  ) {
    const evidenceKey =
      item.id ??
      item.evidence_id;

    const tool =
      getRecommendedTool(
        item
      );


    const params =
      new URLSearchParams();

    params.set(
      "evidence",
      String(evidenceKey)
    );

    params.set(
      "tool",
      tool
    );


    if (item.case_id) {
      params.set(
        "case",
        String(
          item.case_id
        )
      );
    }


    if (assignmentId) {
      params.set(
        "assignment",
        String(
          assignmentId
        )
      );
    }


    navigate(
      `/forensic/digital-forensics?${params.toString()}`
    );
  }


  /* =======================================================
     UI
     ======================================================= */

  return (
    <ForensicPageLayout
      module="evidence"
    >
      <div className="fe-page">

        <div className="fe-content">

          {/* HEADER */}

          <section className="fe-heading">

            <div>

              <div className="fe-eyebrow">
                FORENSIC ANALYST · CASEWORK
              </div>


              <h1>
                {caseMode
                  ? "Case Evidence"
                  : "Assigned Evidence"}
              </h1>


              <p>
                {caseMode
                  ? "Review evidence linked to this forensic assignment and send relevant digital material for technical examination."
                  : "Review evidence belonging to investigations assigned to your forensic account."}
              </p>

            </div>


            <div className="fe-heading-actions">

              {caseMode && (
                <button
                  type="button"
                  className="fe-back"
                  onClick={() =>
                    navigate(
                      "/forensic/assignments"
                    )
                  }
                >
                  <ArrowLeft
                    size={16}
                  />

                  Assignments
                </button>
              )}


              <button
                type="button"
                className="fe-refresh"
                disabled={
                  refreshing ||
                  loading
                }
                onClick={() =>
                  loadData(true)
                }
              >
                <RefreshCw
                  size={16}
                  className={
                    refreshing
                      ? "fe-spin"
                      : ""
                  }
                />

                {refreshing
                  ? "Refreshing"
                  : "Refresh"}
              </button>

            </div>

          </section>


          {/* CASE CONTEXT */}

          {caseMode && (
            <section className="fe-case-context">

              <div className="fe-case-icon">
                <FolderOpen
                  size={21}
                />
              </div>


              <div className="fe-case-main">

                <span>
                  ASSIGNED CASE
                </span>


                <strong>
                  {selectedCase
                    ? getCaseReference(
                        selectedCase
                      )
                    : `Case #${caseId}`}
                </strong>


                <p>
                  {selectedCase
                    ? getCaseTitle(
                        selectedCase
                      )
                    : "Assigned investigation"}
                </p>

              </div>


              {assignment && (
                <div className="fe-assignment-context">

                  <span>
                    Assignment #
                    {assignment.id}
                  </span>

                  <strong>
                    {
                      assignment.examination_type
                    }
                  </strong>

                  <small>
                    {
                      assignment.status
                    }
                  </small>

                </div>
              )}

            </section>
          )}


          {/* ERROR */}

          {error && (
            <div
              className="fe-error"
              role="alert"
            >
              <AlertCircle
                size={18}
              />

              <span>
                {error}
              </span>
            </div>
          )}


          {/* COUNT */}

          <section className="fe-record-bar">

            <div>
              <Database
                size={17}
              />

              <span>
                {caseMode
                  ? "Evidence linked to this case"
                  : "Evidence across assigned cases"}
              </span>
            </div>

            <strong>
              {evidence.length}{" "}
              {evidence.length === 1
                ? "record"
                : "records"}
            </strong>

          </section>


          {loading ? (
            <div className="fe-state">

              <Loader2
                size={27}
                className="fe-spin"
              />

              <span>
                Loading evidence…
              </span>

            </div>
          ) : evidence.length ===
            0 ? (
            <div className="fe-empty">

              <FileSearch
                size={38}
              />

              <h3>
                No evidence recorded
              </h3>

              <p>
                No evidence records are currently available for this forensic case.
              </p>

            </div>
          ) : (
            <section className="fe-list">

              {evidence.map(
                (item) => {
                  const evidenceCase =
                    caseMap.get(
                      Number(
                        item.case_id
                      )
                    );


                  return (
                    <article
                      key={
                        item.id ||
                        item.evidence_id
                      }
                      className="fe-record"
                    >

                      <div className="fe-record-top">

                        <div>

                          <span className="fe-reference">
                            {getEvidenceReference(
                              item
                            )}
                          </span>


                          <span className="fe-type">
                            {getEvidenceType(
                              item
                            )}
                          </span>


                          {!caseMode &&
                            evidenceCase && (
                              <span className="fe-type">
                                {getCaseReference(
                                  evidenceCase
                                )}
                              </span>
                            )}

                        </div>


                        <div className="fe-heading-actions">

                          <span className="fe-status">
                            {getEvidenceStatus(
                              item
                            )}
                          </span>


                          <button
                            type="button"
                            className="fe-back"
                            onClick={() =>
                              analyzeEvidence(
                                item
                              )
                            }
                          >
                            <FileSearch
                              size={15}
                            />

                            Analyze
                          </button>

                        </div>

                      </div>


                      <h3>
                        {getEvidenceTitle(
                          item
                        )}
                      </h3>


                      {!caseMode &&
                        evidenceCase && (
                          <p className="fe-description">
                            <strong>
                              {getCaseReference(
                                evidenceCase
                              )}
                            </strong>

                            {" · "}

                            {getCaseTitle(
                              evidenceCase
                            )}
                          </p>
                        )}


                      {item.description && (
                        <p className="fe-description">
                          {
                            item.description
                          }
                        </p>
                      )}


                      <div className="fe-meta">

                        <div>
                          <ShieldCheck
                            size={15}
                          />

                          <span>
                            Source
                          </span>

                          <strong>
                            {item.source ||
                              "Not recorded"}
                          </strong>
                        </div>


                        <div>
                          <UserRound
                            size={15}
                          />

                          <span>
                            Collected by
                          </span>

                          <strong>
                            {item.collected_by ||
                              "—"}
                          </strong>
                        </div>


                        <div>
                          <CalendarDays
                            size={15}
                          />

                          <span>
                            Collected
                          </span>

                          <strong>
                            {formatDate(
                              item.collected_at ||
                                item.uploaded_at
                            )}
                          </strong>
                        </div>

                      </div>

                    </article>
                  );
                }
              )}

            </section>
          )}

        </div>

      </div>
    </ForensicPageLayout>
  );
}


export default ForensicEvidence;