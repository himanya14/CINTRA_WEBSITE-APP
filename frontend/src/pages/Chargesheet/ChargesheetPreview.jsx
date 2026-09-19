import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Loader2,
  Paperclip,
  RefreshCw,
  Scale,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import AppHeader from "../../components/layout/AppHeader";
import "./ChargesheetPreview.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

/* =========================================================
   AUTH
   ========================================================= */

function getToken() {
  return (
    localStorage.getItem("cintra_token") ||
    sessionStorage.getItem("cintra_token")
  );
}

function clearAuth() {
  localStorage.removeItem("cintra_token");
  localStorage.removeItem("cintra_officer");

  sessionStorage.removeItem("cintra_token");
  sessionStorage.removeItem("cintra_officer");
}

/* =========================================================
   HELPERS
   ========================================================= */

function formatDate(value, includeTime = false) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  if (includeTime) {
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function valueOf(source, ...keys) {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = source?.[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
}

function display(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

function getFileUrl(path) {
  if (!path) {
    return null;
  }

  const value = String(path);

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  return `${API_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

function normalizePerson(item) {
  const person = item?.person || item || {};

  return {
    personId:
      valueOf(person, "person_id", "personId") ||
      valueOf(item, "person_id", "personId"),

    name:
      valueOf(person, "name", "full_name") ||
      valueOf(item, "name", "full_name"),

    role:
      valueOf(
        item,
        "role_in_case",
        "case_role",
        "role"
      ) ||
      valueOf(
        person,
        "role_in_case",
        "case_role",
        "role"
      ),

    status:
      valueOf(item, "status", "case_status") ||
      valueOf(person, "status"),

    gender: valueOf(person, "gender"),

    phone: valueOf(
      person,
      "phone",
      "phone_number",
      "mobile_number"
    ),

    address: valueOf(
      person,
      "address",
      "current_address"
    ),
  };
}

function normalizeEvidence(item) {
  const security =
    item?.security ||
    item?.evidence_security ||
    {};

  const custody =
    item?.latest_custody ||
    item?.custody ||
    {};

  return {
    id: valueOf(
      item,
      "evidence_id",
      "id",
      "evidenceId"
    ),

    type: valueOf(
      item,
      "evidence_type",
      "type",
      "category"
    ),

    fileName: valueOf(
      item,
      "file_name",
      "original_filename",
      "filename",
      "name"
    ),

    source: valueOf(
      item,
      "source",
      "source_type"
    ),

    collectedBy: valueOf(
      item,
      "collected_by",
      "officer_id",
      "uploaded_by"
    ),

    collectedAt: valueOf(
      item,
      "collected_at",
      "captured_at",
      "created_at",
      "uploaded_at"
    ),

    sha256:
      valueOf(
        item,
        "sha256",
        "sha256_hash",
        "file_hash",
        "hash"
      ) ||
      valueOf(
        security,
        "sha256",
        "sha256_hash",
        "file_hash"
      ),

    integrity:
      valueOf(
        item,
        "integrity_status",
        "verification_status"
      ) ||
      valueOf(
        security,
        "integrity_status",
        "verification_status",
        "status"
      ),

    custody:
      valueOf(
        item,
        "latest_custody_status",
        "custody_status"
      ) ||
      valueOf(
        custody,
        "status",
        "event_type",
        "custody_status"
      ),

    linkedPerson: valueOf(
      item,
      "linked_person_name",
      "person_name"
    ),
  };
}

function normalizeLegal(item) {
  const section = item?.section || item || {};

  return {
    framework:
      valueOf(
        section,
        "framework_code",
        "framework"
      ) ||
      valueOf(
        item,
        "framework_code",
        "framework"
      ),

    number:
      valueOf(
        section,
        "section_number",
        "number"
      ) ||
      valueOf(
        item,
        "section_number",
        "number"
      ),

    title:
      valueOf(
        section,
        "offence_name",
        "title",
        "name"
      ) ||
      valueOf(
        item,
        "offence_name",
        "title",
        "name"
      ),

    legacy:
      valueOf(section, "legacy_reference") ||
      valueOf(item, "legacy_reference"),

    reason: valueOf(
      item,
      "reason",
      "reasoning",
      "applicability_reason",
      "rationale"
    ),

    status: valueOf(
      item,
      "status",
      "verification_status"
    ),
  };
}

function normalizeTimeline(item) {
  return {
    date: valueOf(
      item,
      "event_time",
      "occurred_at",
      "timestamp",
      "created_at",
      "date"
    ),

    type: valueOf(
      item,
      "event_type",
      "type",
      "category"
    ),

    title: valueOf(
      item,
      "title",
      "event_title",
      "label"
    ),

    description: valueOf(
      item,
      "description",
      "details",
      "summary"
    ),

    source: valueOf(
      item,
      "source",
      "source_type"
    ),
  };
}

/* =========================================================
   COMPONENT
   ========================================================= */

function ChargesheetPreview() {
  const navigate = useNavigate();
  const { caseId } = useParams();

  const pageRef = useRef(null);

  const caseSectionRef = useRef(null);
  const personsSectionRef = useRef(null);
  const evidenceSectionRef = useRef(null);
  const legalSectionRef = useRef(null);
  const chronologySectionRef = useRef(null);
  const summarySectionRef = useRef(null);
  const conclusionSectionRef = useRef(null);
  const recordSectionRef = useRef(null);
  const signatureSectionRef = useRef(null);

  const [documentData, setDocumentData] = useState(null);
  const [readiness, setReadiness] = useState(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [activeSection, setActiveSection] =
    useState("case");

  /* =======================================================
     AUTH FETCH
     ======================================================= */

  async function authenticatedFetch(
    url,
    options = {}
  ) {
    const token = getToken();

    if (!token) {
      clearAuth();

      navigate("/", {
        replace: true,
      });

      throw new Error("Authentication required.");
    }

    const response = await fetch(url, {
      ...options,

      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      clearAuth();

      navigate("/", {
        replace: true,
      });

      throw new Error("Your session has expired.");
    }

    return response;
  }

  /* =======================================================
     PREPARE DRAFT
     ======================================================= */

  async function prepareChargesheet() {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/chargesheets/case/${caseId}/prepare`,
      {
        method: "POST",
      }
    );

    let result = null;

    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      throw new Error(
        result?.detail ||
          result?.message ||
          "Unable to prepare chargesheet."
      );
    }

    return result;
  }

  /* =======================================================
     GET COMPLETE DOCUMENT
     ======================================================= */

  async function fetchDocument() {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/chargesheets/case/${caseId}/document`
    );

    if (response.status === 404) {
      return null;
    }

    let result = null;

    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      throw new Error(
        result?.detail ||
          result?.message ||
          "Chargesheet document could not be loaded."
      );
    }

    return result;
  }

  /* =======================================================
     LOAD
     ======================================================= */

  async function loadChargesheet({
    showLoader = true,
    autoPrepare = true,
    keepMessages = false,
  } = {}) {
    try {
      if (showLoader) {
        setLoading(true);
      }

      if (!keepMessages) {
        setMessage("");
        setSuccessMessage("");
      }

      let result = await fetchDocument();

      /*
       * No existing chargesheet:
       * create a draft from current database records.
       */
      if (
        autoPrepare &&
        (!result || !result?.chargesheet)
      ) {
        await prepareChargesheet();

        result = await fetchDocument();
      }

      if (!result) {
        throw new Error(
          "Backend did not return a chargesheet document."
        );
      }

      if (!result?.case) {
        throw new Error(
          "Case information is missing from the chargesheet document."
        );
      }

      if (!result?.chargesheet) {
        throw new Error(
          "Chargesheet draft could not be prepared."
        );
      }

      setDocumentData(result);

      try {
        const readinessResponse =
          await authenticatedFetch(
            `${API_BASE_URL}/chargesheets/case/${caseId}/readiness`
          );

        if (readinessResponse.ok) {
          const readinessResult =
            await readinessResponse.json();

          setReadiness(readinessResult);
        } else {
          setReadiness(null);
        }
      } catch (error) {
        console.warn(
          "[CINTRA] Readiness endpoint unavailable:",
          error
        );

        setReadiness(null);
      }

      return result;
    } catch (error) {
      console.error(
        "[CINTRA Chargesheet] Load error:",
        error
      );

      if (
        error.message !== "Authentication required." &&
        error.message !== "Your session has expired."
      ) {
        setMessage(
          error?.message ||
            "Unable to load chargesheet."
        );
      }

      return null;
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadChargesheet();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  /* =======================================================
     SIDEBAR SCROLL
     ======================================================= */

  function scrollToSection(
    sectionName,
    ref
  ) {
    setActiveSection(sectionName);

    if (
      !ref.current ||
      !pageRef.current
    ) {
      return;
    }

    const page = pageRef.current;

    const targetTop =
      ref.current.getBoundingClientRect().top -
      page.getBoundingClientRect().top +
      page.scrollTop -
      178;

    page.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });
  }

  /* =======================================================
     REFRESH DRAFT
     ======================================================= */

  async function refreshDraft() {
    try {
      setSaving(true);

      setMessage("");
      setSuccessMessage("");

      await prepareChargesheet();

      const refreshed =
        await loadChargesheet({
          showLoader: false,
          autoPrepare: false,
          keepMessages: true,
        });

      if (!refreshed) {
        throw new Error(
          "Chargesheet could not be refreshed."
        );
      }

      setSuccessMessage(
        "Chargesheet refreshed from current case records."
      );
    } catch (error) {
      console.error(
        "[CINTRA Chargesheet] Refresh error:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to refresh chargesheet."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     PDF GENERATION
     ======================================================= */

  async function generatePdf() {
    const currentChargesheet =
      documentData?.chargesheet;

    if (!currentChargesheet) {
      setMessage(
        "Chargesheet record is unavailable."
      );

      return;
    }

    /*
     * Backend DB ID is normally required by:
     * POST /chargesheets/{id}/generate-pdf
     */
    const databaseId =
      currentChargesheet.id ||
      currentChargesheet.db_id ||
      null;

    if (!databaseId) {
      setMessage(
        "Cannot generate PDF because the chargesheet database ID was not returned by the backend."
      );

      return;
    }

    try {
      setGenerating(true);

      setMessage("");
      setSuccessMessage("");

      /*
       * Open a tab before the async call.
       * This avoids browser popup blockers.
       */
      const pdfWindow = window.open(
        "",
        "_blank"
      );

      if (pdfWindow) {
        pdfWindow.document.write(`
          <html>
            <head>
              <title>Generating CINTRA Chargesheet</title>
            </head>

            <body style="
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #071f50;
            ">
              <h3>Generating CINTRA Chargesheet...</h3>
              <p>Please keep this window open.</p>
            </body>
          </html>
        `);
      }

      const response =
        await authenticatedFetch(
          `${API_BASE_URL}/chargesheets/${databaseId}/generate-pdf`,
          {
            method: "POST",
          }
        );

      const contentType =
        response.headers.get("content-type") ||
        "";

      /* ---------------------------------------------------
         CASE 1:
         API directly returns application/pdf
         --------------------------------------------------- */

      if (
        response.ok &&
        contentType.includes(
          "application/pdf"
        )
      ) {
        const blob =
          await response.blob();

        const objectUrl =
          window.URL.createObjectURL(
            blob
          );

        if (pdfWindow) {
          pdfWindow.location.href =
            objectUrl;
        } else {
          window.open(
            objectUrl,
            "_blank"
          );
        }

        const fileName =
          `${
            currentChargesheet.chargesheet_id ||
            documentData?.case?.case_id ||
            "CINTRA-Chargesheet"
          }.pdf`;

        const anchor =
          document.createElement("a");

        anchor.href = objectUrl;
        anchor.download = fileName;

        document.body.appendChild(
          anchor
        );

        anchor.click();
        anchor.remove();

        window.setTimeout(() => {
          window.URL.revokeObjectURL(
            objectUrl
          );
        }, 60000);

        setSuccessMessage(
          "Chargesheet PDF generated successfully."
        );

        return;
      }

      /* ---------------------------------------------------
         CASE 2:
         API returns JSON
         --------------------------------------------------- */

      let result = null;

      try {
        result =
          await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        if (pdfWindow) {
          pdfWindow.close();
        }

        console.error(
          "[CINTRA PDF]",
          response.status,
          result
        );

        throw new Error(
          result?.detail ||
            result?.message ||
            `PDF generation failed with HTTP ${response.status}.`
        );
      }

      /*
       * Backend implementations may use
       * different path names.
       */
      let generatedPath =
        result?.generated_pdf_path ||
        result?.pdf_path ||
        result?.file_path ||
        result?.path ||
        result?.pdf_url ||
        result?.url ||
        result?.chargesheet
          ?.generated_pdf_path ||
        null;

      /*
       * Reload document because backend may only
       * persist generated_pdf_path to DB.
       */
      try {
        const refreshed =
          await fetchDocument();

        if (refreshed) {
          setDocumentData(refreshed);

          generatedPath =
            generatedPath ||
            refreshed?.chargesheet
              ?.generated_pdf_path ||
            refreshed?.chargesheet
              ?.pdf_path ||
            null;
        }
      } catch (refreshError) {
        console.warn(
          "[CINTRA] PDF generated but document refresh failed:",
          refreshError
        );
      }

      if (!generatedPath) {
        if (pdfWindow) {
          pdfWindow.close();
        }

        throw new Error(
          "The backend completed PDF generation but did not return or store a PDF path."
        );
      }

      const finalPdfUrl =
        getFileUrl(generatedPath);

      if (!finalPdfUrl) {
        if (pdfWindow) {
          pdfWindow.close();
        }

        throw new Error(
          "Generated PDF path is invalid."
        );
      }

      if (pdfWindow) {
        pdfWindow.location.href =
          finalPdfUrl;
      } else {
        window.open(
          finalPdfUrl,
          "_blank",
          "noopener,noreferrer"
        );
      }

      setSuccessMessage(
        "Chargesheet PDF generated successfully."
      );
    } catch (error) {
      console.error(
        "[CINTRA Chargesheet] Generate PDF error:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to generate chargesheet PDF."
      );
    } finally {
      setGenerating(false);
    }
  }

  /* =======================================================
     DATA FROM BACKEND
     ======================================================= */

  const caseData =
    documentData?.case || null;

  const chargesheet =
    documentData?.chargesheet ||
    null;

  const persons =
    Array.isArray(
      documentData?.accused
    ) &&
    documentData.accused.length > 0
      ? documentData.accused
      : Array.isArray(
          documentData?.persons
        )
      ? documentData.persons
      : [];

  const evidence =
    Array.isArray(
      documentData?.evidence
    )
      ? documentData.evidence
      : [];

  const legalProvisions =
    Array.isArray(
      documentData?.legal_provisions
    )
      ? documentData.legal_provisions
      : [];

  const chronology =
    Array.isArray(
      documentData?.chronology
    )
      ? documentData.chronology
      : [];

  const officer =
    documentData?.prepared_officer ||
    documentData
      ?.investigating_officer_record ||
    null;

  const verification =
    documentData?.verification ||
    {};

  /* =======================================================
     OFFICER
     ======================================================= */

  const officerId =
    valueOf(
      officer,
      "officer_id",
      "id"
    ) ||
    valueOf(
      chargesheet,
      "prepared_by"
    ) ||
    "—";

  const officerName =
    valueOf(
      officer,
      "name",
      "full_name"
    ) || "—";

  const officerDesignation =
    valueOf(
      officer,
      "designation",
      "rank",
      "role"
    ) || "—";

  /* =======================================================
     VERIFIER
     ======================================================= */

  const verifier =
    verification?.verified_by ||
    verification?.officer ||
    null;

  const verifierName =
    valueOf(
      verifier,
      "name",
      "full_name"
    ) ||
    valueOf(
      verification,
      "verified_by_name"
    ) ||
    "—";

  const verifierDesignation =
    valueOf(
      verifier,
      "designation",
      "rank",
      "role"
    ) ||
    valueOf(
      verification,
      "verified_by_designation"
    ) ||
    "—";

  const verificationStatus =
    valueOf(
      verification,
      "status",
      "document_status"
    ) ||
    valueOf(
      chargesheet,
      "verification_status"
    ) ||
    "—";

  const filingStatus =
    valueOf(
      chargesheet,
      "filing_status",
      "status"
    ) ||
    "Draft";

  /* =======================================================
     DYNAMIC STAMP
     ======================================================= */

  const sealLabel = (() => {
    const value =
      String(
        verificationStatus !== "—"
          ? verificationStatus
          : filingStatus
      ).toUpperCase();

    if (
      value.includes("VERIFIED")
    ) {
      return "VERIFIED";
    }

    if (
      value.includes("APPROVED")
    ) {
      return "APPROVED";
    }

    if (
      value.includes("FILED")
    ) {
      return "FILED";
    }

    return "DRAFT";
  })();

  /* =======================================================
     PDF URL
     ======================================================= */

  const pdfUrl =
    getFileUrl(
      chargesheet
        ?.generated_pdf_path ||
        chargesheet?.pdf_path
    );

  /* =======================================================
     LOADING
     ======================================================= */

  if (loading) {
    return (
      <div className="cs-loading-screen">
        <Loader2
          className="cs-spinner"
          size={28}
        />

        <span>
          Loading chargesheet from CINTRA...
        </span>
      </div>
    );
  }

  /* =======================================================
     UI
     ======================================================= */

  return (
    <div
      className="cs-page"
      ref={pageRef}
    >
      <AppHeader
        activePage="reports"
        caseId={caseId}
      />

      {/* ===============================================
          CONTEXT BAR
          =============================================== */}

      <div className="cs-context-bar">
        <div className="cs-breadcrumb">
          <button
            type="button"
            onClick={() =>
              navigate("/cases")
            }
          >
            Cases
          </button>

          <span>›</span>

          <button
            type="button"
            onClick={() =>
              navigate(
                `/cases/${caseId}`
              )
            }
          >
            {caseData?.case_id ||
              caseId}
          </button>

          <span>›</span>

          <span>
            Legal Chargesheet
          </span>

          <span>›</span>

          <strong>
            Preview Chargesheet
          </strong>
        </div>

        <div className="cs-context-actions">
          <span>
            Case Context:{" "}

            <strong>
              {caseData?.case_id ||
                caseId}
            </strong>
          </span>

          <button
            type="button"
            onClick={() =>
              navigate(
                `/cases/${caseId}`
              )
            }
          >
            <ArrowLeft size={16} />
            Case Workspace
          </button>
        </div>
      </div>

      {/* ===============================================
          ALERTS
          =============================================== */}

      {message && (
        <div className="cs-alert cs-alert-error">
          {message}
        </div>
      )}

      {successMessage && (
        <div className="cs-alert cs-alert-success">
          <Check size={16} />
          {successMessage}
        </div>
      )}

      {/* ===============================================
          ERROR
          =============================================== */}

      {!documentData ||
      !chargesheet ? (
        <div className="cs-empty">
          <FileText size={42} />

          <h2>
            Chargesheet Could Not Be Prepared
          </h2>

          <p>
            {message ||
              "No chargesheet document was returned by the backend."}
          </p>

          <button
            type="button"
            className="cs-action-primary"
            onClick={() =>
              loadChargesheet()
            }
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      ) : (
        <main className="cs-workspace">
          {/* ===========================================
              SIDEBAR
              =========================================== */}

          <aside className="cs-sidebar">
            <div className="cs-sidebar-inner">
              <button
                type="button"
                className={
                  activeSection ===
                  "case"
                    ? "cs-side-item active"
                    : "cs-side-item"
                }
                onClick={() =>
                  scrollToSection(
                    "case",
                    caseSectionRef
                  )
                }
              >
                <FileText size={20} />
                Case Details
              </button>

              <button
                type="button"
                className={
                  activeSection ===
                  "persons"
                    ? "cs-side-item active"
                    : "cs-side-item"
                }
                onClick={() =>
                  scrollToSection(
                    "persons",
                    personsSectionRef
                  )
                }
              >
                <UsersRound size={20} />
                Accused / Persons
              </button>

              <button
                type="button"
                className={
                  activeSection ===
                  "evidence"
                    ? "cs-side-item active"
                    : "cs-side-item"
                }
                onClick={() =>
                  scrollToSection(
                    "evidence",
                    evidenceSectionRef
                  )
                }
              >
                <Paperclip size={20} />
                Evidence
              </button>

              <button
                type="button"
                className={
                  activeSection ===
                  "legal"
                    ? "cs-side-item active"
                    : "cs-side-item"
                }
                onClick={() =>
                  scrollToSection(
                    "legal",
                    legalSectionRef
                  )
                }
              >
                <Scale size={20} />
                Legal Provisions
              </button>

              <button
                type="button"
                className={
                  activeSection ===
                  "chronology"
                    ? "cs-side-item active"
                    : "cs-side-item"
                }
                onClick={() =>
                  scrollToSection(
                    "chronology",
                    chronologySectionRef
                  )
                }
              >
                <ClipboardList
                  size={20}
                />

                Chronology
              </button>

              <button
                type="button"
                className={
                  activeSection ===
                  "summary"
                    ? "cs-side-item active"
                    : "cs-side-item"
                }
                onClick={() =>
                  scrollToSection(
                    "summary",
                    summarySectionRef
                  )
                }
              >
                <UserRound size={20} />
                Investigation Summary
              </button>

              <button
                type="button"
                className={
                  activeSection ===
                  "conclusion"
                    ? "cs-side-item active"
                    : "cs-side-item"
                }
                onClick={() =>
                  scrollToSection(
                    "conclusion",
                    conclusionSectionRef
                  )
                }
              >
                <FileCheck2
                  size={20}
                />

                Conclusion
              </button>

              <button
                type="button"
                className={
                  activeSection ===
                  "record"
                    ? "cs-side-item active"
                    : "cs-side-item"
                }
                onClick={() =>
                  scrollToSection(
                    "record",
                    recordSectionRef
                  )
                }
              >
                <ClipboardList
                  size={20}
                />

                Record Status
              </button>

              <button
                type="button"
                className={
                  activeSection ===
                  "signatures"
                    ? "cs-side-item active"
                    : "cs-side-item"
                }
                onClick={() =>
                  scrollToSection(
                    "signatures",
                    signatureSectionRef
                  )
                }
              >
                <ShieldCheck
                  size={20}
                />

                Verification
              </button>

              {/* READINESS */}

              {readiness && (
                <section className="cs-readiness">
                  <span>
                    DOCUMENT READINESS
                  </span>

                  <strong>
                    {readiness.complete}/
                    {readiness.total} complete
                  </strong>

                  {Array.isArray(
                    readiness.checks
                  ) &&
                    readiness.checks.map(
                      (item) => (
                        <div
                          key={
                            item.key ||
                            item.label
                          }
                          className={
                            item.complete
                              ? "done"
                              : "pending"
                          }
                        >
                          <b>
                            {item.complete
                              ? "✓"
                              : "!"}
                          </b>

                          <small>
                            {item.label}
                          </small>
                        </div>
                      )
                    )}

                  {!readiness.ready &&
                    readiness.attention_required >
                      0 && (
                      <p>
                        {
                          readiness.attention_required
                        }{" "}
                        item
                        {readiness.attention_required ===
                        1
                          ? ""
                          : "s"}{" "}
                        require attention.
                      </p>
                    )}
                </section>
              )}

              {/* DOCUMENT STATUS */}

              <section className="cs-document-status">
                <h3>
                  Document Status
                </h3>

                <span className="cs-ready-chip">
                  {filingStatus}
                </span>

                <p>
                  Prepared On
                </p>

                <strong>
                  {formatDate(
                    chargesheet.prepared_at,
                    true
                  )}
                </strong>

                <small>
                  by {officerId}
                </small>
              </section>
            </div>
          </aside>

          {/* ===========================================
              DOCUMENT
              =========================================== */}

          <section className="cs-preview-area">
            <article className="cs-paper">
              <div className="cs-paper-inner">
                {/* =====================================
                    HEADER
                    ===================================== */}

                <header className="cs-document-header">
                  <div className="cs-government-emblem">
                    <div className="cs-emblem-crown">
                      ♛
                    </div>

                    <div className="cs-emblem-pillar">
                      III
                    </div>

                    <strong>
                      सत्यमेव जयते
                    </strong>
                  </div>

                  <div className="cs-doc-station">
                    <div>
                      <span>
                        POLICE STATION :
                      </span>

                      <strong>
                        {display(
                          caseData?.police_station
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        DATE :
                      </span>

                      <strong>
                        {formatDate(
                          chargesheet.prepared_at
                        )}
                      </strong>
                    </div>
                  </div>

                  <h1>
                    CHARGESHEET
                  </h1>

                  <p className="cs-document-subtitle">
                    Investigation Report for
                    Official Review
                  </p>
                </header>

                <div className="cs-ornamental-line">
                  <span />
                  <i>✦</i>
                  <span />
                </div>

                {/* =====================================
                    1. CASE INFORMATION
                    ===================================== */}

                <section
                  ref={caseSectionRef}
                  className="cs-doc-section"
                >
                  <h2>
                    <span>1.</span>
                    CASE INFORMATION
                  </h2>

                  <div className="cs-info-grid">
                    <div>
                      <span>
                        FIR Number
                      </span>

                      <strong>
                        {display(
                          caseData?.fir_number
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Date of FIR
                      </span>

                      <strong>
                        {formatDate(
                          caseData?.registered_on
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Police Station
                      </span>

                      <strong>
                        {display(
                          caseData?.police_station
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Case ID
                      </span>

                      <strong>
                        {display(
                          caseData?.case_id
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="cs-full-field">
                    <span>
                      Case Title
                    </span>

                    <strong>
                      {display(
                        caseData?.title
                      )}
                    </strong>
                  </div>

                  <div className="cs-full-field">
                    <span>
                      Offences / Nature of Case
                    </span>

                    <strong>
                      {display(
                        valueOf(
                          caseData,
                          "offence",
                          "offence_name",
                          "nature_of_case"
                        )
                      )}
                    </strong>
                  </div>

                  <div className="cs-full-field">
                    <span>
                      Case Description
                    </span>

                    <strong>
                      {display(
                        caseData?.description
                      )}
                    </strong>
                  </div>
                </section>

                {/* =====================================
                    2. ACCUSED / PERSONS
                    ===================================== */}

                <section
                  ref={personsSectionRef}
                  className="cs-doc-section"
                >
                  <h2>
                    <span>2.</span>

                    ACCUSED / PERSONS INVOLVED
                  </h2>

                  {persons.length ===
                  0 ? (
                    <p>
                      No linked person records
                      are available for this
                      case.
                    </p>
                  ) : (
                    <div className="cs-record-table">
                      {persons.map(
                        (
                          item,
                          index
                        ) => {
                          const person =
                            normalizePerson(
                              item
                            );

                          return (
                            <div
                              key={
                                person.personId ||
                                index
                              }
                              style={{
                                gridColumn:
                                  "1 / -1",
                              }}
                            >
                              <span>
                                {display(
                                  person.personId
                                )}{" "}
                                •{" "}
                                {display(
                                  person.role
                                )}
                              </span>

                              <strong>
                                {display(
                                  person.name
                                )}
                              </strong>

                              <small>
                                Status:{" "}
                                {display(
                                  person.status
                                )}

                                {person.gender
                                  ? ` • Gender: ${person.gender}`
                                  : ""}

                                {person.phone
                                  ? ` • Phone: ${person.phone}`
                                  : ""}
                              </small>

                              {person.address && (
                                <small>
                                  Address:{" "}
                                  {
                                    person.address
                                  }
                                </small>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </section>

                {/* =====================================
                    3. EVIDENCE
                    ===================================== */}

                <section
                  ref={evidenceSectionRef}
                  className="cs-doc-section"
                >
                  <h2>
                    <span>3.</span>
                    EVIDENCE RELIED UPON
                  </h2>

                  {evidence.length ===
                  0 ? (
                    <p>
                      No evidence records are
                      linked to this case.
                    </p>
                  ) : (
                    <div className="cs-record-table">
                      {evidence.map(
                        (
                          item,
                          index
                        ) => {
                          const record =
                            normalizeEvidence(
                              item
                            );

                          return (
                            <div
                              key={
                                record.id ||
                                index
                              }
                              style={{
                                gridColumn:
                                  "1 / -1",
                              }}
                            >
                              <span>
                                Evidence ID
                              </span>

                              <strong>
                                {display(
                                  record.id
                                )}

                                {" • "}

                                {display(
                                  record.type
                                )}
                              </strong>

                              <small>
                                File:{" "}
                                {display(
                                  record.fileName
                                )}
                              </small>

                              <small>
                                Source:{" "}
                                {display(
                                  record.source
                                )}

                                {" • "}

                                Collected By:{" "}

                                {display(
                                  record.collectedBy
                                )}
                              </small>

                              <small>
                                Collected On:{" "}
                                {formatDate(
                                  record.collectedAt,
                                  true
                                )}
                              </small>

                              {record.linkedPerson && (
                                <small>
                                  Linked Person:{" "}
                                  {
                                    record.linkedPerson
                                  }
                                </small>
                              )}

                              <small>
                                SHA-256:{" "}
                                {display(
                                  record.sha256
                                )}
                              </small>

                              <small>
                                Integrity:{" "}
                                {display(
                                  record.integrity
                                )}

                                {" • "}

                                Custody:{" "}

                                {display(
                                  record.custody
                                )}
                              </small>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </section>

                {/* =====================================
                    4. LEGAL PROVISIONS
                    ===================================== */}

                <section
                  ref={legalSectionRef}
                  className="cs-doc-section"
                >
                  <h2>
                    <span>4.</span>
                    LEGAL PROVISIONS INVOKED
                  </h2>

                  {legalProvisions.length ===
                  0 ? (
                    <p>
                      No confirmed legal
                      provisions are currently
                      recorded for this case.
                    </p>
                  ) : (
                    legalProvisions.map(
                      (
                        item,
                        index
                      ) => {
                        const legal =
                          normalizeLegal(
                            item
                          );

                        return (
                          <p
                            key={
                              `${legal.framework || ""}-${legal.number || ""}-${index}`
                            }
                            style={{
                              marginBottom:
                                index ===
                                legalProvisions.length -
                                  1
                                  ? 0
                                  : 12,
                            }}
                          >
                            <strong>
                              {[
                                legal.framework,
                                legal.number,
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(
                                  " "
                                )}

                              {legal.title
                                ? ` — ${legal.title}`
                                : ""}
                            </strong>

                            {legal.status
                              ? ` [${legal.status}]`
                              : ""}

                            {legal.legacy
                              ? ` (Cross-reference: ${legal.legacy})`
                              : ""}

                            {legal.reason
                              ? ` — ${legal.reason}`
                              : ""}
                          </p>
                        );
                      }
                    )
                  )}
                </section>

                {/* =====================================
                    5. CHRONOLOGY
                    ===================================== */}

                <section
                  ref={
                    chronologySectionRef
                  }
                  className="cs-doc-section"
                >
                  <h2>
                    <span>5.</span>
                    CHRONOLOGY OF EVENTS
                  </h2>

                  {chronology.length ===
                  0 ? (
                    <p>
                      No timeline records are
                      available for this case.
                    </p>
                  ) : (
                    <div className="cs-record-table">
                      {chronology.map(
                        (
                          item,
                          index
                        ) => {
                          const event =
                            normalizeTimeline(
                              item
                            );

                          return (
                            <div
                              key={
                                `${event.date || ""}-${index}`
                              }
                              style={{
                                gridColumn:
                                  "1 / -1",
                              }}
                            >
                              <span>
                                {formatDate(
                                  event.date,
                                  true
                                )}

                                {" • "}

                                {display(
                                  event.type
                                )}
                              </span>

                              <strong>
                                {display(
                                  event.title
                                )}
                              </strong>

                              <small>
                                {display(
                                  event.description
                                )}
                              </small>

                              {event.source && (
                                <small>
                                  Source:{" "}
                                  {
                                    event.source
                                  }
                                </small>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </section>

                {/* =====================================
                    6. INVESTIGATION SUMMARY
                    ===================================== */}

                <section
                  ref={summarySectionRef}
                  className="cs-doc-section"
                >
                  <h2>
                    <span>6.</span>

                    INVESTIGATION SUMMARY
                  </h2>

                  <p>
                    {display(
                      chargesheet.investigation_summary
                    )}
                  </p>
                </section>

                {/* =====================================
                    7. CONCLUSION
                    ===================================== */}

                <section
                  ref={
                    conclusionSectionRef
                  }
                  className="cs-doc-section"
                >
                  <h2>
                    <span>7.</span>

                    INVESTIGATION CONCLUSION
                  </h2>

                  <p>
                    {display(
                      chargesheet.conclusion
                    )}
                  </p>
                </section>

                {/* =====================================
                    8. RECORD STATUS
                    ===================================== */}

                <section
                  ref={recordSectionRef}
                  className="cs-doc-section"
                >
                  <h2>
                    <span>8.</span>
                    RECORD STATUS
                  </h2>

                  <div className="cs-record-table">
                    <div>
                      <span>
                        Chargesheet ID
                      </span>

                      <strong>
                        {display(
                          chargesheet.chargesheet_id
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Filing Status
                      </span>

                      <strong>
                        {filingStatus}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Prepared By
                      </span>

                      <strong>
                        {officerId}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Prepared On
                      </span>

                      <strong>
                        {formatDate(
                          chargesheet.prepared_at
                        )}
                      </strong>
                    </div>
                  </div>
                </section>

                {/* =====================================
                    SIGNATURES
                    ===================================== */}

                <section
                  ref={
                    signatureSectionRef
                  }
                  className="cs-signature-block"
                >
                  {/* INVESTIGATING OFFICER */}

                  <div className="cs-signature-person">
                    <h3>
                      INVESTIGATING OFFICER
                    </h3>

                    <div className="cs-signature-script">
                      {officerName}
                    </div>

                    <div className="cs-signature-details">
                      <div>
                        <span>
                          Name
                        </span>

                        <strong>
                          {officerName}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Rank
                        </span>

                        <strong>
                          {
                            officerDesignation
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Officer ID
                        </span>

                        <strong>
                          {officerId}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Police Station
                        </span>

                        <strong>
                          {display(
                            caseData?.police_station
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Date
                        </span>

                        <strong>
                          {formatDate(
                            chargesheet.prepared_at
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* STAMP */}

                  <div className="cs-red-stamp">
                    <div className="cs-red-stamp-ring">
                      <span className="stamp-top">
                        POLICE DEPARTMENT
                      </span>

                      <ShieldCheck
                        size={45}
                        strokeWidth={
                          1.25
                        }
                      />

                      <strong>
                        {sealLabel}
                      </strong>

                      <span className="stamp-bottom">
                        CINTRA • OFFICIAL
                      </span>
                    </div>
                  </div>

                  {/* VERIFIED BY */}

                  <div className="cs-signature-person">
                    <h3>
                      FORWARDED / VERIFIED BY
                    </h3>

                    <div className="cs-signature-script">
                      {verifierName}
                    </div>

                    <div className="cs-signature-details">
                      <div>
                        <span>
                          Name
                        </span>

                        <strong>
                          {verifierName}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Rank
                        </span>

                        <strong>
                          {
                            verifierDesignation
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Status
                        </span>

                        <strong>
                          {
                            verificationStatus
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Police Station
                        </span>

                        <strong>
                          {display(
                            caseData?.police_station
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Date
                        </span>

                        <strong>
                          {formatDate(
                            valueOf(
                              verification,
                              "verified_at",
                              "verification_date",
                              "updated_at"
                            )
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="cs-document-note">
                  COMPUTER GENERATED COPY •
                  CINTRA INVESTIGATION RECORD
                </div>
              </div>
            </article>

            {/* ===========================================
                BUTTONS
                =========================================== */}

            <div className="cs-bottom-actions">
              <button
                type="button"
                className="cs-action-secondary"
                onClick={
                  refreshDraft
                }
                disabled={
                  saving ||
                  generating
                }
              >
                {saving ? (
                  <Loader2
                    size={16}
                    className="cs-spinner"
                  />
                ) : (
                  <RefreshCw
                    size={16}
                  />
                )}

                {saving
                  ? "Refreshing..."
                  : "Refresh Draft"}
              </button>

              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="cs-action-secondary"
                >
                  <Eye size={16} />
                  Open PDF
                </a>
              )}

              {pdfUrl && (
                <a
                  href={pdfUrl}
                  download
                  className="cs-action-secondary"
                >
                  <Download
                    size={16}
                  />
                  Download PDF
                </a>
              )}

              <button
                type="button"
                className="cs-action-primary"
                onClick={
                  generatePdf
                }
                disabled={
                  generating ||
                  saving
                }
              >
                {generating ? (
                  <Loader2
                    size={16}
                    className="cs-spinner"
                  />
                ) : (
                  <Download
                    size={16}
                  />
                )}

                {generating
                  ? "Generating..."
                  : "Generate PDF"}
              </button>
            </div>
          </section>
        </main>
      )}

      {/* ===============================================
          FOOTER
          =============================================== */}

      <footer className="cs-footer">
        <div>
          <ShieldCheck
            size={15}
          />

          CINTRA v2.1.0
        </div>

        <span>
          Secure. Intelligent. Responsive.
        </span>

        <span>
          © 2026 CINTRA
        </span>
      </footer>
    </div>
  );
}

export default ChargesheetPreview;
