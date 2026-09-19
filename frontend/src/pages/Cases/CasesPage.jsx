import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

import AppHeader from "../../components/layout/AppHeader";
import "./CasesPage.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("cintra_token") ||
    sessionStorage.getItem("cintra_token")
  );
}

function getStoredOfficer() {
  const stored =
    localStorage.getItem("cintra_officer") ||
    sessionStorage.getItem("cintra_officer");

  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function clearStoredAuth() {
  localStorage.removeItem("cintra_token");
  localStorage.removeItem("cintra_officer");
  sessionStorage.removeItem("cintra_token");
  sessionStorage.removeItem("cintra_officer");
}

function getCaseIdentifier(caseItem) {
  return (
    caseItem.case_id ||
    caseItem.case_number ||
    `CASE-${caseItem.id}`
  );
}

function getFirNumber(caseItem) {
  return caseItem.fir_number || caseItem.fir_no || "—";
}

function getCaseTitle(caseItem) {
  return (
    caseItem.title ||
    caseItem.crime_type ||
    "Untitled Case"
  );
}

function getPoliceStation(caseItem) {
  return (
    caseItem.police_station ||
    caseItem.station ||
    caseItem.police_station_name ||
    "—"
  );
}

function getStatus(caseItem) {
  return caseItem.stage || caseItem.status || "Investigation";
}

function getCaseDate(caseItem) {
  return (
    caseItem.registered_on ||
    caseItem.case_date ||
    caseItem.created_at ||
    null
  );
}

function getUpdatedAt(caseItem) {
  return (
    caseItem.last_updated ||
    caseItem.updated_at ||
    caseItem.created_at ||
    null
  );
}

function getOfficer(caseItem) {
  return (
    caseItem.investigating_officer ||
    caseItem.officer_id ||
    "Not assigned"
  );
}

function getCrimeType(caseItem) {
  return (
    caseItem.crime_type ||
    caseItem.title ||
    caseItem.offence ||
    "—"
  );
}

function getYear(caseItem) {
  const value = getCaseDate(caseItem);

  if (!value) return "";

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return String(date.getFullYear());
  }

  const match = String(value).match(/\b(20\d{2})\b/);
  return match ? match[1] : "";
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

function isSwaggerTestRecord(caseItem) {
  const values = [
    caseItem.case_id,
    caseItem.case_number,
    caseItem.title,
    caseItem.crime_type,
    caseItem.fir_number,
    caseItem.fir_no,
    caseItem.police_station,
    caseItem.station,
  ]
    .map((value) => String(value || "").trim().toLowerCase());

  return values.some((value) => value === "string");
}

function stageClass(stage) {
  const value = String(stage || "").toLowerCase();

  if (value.includes("evidence")) return "orange";
  if (value.includes("review")) return "gold";
  if (value.includes("closed") || value.includes("filed")) {
    return "green";
  }

  return "blue";
}

function getPendingText(caseItem) {
  return (
    caseItem.pending ||
    caseItem.pending_action ||
    caseItem.next_action ||
    "—"
  );
}

function getInitialForm() {
  const officer = getStoredOfficer();

  return {
    case_id: "",
    fir_number: "",
    title: "",
    offence: "",
    police_station: "",
    investigating_officer:
      officer?.officer_id ||
      officer?.id ||
      "SH123",
    stage: "Under Investigation",
    status: "Active",
  };
}

function CasesPage() {
  const navigate = useNavigate();

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [stationFilter, setStationFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [crimeFilter, setCrimeFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [newCaseForm, setNewCaseForm] = useState(getInitialForm());
  const [savingCase, setSavingCase] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  async function authenticatedFetch(url, options = {}) {
    const token = getToken();

    if (!token) {
      clearStoredAuth();
      navigate("/", { replace: true });
      return null;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      clearStoredAuth();
      navigate("/", { replace: true });
      return null;
    }

    return response;
  }

  async function loadCases() {
    try {
      setLoading(true);
      setMessage("");

      const response = await authenticatedFetch(
        `${API_BASE_URL}/cases/`
      );

      if (!response) return;

      if (!response.ok) {
        throw new Error("Case records could not be loaded.");
      }

      const result = await response.json();

      const caseList = Array.isArray(result)
        ? result
        : Array.isArray(result?.cases)
          ? result.cases
          : [];

      setCases(
        caseList.filter(
          (caseItem) => !isSwaggerTestRecord(caseItem)
        )
      );
    } catch (error) {
      console.error("Cases page error:", error);

      setMessage(
        error.message ||
          "Unable to connect to CINTRA services."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCases();
  }, []);

  const stationOptions = useMemo(() => {
    return Array.from(
      new Set(
        cases
          .map(getPoliceStation)
          .filter((value) => value && value !== "—")
      )
    ).sort();
  }, [cases]);

  const statusOptions = useMemo(() => {
    return Array.from(
      new Set(
        cases
          .map(getStatus)
          .filter(Boolean)
      )
    ).sort();
  }, [cases]);

  const crimeOptions = useMemo(() => {
    return Array.from(
      new Set(
        cases
          .map(getCrimeType)
          .filter((value) => value && value !== "—")
      )
    ).sort();
  }, [cases]);

  const yearOptions = useMemo(() => {
    return Array.from(
      new Set(
        cases
          .map(getYear)
          .filter(Boolean)
      )
    ).sort((a, b) => Number(b) - Number(a));
  }, [cases]);

  const filteredCases = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return cases.filter((caseItem) => {
      if (
        stationFilter !== "All" &&
        getPoliceStation(caseItem) !== stationFilter
      ) {
        return false;
      }

      if (
        statusFilter !== "All" &&
        getStatus(caseItem) !== statusFilter
      ) {
        return false;
      }

      if (
        crimeFilter !== "All" &&
        getCrimeType(caseItem) !== crimeFilter
      ) {
        return false;
      }

      if (
        yearFilter !== "All" &&
        getYear(caseItem) !== yearFilter
      ) {
        return false;
      }

      if (!query) return true;

      const searchable = [
        getCaseIdentifier(caseItem),
        getFirNumber(caseItem),
        getCaseTitle(caseItem),
        caseItem.offence,
        getPoliceStation(caseItem),
        getOfficer(caseItem),
        getStatus(caseItem),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    cases,
    searchTerm,
    stationFilter,
    statusFilter,
    crimeFilter,
    yearFilter,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    stationFilter,
    statusFilter,
    crimeFilter,
    yearFilter,
    pageSize,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCases.length / pageSize)
  );

  const safePage = Math.min(page, totalPages);

  const visibleCases = filteredCases.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const firstRecord =
    filteredCases.length === 0
      ? 0
      : (safePage - 1) * pageSize + 1;

  const lastRecord = Math.min(
    safePage * pageSize,
    filteredCases.length
  );

  function runSearch(event) {
    event?.preventDefault();
    setSearchTerm(searchDraft);
  }

  function resetFilters() {
    setSearchDraft("");
    setSearchTerm("");
    setStationFilter("All");
    setStatusFilter("All");
    setCrimeFilter("All");
    setYearFilter("All");
    setPage(1);
  }

  function openNewCase() {
    setNewCaseForm(getInitialForm());
    setFormMessage("");
    setNewCaseOpen(true);
  }

  function closeNewCase() {
    if (savingCase) return;

    setNewCaseOpen(false);
    setFormMessage("");
  }

  function updateFormField(event) {
    const { name, value } = event.target;

    setNewCaseForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function createCase(event) {
    event.preventDefault();

    const requiredFields = [
      "case_id",
      "fir_number",
      "title",
      "offence",
      "police_station",
    ];

    const missing = requiredFields.find(
      (field) =>
        !String(newCaseForm[field] || "").trim()
    );

    if (missing) {
      setFormMessage(
        "Complete all required fields before saving the case."
      );
      return;
    }

    try {
      setSavingCase(true);
      setFormMessage("");

      const payload = {
        case_id: newCaseForm.case_id.trim(),
        fir_number: newCaseForm.fir_number.trim(),
        title: newCaseForm.title.trim(),
        offence: newCaseForm.offence.trim(),
        police_station:
          newCaseForm.police_station.trim(),
        investigating_officer:
          newCaseForm.investigating_officer.trim(),
        stage: newCaseForm.stage,
        status: newCaseForm.status,
      };

      const response = await authenticatedFetch(
        `${API_BASE_URL}/cases/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response) return;

      let result = {};

      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        let errorText =
          "Case record could not be created.";

        if (typeof result?.detail === "string") {
          errorText = result.detail;
        } else if (Array.isArray(result?.detail)) {
          errorText = result.detail
            .map((item) => item?.msg)
            .filter(Boolean)
            .join(" ");
        }

        throw new Error(errorText);
      }

      setNewCaseOpen(false);
      setNewCaseForm(getInitialForm());
      setMessage("Case record created successfully.");

      await loadCases();

      if (result?.id) {
        navigate(`/cases/${result.id}`);
      }
    } catch (error) {
      console.error("Create case error:", error);

      setFormMessage(
        error.message ||
          "Unable to create the case record."
      );
    } finally {
      setSavingCase(false);
    }
  }

  return (
    <div className="cases-page">
      <AppHeader activePage="cases" />

      <main className="cases-main">
        <section className="cases-title-row">
          <div>
            <h1>Cases</h1>

            <p>
              South District
              <span className="cases-title-dot">•</span>
              {cases.length} active records
            </p>
          </div>

          <button
            type="button"
            className="cases-new-button"
            onClick={openNewCase}
          >
            <Plus size={19} strokeWidth={1.8} />
            Register Case
          </button>
        </section>

        <form
          className="cases-toolbar"
          onSubmit={runSearch}
        >
          <div className="cases-search-field">
            <Search size={19} strokeWidth={1.8} />

            <input
              value={searchDraft}
              onChange={(event) =>
                setSearchDraft(event.target.value)
              }
              placeholder="Search by Case ID, FIR No., or Offence"
            />
          </div>

          <label className="cases-filter-field">
            <span>Police Station</span>

            <div>
              <select
                value={stationFilter}
                onChange={(event) =>
                  setStationFilter(event.target.value)
                }
              >
                <option value="All">All</option>

                {stationOptions.map((station) => (
                  <option
                    key={station}
                    value={station}
                  >
                    {station}
                  </option>
                ))}
              </select>

              <ChevronDown size={15} />
            </div>
          </label>

          <label className="cases-filter-field">
            <span>Status</span>

            <div>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="All">All</option>

                {statusOptions.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                ))}
              </select>

              <ChevronDown size={15} />
            </div>
          </label>

          <label className="cases-filter-field">
            <span>Crime Type</span>

            <div>
              <select
                value={crimeFilter}
                onChange={(event) =>
                  setCrimeFilter(event.target.value)
                }
              >
                <option value="All">All</option>

                {crimeOptions.map((crime) => (
                  <option
                    key={crime}
                    value={crime}
                  >
                    {crime}
                  </option>
                ))}
              </select>

              <ChevronDown size={15} />
            </div>
          </label>

          <label className="cases-filter-field cases-year-filter">
            <span>Year</span>

            <div>
              <select
                value={yearFilter}
                onChange={(event) =>
                  setYearFilter(event.target.value)
                }
              >
                <option value="All">All</option>

                {yearOptions.map((year) => (
                  <option
                    key={year}
                    value={year}
                  >
                    {year}
                  </option>
                ))}
              </select>

              <ChevronDown size={15} />
            </div>
          </label>

          <button
            type="submit"
            className="cases-search-button"
          >
            <Search size={17} />
            Search
          </button>

          <button
            type="button"
            className="cases-reset-button"
            onClick={resetFilters}
          >
            <RefreshCw size={16} />
            Reset
          </button>
        </form>

        {message && (
          <div className="cases-message">
            {message}
          </div>
        )}

        <section className="cases-records">
          {loading ? (
            <div className="cases-loading">
              Loading case records...
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="cases-loading">
              No case records match your search.
            </div>
          ) : (
            <div className="cases-table-wrap">
              <table className="cases-table">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>FIR No.</th>
                    <th>Case / Offence</th>
                    <th>Police Station</th>
                    <th>Investigating Officer</th>
                    <th>Registered On</th>
                    <th>Stage</th>
                    <th>Pending</th>
                    <th>Last Updated</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {visibleCases.map((caseItem) => {
                    const stage = getStatus(caseItem);

                    return (
                      <tr
                        key={caseItem.id}
                        onClick={() =>
                          navigate(
                            `/cases/${caseItem.id}`
                          )
                        }
                      >
                        <td>
                          <strong className="cases-case-id">
                            {getCaseIdentifier(caseItem)}
                          </strong>
                        </td>

                        <td>
                          {getFirNumber(caseItem)}
                        </td>

                        <td>
                          <strong className="cases-case-title">
                            {getCaseTitle(caseItem)}
                          </strong>

                          {caseItem.offence && (
                            <span className="cases-case-offence">
                              {caseItem.offence}
                            </span>
                          )}
                        </td>

                        <td>
                          {getPoliceStation(caseItem)}
                        </td>

                        <td>
                          {getOfficer(caseItem)}
                        </td>

                        <td>
                          {formatDate(
                            getCaseDate(caseItem)
                          )}
                        </td>

                        <td>
                          <span className="cases-stage">
                            <i
                              className={`cases-stage-dot ${stageClass(
                                stage
                              )}`}
                            />

                            {stage}
                          </span>
                        </td>

                        <td>
                          {getPendingText(caseItem)}
                        </td>

                        <td>
                          {formatDateTime(
                            getUpdatedAt(caseItem)
                          )}
                        </td>

                        <td className="cases-arrow-cell">
                          <ChevronRight
                            size={17}
                            strokeWidth={1.8}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="cases-records-footer">
            <span>
              Showing {firstRecord} to {lastRecord} of{" "}
              {filteredCases.length} cases
            </span>

            <div className="cases-pagination">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() =>
                  setPage((current) =>
                    Math.max(1, current - 1)
                  )
                }
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>

              {Array.from(
                { length: Math.min(totalPages, 3) },
                (_, index) => index + 1
              ).map((pageNumber) => (
                <button
                  type="button"
                  key={pageNumber}
                  className={
                    safePage === pageNumber
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setPage(pageNumber)
                  }
                >
                  {pageNumber}
                </button>
              ))}

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() =>
                  setPage((current) =>
                    Math.min(
                      totalPages,
                      current + 1
                    )
                  )
                }
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>

              <select
                value={pageSize}
                onChange={(event) =>
                  setPageSize(
                    Number(event.target.value)
                  )
                }
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>

              <span>per page</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="cases-footer">
        <div>
          <ShieldCheck size={17} />
          <span>CINTRA v2.1.0</span>
          <i />
          <span>Internal Use Only</span>
        </div>

        <span>© 2026 CINTRA</span>

        <div>
          <span>Help</span>
          <i />
          <span>System Status</span>
        </div>
      </footer>

      {newCaseOpen && (
        <div
          className="cases-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeNewCase();
            }
          }}
        >
          <section
            className="cases-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-case-title"
          >
            <header className="cases-modal-header">
              <div>
                <span>CASE REGISTRATION</span>
                <h2 id="new-case-title">
                  Register Case
                </h2>

                <p>
                  Create a new investigation record in
                  CINTRA.
                </p>
              </div>

              <button
                type="button"
                className="cases-modal-close"
                onClick={closeNewCase}
                disabled={savingCase}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </header>

            <form
              className="cases-modal-form"
              onSubmit={createCase}
            >
              <div className="cases-form-grid">
                <label>
                  <span>Case ID *</span>
                  <input
                    name="case_id"
                    value={newCaseForm.case_id}
                    onChange={updateFormField}
                    placeholder="CIN-2026-0457"
                  />
                </label>

                <label>
                  <span>FIR Number *</span>
                  <input
                    name="fir_number"
                    value={newCaseForm.fir_number}
                    onChange={updateFormField}
                    placeholder="112/2026"
                  />
                </label>

                <label className="cases-form-wide">
                  <span>Case Title *</span>
                  <input
                    name="title"
                    value={newCaseForm.title}
                    onChange={updateFormField}
                    placeholder="Enter case title"
                  />
                </label>

                <label className="cases-form-wide">
                  <span>Offence *</span>
                  <input
                    name="offence"
                    value={newCaseForm.offence}
                    onChange={updateFormField}
                    placeholder="Enter offence / applicable sections"
                  />
                </label>

                <label>
                  <span>Police Station *</span>
                  <input
                    name="police_station"
                    value={
                      newCaseForm.police_station
                    }
                    onChange={updateFormField}
                    placeholder="Police station"
                  />
                </label>

                <label>
                  <span>
                    Investigating Officer
                  </span>
                  <input
                    name="investigating_officer"
                    value={
                      newCaseForm.investigating_officer
                    }
                    onChange={updateFormField}
                    placeholder="Officer ID"
                  />
                </label>

                <label>
                  <span>Investigation Stage</span>
                  <select
                    name="stage"
                    value={newCaseForm.stage}
                    onChange={updateFormField}
                  >
                    <option value="Under Investigation">
                      Under Investigation
                    </option>
                    <option value="Evidence Collection">
                      Evidence Collection
                    </option>
                    <option value="Analysis">
                      Analysis
                    </option>
                    <option value="Under Review">
                      Under Review
                    </option>
                    <option value="Chargesheet Preparation">
                      Chargesheet Preparation
                    </option>
                    <option value="Filed">
                      Filed
                    </option>
                  </select>
                </label>

                <label>
                  <span>Status</span>
                  <select
                    name="status"
                    value={newCaseForm.status}
                    onChange={updateFormField}
                  >
                    <option value="Active">
                      Active
                    </option>
                    <option value="Pending">
                      Pending
                    </option>
                    <option value="Closed">
                      Closed
                    </option>
                  </select>
                </label>
              </div>

              {formMessage && (
                <div className="cases-form-message">
                  {formMessage}
                </div>
              )}

              <div className="cases-modal-note">
                <ShieldCheck size={17} />
                This creates a permanent investigation
                record in the CINTRA backend.
              </div>

              <footer className="cases-modal-actions">
                <button
                  type="button"
                  className="cases-modal-cancel"
                  onClick={closeNewCase}
                  disabled={savingCase}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="cases-modal-save"
                  disabled={savingCase}
                >
                  <FilePlus2 size={16} />

                  {savingCase
                    ? "Registering..."
                    : "Register Case"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default CasesPage;
