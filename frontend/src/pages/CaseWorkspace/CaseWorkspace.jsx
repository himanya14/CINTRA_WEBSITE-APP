import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheckBig,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileSearch,
  Files,
  FileText,
  FolderOpen,
  LayoutGrid,
  Link2,
  Network,
  NotebookText,
  Printer,
  RotateCcw,
  Scale,
  ShieldCheck,
  Target,
  UsersRound,
  X,
} from "lucide-react";

import AppHeader from "../../components/layout/AppHeader";
import "./CaseWorkspace.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("cintra_token") ||
    sessionStorage.getItem("cintra_token")
  );
}

function clearStoredAuth() {
  localStorage.removeItem("cintra_token");
  localStorage.removeItem("cintra_officer");

  sessionStorage.removeItem("cintra_token");
  sessionStorage.removeItem("cintra_officer");
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function prettyRelationshipType(value) {
  if (!value) return "Relationship";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeStatus(value) {
  const status = String(
    value || "Unverified"
  ).trim();

  const lowered = status.toLowerCase();

  if (
    lowered === "verified" ||
    lowered === "confirmed" ||
    lowered === "approved"
  ) {
    return "Verified";
  }

  if (
    lowered === "rejected" ||
    lowered === "dismissed"
  ) {
    return "Rejected";
  }

  if (
    lowered === "needs follow-up" ||
    lowered === "needs followup" ||
    lowered === "follow-up"
  ) {
    return "Needs Follow-up";
  }

  return "Unverified";
}

function isPendingRelationship(relationship) {
  return (
    normalizeStatus(
      relationship?.verification_status
    ) === "Unverified"
  );
}

function getFirNumber(caseData) {
  return (
    caseData?.fir_number ||
    caseData?.fir_no ||
    "—"
  );
}

function getOfficer(caseData) {
  return (
    caseData?.investigating_officer ||
    caseData?.officer_id ||
    "—"
  );
}

function getRegisteredDate(caseData) {
  return (
    caseData?.registered_on ||
    caseData?.case_date ||
    caseData?.created_at ||
    null
  );
}

function getEvidenceName(item) {
  return (
    item?.title ||
    item?.evidence_name ||
    item?.evidence_type ||
    item?.description ||
    "Evidence Record"
  );
}

function getEvidenceFile(item) {
  return (
    item?.file_url ||
    item?.file_path ||
    item?.document_url ||
    ""
  );
}

function resolveFileUrl(value) {
  if (!value) return "";

  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${API_BASE_URL}${value}`;
  }

  return `${API_BASE_URL}/${value}`;
}

function cleanAlertDescription(value) {
  if (!value) {
    return "Review available evidence and intelligence before progressing this investigation.";
  }

  if (typeof value !== "string") {
    return "CINTRA identified an intelligence lead requiring investigator review.";
  }

  const trimmed = value.trim();

  if (
    trimmed.startsWith("[{") ||
    trimmed.startsWith("{") ||
    trimmed.includes('"source"') ||
    trimmed.includes('"relationship"')
  ) {
    return "CINTRA identified a potentially significant relationship in the investigation records. Review the supporting evidence and relationship before taking further action.";
  }

  return trimmed;
}

function CaseWorkspace() {
  const navigate = useNavigate();
  const { caseId } = useParams();

  const diaryRef = useRef(null);
  const actionsRef = useRef(null);

  const [caseData, setCaseData] = useState(null);
  const [persons, setPersons] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [relationships, setRelationships] =
  useState([]);
  const [alerts, setAlerts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [activeTab, setActiveTab] =
    useState("Workspace");

  const [actionsOpen, setActionsOpen] =
    useState(false);

  const [copied, setCopied] = useState(false);

  const [
    reviewingRelationship,
    setReviewingRelationship,
  ] = useState(null);

  const [
    relationshipSaving,
    setRelationshipSaving,
  ] = useState(false);

  async function authenticatedFetch(
    path,
    options = {}
  ) {
    const token = getToken();

    if (!token) {
      clearStoredAuth();

      navigate("/", {
        replace: true,
      });

      return null;
    }

    const response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,

        headers: {
          ...(options.body
            ? {
                "Content-Type":
                  "application/json",
              }
            : {}),

          Authorization: `Bearer ${token}`,

          ...(options.headers || {}),
        },
      }
    );

    if (response.status === 401) {
      clearStoredAuth();

      navigate("/", {
        replace: true,
      });

      return null;
    }

    return response;
  }

  async function fetchOptional(path) {
    try {
      const response =
        await authenticatedFetch(path);

      if (!response || !response.ok) {
        return [];
      }

      const result = await response.json();

      return Array.isArray(result)
        ? result
        : [];
    } catch {
      return [];
    }
  }

  async function loadWorkspace(silent = false) {
    try {
      if (!silent) {
        setLoading(true);
      }
      setMessage("");

      const caseResponse =
        await authenticatedFetch(
          `/cases/${caseId}`
        );

      if (!caseResponse) return;

      if (!caseResponse.ok) {
        throw new Error(
          "Case record could not be loaded."
        );
      }

      const caseResult =
        await caseResponse.json();

      setCaseData(caseResult);

      const [
        evidenceResult,
        relationshipResult,
        alertResult,
      ] = await Promise.all([
        fetchOptional(
          `/evidence/case/${caseId}`
        ),

        fetchOptional(
          `/relationships/case/${caseId}`
        ),

        fetchOptional(
          `/intelligence/alerts/case/${caseId}`
        ),
      ]);

      setEvidence(evidenceResult);

      setRelationships(
        relationshipResult
      );

      setAlerts(alertResult);
    } catch (error) {
      console.error(
        "Case workspace error:",
        error
      );

      setMessage(
        error.message ||
          "Unable to load case workspace."
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadWorkspace();

    const syncTimer = window.setInterval(() => {
      loadWorkspace(true);
    }, 7000);

    return () => window.clearInterval(syncTimer);
  }, [caseId]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        actionsRef.current &&
        !actionsRef.current.contains(
          event.target
        )
      ) {
        setActionsOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  const pendingRelationships =
    useMemo(
      () =>
        relationships.filter(
          isPendingRelationship
        ),
      [relationships]
    );

  const strongestAlert =
    alerts.find(
      (alert) =>
        String(
          alert.status
        ).toLowerCase() === "open"
    ) ||
    alerts[0] ||
    null;

  const knownItems = useMemo(() => {
    const evidenceItems =
      evidence
        .slice(0, 3)
        .map(
          (item) =>
            item.description ||
            item.title ||
            item.evidence_type
        )
        .filter(Boolean);

    if (evidenceItems.length) {
      return evidenceItems;
    }

    return [
      "Case record is registered in the CINTRA investigation database.",

      `${relationships.length} intelligence relationship${
        relationships.length === 1
          ? ""
          : "s"
      } currently linked to this case.`,

      `${evidence.length} evidence record${
        evidence.length === 1
          ? ""
          : "s"
      } currently available.`,
    ];
  }, [
    evidence,
    relationships,
  ]);

  const timelineItems =
    useMemo(() => {
      const items = [];

      if (caseData?.registered_on) {
        items.push({
          date: caseData.registered_on,
          title: "Case record created",
          description:
            "Investigation record entered into CINTRA.",
        });
      }

      evidence.forEach((item) => {
        items.push({
          date:
            item.created_at ||
            item.uploaded_at,

          title:
            getEvidenceName(item),

          description:
            "Evidence record added to the case.",
        });
      });

      alerts.forEach((alert) => {
        items.push({
          date: alert.created_at,

          title:
            alert.title ||
            "Intelligence Alert",

          description:
            cleanAlertDescription(
              alert.description
            ),
        });
      });

      if (caseData?.last_updated) {
        items.push({
          date:
            caseData.last_updated,

          title:
            "Case record updated",

          description:
            "Investigation record was updated.",
        });
      }

      return items.sort((a, b) => {
        const timeA = new Date(
          a.date || 0
        ).getTime();

        const timeB = new Date(
          b.date || 0
        ).getTime();

        return timeB - timeA;
      });
    }, [
      caseData,
      evidence,
      alerts,
    ]);

  async function reviewRelationship(
    relationship,
    newStatus
  ) {
    try {
      setRelationshipSaving(true);
      setMessage("");

      const response =
        await authenticatedFetch(
          `/relationships/${relationship.id}`,
          {
            method: "PUT",

            body: JSON.stringify({
              verification_status:
                newStatus,
            }),
          }
        );

      if (!response) {
        return;
      }

      let result = null;

      try {
        result =
          await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Relationship review could not be saved."
        );
      }

      setRelationships(
        (current) =>
          current.map((item) =>
            item.id === result.id
              ? result
              : item
          )
      );

      setReviewingRelationship(
        result
      );

      setMessage(
        `Relationship ${result.relationship_id} marked as ${newStatus}.`
      );
    } catch (error) {
      console.error(
        "Relationship review error:",
        error
      );

      setMessage(
        error.message ||
          "Unable to save investigator review."
      );
    } finally {
      setRelationshipSaving(false);
    }
  }

  function handleTab(tab) {
    setActionsOpen(false);

    switch (tab) {
      case "Persons":
        navigate(
          `/cases/${caseId}/persons`
        );
        return;

      case "Evidence":
        navigate(
          `/cases/${caseId}/evidence`
        );
        return;

      case "Relationships":
        navigate(
          `/cases/${caseId}/relationships`
        );
        return;

      case "Chargesheet":
        navigate(
          `/cases/${caseId}/chargesheet`
        );
        return;

      case "Case Diary":
        setActiveTab("Workspace");

        setTimeout(() => {
          diaryRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 50);

        return;

      default:
        setActiveTab(tab);
    }
  }

  function handleExport() {
    setActionsOpen(false);
    window.print();
  }

  async function copyCaseId() {
    try {
      await navigator.clipboard.writeText(
        caseData?.case_id ||
          String(caseId)
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      setMessage(
        "Case ID could not be copied."
      );
    }
  }

  if (loading) {
    return (
      <div className="case-workspace">
        <AppHeader activePage="cases" />

        <main className="case-workspace-main">
          <div className="workspace-loading">
            Loading case workspace...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="case-workspace">
      <AppHeader activePage="cases" />

      <main className="case-workspace-main">
        <nav className="workspace-breadcrumb">
          <button
            type="button"
            onClick={() =>
              navigate("/cases")
            }
          >
            Cases
          </button>

          <span>›</span>

          <span>
            {caseData?.case_id ||
              `Case ${caseId}`}
          </span>

          <span>›</span>

          <strong>
            {activeTab === "Unresolved"
              ? "Manual Review"
              : activeTab}
          </strong>
        </nav>

        {message && (
          <div className="workspace-message">
            {message}
          </div>
        )}

        {caseData ? (
          <>
            <section className="workspace-case-banner">
              <div className="workspace-case-main">
                <div className="workspace-folder">
                  <FolderOpen
                    size={39}
                    strokeWidth={1.6}
                  />
                </div>

                <div className="workspace-case-copy">
                  <div className="workspace-case-title">
                    <h1>
                      {caseData.case_id}
                    </h1>

                    <span>
                      {caseData.stage ||
                        caseData.status}
                    </span>
                  </div>

                  <h2>
                    {caseData.title}
                  </h2>

                  {caseData.offence && (
                    <p>
                      {caseData.offence}
                    </p>
                  )}
                </div>
              </div>

              <div className="workspace-meta">
                <MetaItem
                  label="FIR No."
                  value={getFirNumber(
                    caseData
                  )}
                />

                <MetaItem
                  label="Police Station"
                  value={
                    caseData.police_station ||
                    "—"
                  }
                />

                <MetaItem
                  label="Investigating Officer"
                  value={getOfficer(
                    caseData
                  )}
                />

                <MetaItem
                  label="Registered"
                  value={formatDate(
                    getRegisteredDate(
                      caseData
                    )
                  )}
                />

                <button
                  type="button"
                  className="workspace-export"
                  onClick={handleExport}
                >
                  <Download size={17} />
                  Export
                </button>

                <div
                  className="workspace-more-wrap"
                  ref={actionsRef}
                >
                  <button
                    type="button"
                    className="workspace-actions"
                    aria-expanded={
                      actionsOpen
                    }
                    onClick={() =>
                      setActionsOpen(
                        (current) =>
                          !current
                      )
                    }
                  >
                    More Actions

                    <ChevronDown
                      size={16}
                    />
                  </button>

                  {actionsOpen && (
                    <div className="workspace-actions-menu">
                      <div className="actions-menu-label">
                        CASE ACTIONS
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleTab(
                            "Persons"
                          )
                        }
                      >
                        <UsersRound
                          size={17}
                        />

                        <span>
                          <strong>
                            View Persons
                          </strong>

                          <small>
                            Review case persons
                          </small>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleTab(
                            "Evidence"
                          )
                        }
                      >
                        <FileSearch
                          size={17}
                        />

                        <span>
                          <strong>
                            Review Evidence
                          </strong>

                          <small>
                            Open evidence records
                          </small>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActionsOpen(
                            false
                          );

                          setActiveTab(
                            "Unresolved"
                          );
                        }}
                      >
                        <ShieldCheck
                          size={17}
                        />

                        <span>
                          <strong>
                            Manual Review
                          </strong>

                          <small>
                            {
                              pendingRelationships.length
                            }{" "}
                            relationships pending
                          </small>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleTab(
                            "Relationships"
                          )
                        }
                      >
                        <Network
                          size={17}
                        />

                        <span>
                          <strong>
                            Relationship Map
                          </strong>

                          <small>
                            Open network analysis
                          </small>
                        </span>
                      </button>

                      <div className="actions-menu-divider" />

                      <button
                        type="button"
                        onClick={() =>
                          handleTab(
                            "Chargesheet"
                          )
                        }
                      >
                        <FileText
                          size={17}
                        />

                        <span>
                          <strong>
                            Chargesheet
                          </strong>

                          <small>
                            Open case report
                          </small>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={copyCaseId}
                      >
                        <Copy size={17} />

                        <span>
                          <strong>
                            {copied
                              ? "Case ID Copied"
                              : "Copy Case ID"}
                          </strong>

                          <small>
                            {caseData.case_id}
                          </small>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExport}
                      >
                        <Printer
                          size={17}
                        />

                        <span>
                          <strong>
                            Print / Save PDF
                          </strong>

                          <small>
                            Export workspace
                          </small>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <nav className="workspace-tabs">
              <WorkspaceTab
                active={
                  activeTab ===
                    "Workspace" ||
                  activeTab ===
                    "Unresolved"
                }
                icon={
                  <LayoutGrid
                    size={19}
                  />
                }
                label="Workspace"
                onClick={() =>
                  handleTab("Workspace")
                }
              />

              <WorkspaceTab
                active={
                  activeTab ===
                  "Timeline"
                }
                icon={
                  <Clock3 size={19} />
                }
                label="Timeline"
                onClick={() =>
                  handleTab("Timeline")
                }
              />

              <WorkspaceTab
                icon={
                  <UsersRound
                    size={19}
                  />
                }
                label="Persons"
                onClick={() =>
                  handleTab("Persons")
                }
              />

              <WorkspaceTab
                icon={
                  <FileSearch
                    size={19}
                  />
                }
                label="Evidence"
                onClick={() =>
                  handleTab("Evidence")
                }
              />

              <WorkspaceTab
                icon={
                  <Network size={19} />
                }
                label="Relationships"
                onClick={() =>
                  handleTab(
                    "Relationships"
                  )
                }
              />

              <WorkspaceTab
                icon={
                  <Scale size={19} />
                }
                label="Legal"
                onClick={() =>
                  navigate(`/cases/${caseId}/legal`)
                }
              />

              <WorkspaceTab
                active={
                  activeTab ===
                  "Documents"
                }
                icon={
                  <Files size={19} />
                }
                label="Documents"
                onClick={() =>
                  handleTab("Documents")
                }
              />

              <WorkspaceTab
                icon={
                  <NotebookText
                    size={19}
                  />
                }
                label="Case Diary"
                onClick={() =>
                  handleTab(
                    "Case Diary"
                  )
                }
              />

              <WorkspaceTab
                icon={
                  <FileText size={19} />
                }
                label="Chargesheet"
                onClick={() =>
                  handleTab(
                    "Chargesheet"
                  )
                }
              />
            </nav>

            {activeTab ===
              "Workspace" && (
              <>
                <WorkspaceOverview
                  evidence={evidence}
                  relationships={
                    relationships
                  }
                  pendingRelationships={
                    pendingRelationships
                  }
                  knownItems={
                    knownItems
                  }
                  strongestAlert={
                    strongestAlert
                  }
                  onEvidence={() =>
                    navigate(
                      `/cases/${caseId}/evidence`
                    )
                  }
                  onManualReview={() =>
                    setActiveTab(
                      "Unresolved"
                    )
                  }
                />

                <section
                  className="workspace-diary"
                  ref={diaryRef}
                >
                  <div className="workspace-diary-heading">
                    <div>
                      <span>
                        INVESTIGATION
                        RECORD
                      </span>

                      <h3>
                        Case Diary —
                        Latest
                      </h3>
                    </div>
                  </div>

                  <DiaryRow
                    id={`CD-${caseId}-003`}
                    date={formatDateTime(
                      caseData.last_updated
                    )}
                    officer={getOfficer(
                      caseData
                    )}
                    note="Latest investigation record update."
                  />

                  <DiaryRow
                    id={`CD-${caseId}-002`}
                    date="—"
                    officer={getOfficer(
                      caseData
                    )}
                    note="Supporting records reviewed."
                  />

                  <DiaryRow
                    id={`CD-${caseId}-001`}
                    date={formatDateTime(
                      caseData.registered_on
                    )}
                    officer={getOfficer(
                      caseData
                    )}
                    note="Case investigation record created."
                  />
                </section>
              </>
            )}

            {activeTab ===
              "Unresolved" && (
              <ManualReviewView
                relationships={
                  relationships
                }
                reviewingRelationship={
                  reviewingRelationship
                }
                setReviewingRelationship={
                  setReviewingRelationship
                }
                saving={
                  relationshipSaving
                }
                onReview={
                  reviewRelationship
                }
                onBack={() =>
                  setActiveTab(
                    "Workspace"
                  )
                }
              />
            )}

            {activeTab ===
              "Timeline" && (
              <TimelineView
                items={timelineItems}
              />
            )}

            {activeTab ===
              "Documents" && (
              <DocumentsView
                evidence={evidence}
                onChargesheet={() =>
                  navigate(
                    `/cases/${caseId}/chargesheet`
                  )
                }
              />
            )}
          </>
        ) : (
          <div className="workspace-loading">
            Case record not available.
          </div>
        )}
      </main>

      <footer className="workspace-footer">
        <div>
          <ShieldCheck size={18} />

          <span>CINTRA v2.1.0</span>

          <i />

          <span>
            Internal Use Only
          </span>
        </div>

        <span>© 2026 CINTRA</span>

        <div>
          <span>Help</span>

          <i />

          <span>System Status</span>
        </div>
      </footer>
    </div>
  );
}

function WorkspaceOverview({
  evidence,
  relationships,
  pendingRelationships,
  knownItems,
  strongestAlert,
  onEvidence,
  onManualReview,
}) {
  return (
    <section className="workspace-summary-grid">
      <article className="workspace-panel known-panel">
        <header className="workspace-panel-heading">
          <CircleCheckBig
            size={25}
          />

          <div>
            <span>CASE FINDINGS</span>
            <h3>WHAT WE KNOW</h3>
          </div>
        </header>

        <div className="known-list">
          {knownItems.map(
            (item, index) => (
              <div
                className="known-item"
                key={index}
              >
                <span />

                <p>{item}</p>
              </div>
            )
          )}
        </div>

        <button
          type="button"
          className="workspace-text-link"
          onClick={onEvidence}
        >
          View supporting evidence
          <ArrowRight size={17} />
        </button>
      </article>

      <article className="workspace-panel unresolved-panel">
        <header className="workspace-panel-heading">
          <CircleHelp size={25} />

          <div>
            <span>
              INVESTIGATOR REVIEW
            </span>

            <h3>
              WHAT IS UNRESOLVED
            </h3>
          </div>
        </header>

        <div className="manual-summary">
          <div className="manual-summary-number">
            {
              pendingRelationships.length
            }
          </div>

          <div>
            <strong>
              Relationship
              {pendingRelationships.length ===
              1
                ? ""
                : "s"}{" "}
              awaiting manual review
            </strong>

            <p>
              AI-generated or inferred
              relationships must be
              reviewed by an investigator
              before being treated as
              verified intelligence.
            </p>
          </div>
        </div>

        {pendingRelationships
          .slice(0, 2)
          .map((relationship) => (
            <div
              className="unresolved-preview"
              key={relationship.id}
            >
              <div>
                <strong>
                  {
                    relationship.source_ref
                  }{" "}
                  →{" "}
                  {
                    relationship.target_ref
                  }
                </strong>

                <span>
                  {prettyRelationshipType(
                    relationship.relationship_type
                  )}
                </span>
              </div>

              <span className="status-pending">
                Pending
              </span>
            </div>
          ))}

        {pendingRelationships.length ===
          0 && (
          <div className="all-reviewed">
            <Check size={18} />

            <span>
              No relationship reviews are
              currently pending.
            </span>
          </div>
        )}

        <button
          type="button"
          className="workspace-text-link"
          onClick={onManualReview}
        >
          Open manual review
          <ArrowRight size={17} />
        </button>
      </article>

      <article className="workspace-panel next-panel">
        <header className="workspace-panel-heading">
          <Target size={25} />

          <div>
            <span>
              RECOMMENDED REVIEW
            </span>

            <h3>NEXT ACTION</h3>
          </div>
        </header>

        <div className="next-action-main">
          <div className="next-action-icon">
            {strongestAlert ? (
              <AlertTriangle
                size={29}
              />
            ) : (
              <FileText size={29} />
            )}
          </div>

          <div className="next-action-copy">
            <h4>
              {strongestAlert?.title ||
                "Review case evidence and intelligence"}
            </h4>

            <p>
              {cleanAlertDescription(
                strongestAlert?.description
              )}
            </p>

            <div className="next-action-meta">
              <div>
                <span>Priority</span>

                <strong>
                  {strongestAlert?.severity ||
                    "Normal"}
                </strong>
              </div>

              <div>
                <span>Status</span>

                <b>
                  {strongestAlert?.status ||
                    "Open"}
                </b>
              </div>

              <div>
                <span>
                  Relationships
                </span>

                <b>
                  {relationships.length}
                </b>
              </div>

              <div>
                <span>Evidence</span>

                <b>
                  {evidence.length}
                </b>
              </div>
            </div>

            <button
              type="button"
              onClick={onEvidence}
            >
              Review Supporting
              Evidence

              <ArrowRight
                size={17}
              />
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}

function ManualReviewView({
  relationships,
  reviewingRelationship,
  setReviewingRelationship,
  saving,
  onReview,
  onBack,
}) {
  const pending =
    relationships.filter(
      isPendingRelationship
    );

  const reviewed =
    relationships.filter(
      (item) =>
        !isPendingRelationship(item)
    );

  const selected =
    reviewingRelationship;

  return (
    <section className="workspace-view manual-review-view">
      <header className="workspace-view-heading">
        <div>
          <span>
            HUMAN-IN-THE-LOOP
            VERIFICATION
          </span>

          <h2>
            Relationship Manual Review
          </h2>

          <p>
            Review relationships surfaced
            by CINTRA and record an
            investigator decision. AI
            analysis is an investigative
            lead and does not independently
            establish guilt or legal
            responsibility.
          </p>
        </div>

        <button
          type="button"
          className="workspace-export"
          onClick={onBack}
        >
          <ArrowLeft size={15} />
          Back to Workspace
        </button>
      </header>

      <div className="manual-review-layout">
        <div className="review-list-panel">
          <div className="review-list-heading">
            <div>
              <span>
                PENDING REVIEW
              </span>

              <strong>
                {pending.length} item
                {pending.length === 1
                  ? ""
                  : "s"}
              </strong>
            </div>
          </div>

          {pending.length === 0 ? (
            <div className="manual-empty">
              <CircleCheckBig
                size={31}
              />

              <strong>
                All relationships
                reviewed
              </strong>

              <p>
                There are no unverified
                relationships remaining
                in this case.
              </p>
            </div>
          ) : (
            pending.map(
              (relationship) => (
                <button
                  type="button"
                  key={
                    relationship.id
                  }
                  className={
                    selected?.id ===
                    relationship.id
                      ? "review-list-item active"
                      : "review-list-item"
                  }
                  onClick={() =>
                    setReviewingRelationship(
                      relationship
                    )
                  }
                >
                  <div className="review-list-top">
                    <strong>
                      {
                        relationship.relationship_id
                      }
                    </strong>

                    <span className="status-pending">
                      Pending
                    </span>
                  </div>

                  <div className="review-list-relation">
                    {
                      relationship.source_ref
                    }

                    <ArrowRight
                      size={14}
                    />

                    {
                      relationship.target_ref
                    }
                  </div>

                  <small>
                    {prettyRelationshipType(
                      relationship.relationship_type
                    )}
                  </small>
                </button>
              )
            )
          )}

          {reviewed.length > 0 && (
            <>
              <div className="review-list-heading reviewed-heading">
                <div>
                  <span>REVIEWED</span>

                  <strong>
                    {reviewed.length} item
                    {reviewed.length === 1
                      ? ""
                      : "s"}
                  </strong>
                </div>
              </div>

              {reviewed.map(
                (relationship) => (
                  <button
                    type="button"
                    key={
                      relationship.id
                    }
                    className={
                      selected?.id ===
                      relationship.id
                        ? "review-list-item active"
                        : "review-list-item"
                    }
                    onClick={() =>
                      setReviewingRelationship(
                        relationship
                      )
                    }
                  >
                    <div className="review-list-top">
                      <strong>
                        {
                          relationship.relationship_id
                        }
                      </strong>

                      <RelationshipStatus
                        status={
                          relationship.verification_status
                        }
                      />
                    </div>

                    <div className="review-list-relation">
                      {
                        relationship.source_ref
                      }

                      <ArrowRight
                        size={14}
                      />

                      {
                        relationship.target_ref
                      }
                    </div>

                    <small>
                      {prettyRelationshipType(
                        relationship.relationship_type
                      )}
                    </small>
                  </button>
                )
              )}
            </>
          )}
        </div>

        <div className="review-detail-panel">
          {!selected ? (
            <div className="review-select-empty">
              <ShieldCheck
                size={42}
              />

              <h3>
                Select a relationship
              </h3>

              <p>
                Choose a relationship from
                the left to inspect the
                supporting information and
                record an investigator
                decision.
              </p>
            </div>
          ) : (
            <>
              <div className="review-detail-header">
                <div>
                  <span>
                    RELATIONSHIP RECORD
                  </span>

                  <h3>
                    {
                      selected.relationship_id
                    }
                  </h3>
                </div>

                <RelationshipStatus
                  status={
                    selected.verification_status
                  }
                />
              </div>

              <div className="relationship-review-route">
                <div>
                  <span>
                    {selected.source_type}
                  </span>

                  <strong>
                    {selected.source_ref}
                  </strong>
                </div>

                <div className="relation-arrow">
                  <span>
                    {prettyRelationshipType(
                      selected.relationship_type
                    )}
                  </span>

                  <ArrowRight
                    size={24}
                  />
                </div>

                <div>
                  <span>
                    {selected.target_type}
                  </span>

                  <strong>
                    {selected.target_ref}
                  </strong>
                </div>
              </div>

              <div className="review-facts-grid">
                <ReviewFact
                  label="Relationship Type"
                  value={prettyRelationshipType(
                    selected.relationship_type
                  )}
                />

                <ReviewFact
                  label="Link Confidence"
                  value={
                    selected.confidence !==
                    null &&
                    selected.confidence !==
                    undefined
                      ? `${selected.confidence}%`
                      : "Not computed"
                  }
                />

                <ReviewFact
                  label="Evidence Source"
                  value={
                    selected.source ||
                    "Not specified"
                  }
                />

                <ReviewFact
                  label="Data Origin"
                  value={
                    selected.data_origin ||
                    "Not specified"
                  }
                />
              </div>

              <div className="review-description">
                <span>
                  WHY THIS LINK EXISTS
                </span>

                <p>
                  {selected.description ||
                    "No additional relationship explanation was supplied."}
                </p>
              </div>

              {selected.synthetic && (
                <div className="synthetic-review-notice">
                  <AlertTriangle
                    size={17}
                  />

                  <span>
                    This relationship uses
                    synthetic demonstration
                    data.
                  </span>
                </div>
              )}

              <div className="investigator-decision">
                <span>
                  INVESTIGATOR DECISION
                </span>

                <p>
                  Record whether this link
                  is supported, rejected, or
                  requires further
                  investigation.
                </p>

                <div className="review-action-buttons">
                  <button
                    type="button"
                    className="confirm-review"
                    disabled={saving}
                    onClick={() =>
                      onReview(
                        selected,
                        "Verified"
                      )
                    }
                  >
                    <Check size={17} />

                    Confirm Link
                  </button>

                  <button
                    type="button"
                    className="followup-review"
                    disabled={saving}
                    onClick={() =>
                      onReview(
                        selected,
                        "Needs Follow-up"
                      )
                    }
                  >
                    <RotateCcw
                      size={17}
                    />

                    Needs Follow-up
                  </button>

                  <button
                    type="button"
                    className="reject-review"
                    disabled={saving}
                    onClick={() =>
                      onReview(
                        selected,
                        "Rejected"
                      )
                    }
                  >
                    <X size={17} />

                    Reject Link
                  </button>
                </div>

                {saving && (
                  <div className="review-saving">
                    Saving investigator
                    decision...
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function RelationshipStatus({
  status,
}) {
  const normalized =
    normalizeStatus(status);

  return (
    <span
      className={`relationship-status ${normalized
        .toLowerCase()
        .replaceAll(" ", "-")}`}
    >
      {normalized}
    </span>
  );
}

function ReviewFact({
  label,
  value,
}) {
  return (
    <div className="review-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TimelineView({ items }) {
  const navigate = useNavigate();
  const { caseId } = useParams();
  return (
    <section className="workspace-view">
      <header className="workspace-view-heading">
        <div>
          <span>
            INVESTIGATION HISTORY
          </span>

          <h2>Case Timeline</h2>

          <p>
            Chronological activity
            associated with this
            investigation.
          </p>
        </div>

        <button
          type="button"
          className="workspace-secondary-action"
          onClick={() => navigate(`/cases/${caseId}/timeline-full`)}
        >
          Open Full Timeline
        </button>
      </header>

      {items.length === 0 ? (
        <div className="workspace-empty">
          No timeline events are
          available.
        </div>
      ) : (
        <div className="timeline-list">
          {items.map(
            (item, index) => (
              <div
                className="timeline-row"
                key={`${item.title}-${index}`}
              >
                <div className="timeline-marker">
                  <span />
                </div>

                <div className="timeline-time">
                  {formatDateTime(
                    item.date
                  )}
                </div>

                <div className="timeline-copy">
                  <strong>
                    {item.title}
                  </strong>

                  <p>
                    {item.description}
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

function DocumentsView({
  evidence,
  onChargesheet,
}) {
  const documents =
    evidence.filter((item) =>
      Boolean(getEvidenceFile(item))
    );

  return (
    <section className="workspace-view">
      <header className="workspace-view-heading workspace-document-heading">
        <div>
          <span>CASE RECORDS</span>

          <h2>Documents</h2>

          <p>
            Documents and files
            associated with this
            investigation.
          </p>
        </div>

        <button
          type="button"
          onClick={onChargesheet}
        >
          <FileText size={16} />
          Open Chargesheet
        </button>
      </header>

      {documents.length === 0 ? (
        <div className="workspace-empty">
          No uploaded documents are
          currently associated with this
          case.
        </div>
      ) : (
        <div className="document-list">
          {documents.map((item) => {
            const url =
              resolveFileUrl(
                getEvidenceFile(item)
              );

            return (
              <div
                className="document-row"
                key={item.id}
              >
                <div className="document-icon">
                  <FileText
                    size={22}
                  />
                </div>

                <div className="document-copy">
                  <strong>
                    {getEvidenceName(
                      item
                    )}
                  </strong>

                  <span>
                    {item.evidence_type ||
                      "Evidence Document"}
                  </span>
                </div>

                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open

                  <ExternalLink
                    size={14}
                  />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MetaItem({
  label,
  value,
}) {
  return (
    <div className="workspace-meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WorkspaceTab({
  icon,
  label,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      className={
        active
          ? "workspace-tab active"
          : "workspace-tab"
      }
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function DiaryRow({
  id,
  date,
  officer,
  note,
}) {
  return (
    <div className="workspace-diary-row">
      <span className="diary-id">
        {id}
      </span>

      <span>{date}</span>
      <span>{officer}</span>
      <span>{note}</span>
    </div>
  );
}

export default CaseWorkspace;
