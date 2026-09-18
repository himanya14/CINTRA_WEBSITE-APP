import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileSearch,
  FolderOpen,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import ForensicPageLayout from "../../components/layout/ForensicPageLayout.jsx";

import {
  getForensicCases,
  getMyForensicAssignments,
  updateForensicAssignmentStatus,
} from "../../services/forensics.js";

import "./ForensicAssignments.css";


function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function getCaseReference(caseRecord) {
  return (
    caseRecord?.case_id ||
    caseRecord?.fir_number ||
    `Case #${caseRecord?.id ?? "—"}`
  );
}


function getCaseTitle(caseRecord) {
  return (
    caseRecord?.title ||
    caseRecord?.offence ||
    "Assigned investigation"
  );
}


function normalisePriority(priority) {
  return String(priority || "Normal")
    .trim()
    .toLowerCase();
}


function normaliseStatus(status) {
  return String(status || "Assigned")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}


function ForensicAssignments() {
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState([]);
  const [cases, setCases] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [updatingId, setUpdatingId] = useState(null);

  const [statusFilter, setStatusFilter] = useState("All");


  const loadData = useCallback(
    async (manualRefresh = false) => {
      if (manualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [
          assignmentData,
          caseData,
        ] = await Promise.all([
          getMyForensicAssignments(),
          getForensicCases(),
        ]);

        setAssignments(
          Array.isArray(assignmentData)
            ? assignmentData
            : []
        );

        setCases(
          Array.isArray(caseData)
            ? caseData
            : []
        );
      } catch (requestError) {
        setError(
          requestError?.message ||
            "Unable to load forensic assignments."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );


  useEffect(() => {
    loadData();
  }, [loadData]);


  const caseMap = useMemo(() => {
    const map = new Map();

    cases.forEach((caseRecord) => {
      map.set(
        Number(caseRecord.id),
        caseRecord
      );
    });

    return map;
  }, [cases]);


  const counts = useMemo(() => {
    return assignments.reduce(
      (result, assignment) => {
        result.total += 1;

        if (assignment.status === "Assigned") {
          result.assigned += 1;
        }

        if (assignment.status === "In Progress") {
          result.inProgress += 1;
        }

        if (assignment.status === "Completed") {
          result.completed += 1;
        }

        const priority =
          normalisePriority(
            assignment.priority
          );

        if (
          priority === "high" ||
          priority === "urgent" ||
          priority === "critical"
        ) {
          result.priority += 1;
        }

        return result;
      },
      {
        total: 0,
        assigned: 0,
        inProgress: 0,
        completed: 0,
        priority: 0,
      }
    );
  }, [assignments]);


  const filteredAssignments =
    useMemo(() => {
      if (statusFilter === "All") {
        return assignments;
      }

      return assignments.filter(
        (assignment) =>
          assignment.status ===
          statusFilter
      );
    }, [
      assignments,
      statusFilter,
    ]);


  async function changeStatus(
    assignment,
    newStatus
  ) {
    if (
      updatingId !== null ||
      assignment.status === newStatus
    ) {
      return;
    }

    setUpdatingId(assignment.id);
    setError("");

    try {
      const updated =
        await updateForensicAssignmentStatus(
          assignment.id,
          newStatus
        );

      setAssignments((current) =>
        current.map((item) =>
          item.id === assignment.id
            ? updated
            : item
        )
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Unable to update assignment."
      );
    } finally {
      setUpdatingId(null);
    }
  }


  function openCase(assignment) {
    navigate(
      `/forensic/evidence?case=${encodeURIComponent(
        assignment.case_id
      )}&assignment=${encodeURIComponent(
        assignment.id
      )}`
    );
  }


  return (
    <ForensicPageLayout module="assignments">

      <div className="fa-page">

        <div className="fa-content">

          {/* ===============================================
              PAGE HEADER
              =============================================== */}

          <section className="fa-heading">

            <div>

              <div className="fa-eyebrow">
                FORENSIC ANALYST WORKSPACE
              </div>

              <h1>
                Examination Assignments
              </h1>

              <p>
                Review work assigned to you,
                begin examinations and record
                completion against the assigned
                case or evidence.
              </p>

            </div>


            <button
              type="button"
              className="fa-refresh"
              onClick={() =>
                loadData(true)
              }
              disabled={
                refreshing ||
                loading
              }
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "fa-spin"
                    : ""
                }
              />

              {refreshing
                ? "Refreshing"
                : "Refresh"}
            </button>

          </section>


          {/* ===============================================
              ERROR
              =============================================== */}

          {error && (
            <div
              className="fa-error"
              role="alert"
            >
              <AlertCircle size={18} />

              <span>
                {error}
              </span>
            </div>
          )}


          {/* ===============================================
              SUMMARY STRIP
              =============================================== */}

          <section className="fa-summary">

            <button
              type="button"
              className={
                statusFilter === "All"
                  ? "fa-summary-item active"
                  : "fa-summary-item"
              }
              onClick={() =>
                setStatusFilter("All")
              }
            >
              <span>
                Total assignments
              </span>

              <strong>
                {counts.total}
              </strong>
            </button>


            <button
              type="button"
              className={
                statusFilter === "Assigned"
                  ? "fa-summary-item active"
                  : "fa-summary-item"
              }
              onClick={() =>
                setStatusFilter(
                  "Assigned"
                )
              }
            >
              <span>
                Awaiting start
              </span>

              <strong>
                {counts.assigned}
              </strong>
            </button>


            <button
              type="button"
              className={
                statusFilter ===
                "In Progress"
                  ? "fa-summary-item active"
                  : "fa-summary-item"
              }
              onClick={() =>
                setStatusFilter(
                  "In Progress"
                )
              }
            >
              <span>
                In examination
              </span>

              <strong>
                {counts.inProgress}
              </strong>
            </button>


            <button
              type="button"
              className={
                statusFilter === "Completed"
                  ? "fa-summary-item active"
                  : "fa-summary-item"
              }
              onClick={() =>
                setStatusFilter(
                  "Completed"
                )
              }
            >
              <span>
                Completed
              </span>

              <strong>
                {counts.completed}
              </strong>
            </button>

          </section>


          {/* ===============================================
              WORK QUEUE HEADER
              =============================================== */}

          <section className="fa-workspace">

            <div className="fa-workspace-header">

              <div>

                <h2>
                  Examination Queue
                </h2>

                <p>
                  {statusFilter === "All"
                    ? "All forensic work assigned to your officer account."
                    : `${statusFilter} forensic assignments.`}
                </p>

              </div>


              <span className="fa-record-count">
                {
                  filteredAssignments.length
                }{" "}
                record
                {
                  filteredAssignments.length ===
                  1
                    ? ""
                    : "s"
                }
              </span>

            </div>


            {/* =============================================
                LOADING
                ============================================= */}

            {loading ? (
              <div className="fa-loading">

                <Loader2
                  size={25}
                  className="fa-spin"
                />

                <span>
                  Loading assigned examinations…
                </span>

              </div>
            ) : filteredAssignments.length ===
              0 ? (
              <div className="fa-empty">

                <FileSearch size={34} />

                <h3>
                  No assignments found
                </h3>

                <p>
                  There are no forensic
                  assignments matching this
                  status.
                </p>

              </div>
            ) : (
              <div className="fa-assignment-list">

                {filteredAssignments.map(
                  (assignment) => {
                    const caseRecord =
                      caseMap.get(
                        Number(
                          assignment.case_id
                        )
                      );

                    const isUpdating =
                      updatingId ===
                      assignment.id;

                    return (
                      <article
                        key={assignment.id}
                        className="fa-assignment"
                      >

                        {/* LEFT */}

                        <div className="fa-assignment-main">

                          <div className="fa-assignment-topline">

                            <span className="fa-reference">
                              Assignment #
                              {assignment.id}
                            </span>

                            <span
                              className={`fa-status fa-status-${normaliseStatus(
                                assignment.status
                              )}`}
                            >
                              {
                                assignment.status
                              }
                            </span>

                            <span
                              className={`fa-priority fa-priority-${normalisePriority(
                                assignment.priority
                              )}`}
                            >
                              {
                                assignment.priority
                              }{" "}
                              priority
                            </span>

                          </div>


                          <h3>
                            {
                              assignment.examination_type
                            }
                          </h3>


                          <div className="fa-case-line">

                            <FolderOpen
                              size={16}
                            />

                            <strong>
                              {getCaseReference(
                                caseRecord
                              )}
                            </strong>

                            <span>
                              {getCaseTitle(
                                caseRecord
                              )}
                            </span>

                          </div>


                          {assignment.instructions && (
                            <p className="fa-instructions">
                              {
                                assignment.instructions
                              }
                            </p>
                          )}


                          <div className="fa-metadata">

                            <div>
                              <span>
                                Assigned
                              </span>

                              <strong>
                                {formatDate(
                                  assignment.assigned_at
                                )}
                              </strong>
                            </div>


                            <div>
                              <span>
                                Evidence
                              </span>

                              <strong>
                                {assignment.evidence_id
                                  ? `Evidence #${assignment.evidence_id}`
                                  : "Case-level examination"}
                              </strong>
                            </div>


                            {assignment.started_at && (
                              <div>
                                <span>
                                  Started
                                </span>

                                <strong>
                                  {formatDate(
                                    assignment.started_at
                                  )}
                                </strong>
                              </div>
                            )}


                            {assignment.completed_at && (
                              <div>
                                <span>
                                  Completed
                                </span>

                                <strong>
                                  {formatDate(
                                    assignment.completed_at
                                  )}
                                </strong>
                              </div>
                            )}

                          </div>

                        </div>


                        {/* RIGHT ACTIONS */}

                        <div className="fa-assignment-actions">

                          <button
                            type="button"
                            className="fa-secondary-action"
                            onClick={() =>
                              openCase(
                                assignment
                              )
                            }
                          >
                            <FolderOpen
                              size={16}
                            />

                            Open casework
                          </button>


                          {assignment.status ===
                            "Assigned" && (
                            <button
                              type="button"
                              className="fa-primary-action"
                              disabled={
                                isUpdating
                              }
                              onClick={() =>
                                changeStatus(
                                  assignment,
                                  "In Progress"
                                )
                              }
                            >
                              {isUpdating ? (
                                <Loader2
                                  size={16}
                                  className="fa-spin"
                                />
                              ) : (
                                <Play
                                  size={16}
                                />
                              )}

                              Start examination
                            </button>
                          )}


                          {assignment.status ===
                            "In Progress" && (
                            <button
                              type="button"
                              className="fa-complete-action"
                              disabled={
                                isUpdating
                              }
                              onClick={() =>
                                changeStatus(
                                  assignment,
                                  "Completed"
                                )
                              }
                            >
                              {isUpdating ? (
                                <Loader2
                                  size={16}
                                  className="fa-spin"
                                />
                              ) : (
                                <CheckCircle2
                                  size={16}
                                />
                              )}

                              Complete examination
                            </button>
                          )}


                          {assignment.status ===
                            "Completed" && (
                            <div className="fa-completed-note">

                              <CheckCircle2
                                size={17}
                              />

                              Examination closed

                            </div>
                          )}


                          {assignment.status ===
                            "Assigned" && (
                            <div className="fa-action-note">

                              <Clock3
                                size={14}
                              />

                              Awaiting examination

                            </div>
                          )}

                        </div>

                      </article>
                    );
                  }
                )}

              </div>
            )}

          </section>

        </div>

      </div>

    </ForensicPageLayout>
  );
}


export default ForensicAssignments;