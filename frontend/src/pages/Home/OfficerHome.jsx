import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Clock3,
  FileText,
  Camera,
  Phone,
  MapPin,
  Plus,
  UserRound,
  FolderOpen,
  Upload,
  Search,
  ChevronRight,
  ArrowRight,
  Star,
  ShieldCheck,
} from "lucide-react";

import AppHeader from "../../components/layout/AppHeader";
import "./OfficerHome.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("cintra_token") ||
    sessionStorage.getItem("cintra_token")
  );
}

function getStoredOfficer() {
  const storedOfficer =
    localStorage.getItem("cintra_officer") ||
    sessionStorage.getItem("cintra_officer");

  if (!storedOfficer) {
    return null;
  }

  try {
    return JSON.parse(storedOfficer);
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

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
  if (!value) {
    return "—";
  }

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

function getCaseIdentifier(caseItem) {
  return (
    caseItem.case_id ||
    caseItem.case_number ||
    `CASE-${caseItem.id}`
  );
}

function getFirNumber(caseItem) {
  return (
    caseItem.fir_number ||
    caseItem.fir_no ||
    "—"
  );
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

function getCaseStatus(caseItem) {
  return caseItem.status || "Active";
}

function getLastUpdated(caseItem) {
  return (
    caseItem.updated_at ||
    caseItem.last_updated ||
    caseItem.created_at ||
    null
  );
}

function OfficerHome() {
  const navigate = useNavigate();

  const [officer, setOfficer] = useState(
    getStoredOfficer()
  );

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const token = getToken();

  useEffect(() => {
    async function loadHome() {
      if (!token) {
        navigate("/", {
          replace: true,
        });

        return;
      }

      try {
        setLoading(true);
        setMessage("");

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [
          officerResponse,
          casesResponse,
        ] = await Promise.all([
          fetch(
            `${API_BASE_URL}/auth/me`,
            {
              headers,
            }
          ),

          fetch(
            `${API_BASE_URL}/cases/`,
            {
              headers,
            }
          ),
        ]);

        if (
          officerResponse.status === 401 ||
          casesResponse.status === 401
        ) {
          localStorage.removeItem(
            "cintra_token"
          );

          localStorage.removeItem(
            "cintra_officer"
          );

          sessionStorage.removeItem(
            "cintra_token"
          );

          sessionStorage.removeItem(
            "cintra_officer"
          );

          navigate("/", {
            replace: true,
          });

          return;
        }

        if (officerResponse.ok) {
          const officerData =
            await officerResponse.json();

          setOfficer(officerData);
        }

        if (casesResponse.ok) {
          const caseData =
            await casesResponse.json();

          if (Array.isArray(caseData)) {
            setCases(caseData);
          } else if (
            Array.isArray(caseData.cases)
          ) {
            setCases(caseData.cases);
          } else {
            setCases([]);
          }
        } else {
          setMessage(
            "Case records could not be loaded."
          );
        }
      } catch {
        setMessage(
          "Unable to connect to CINTRA services. Check that the backend is running."
        );
      } finally {
        setLoading(false);
      }
    }

    loadHome();
  }, [navigate, token]);

  const primaryCase = cases[0] || null;
  const visibleCases = cases.slice(0, 4);

  const officerId =
    officer?.officer_id ||
    officer?.id ||
    "Officer";

  const designation =
    officer?.designation ||
    "Investigating Officer";

  const policeStation =
    officer?.police_station ||
    officer?.station ||
    "Police Department";

  const currentDate = new Date();

  const displayDate =
    currentDate.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );

  const displayTime =
    currentDate.toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );

  return (
    <div className="officer-home">
      <AppHeader activePage="home" />

      <main className="home-main">
        <section className="welcome-row">
          <div className="welcome-copy">
            <div className="welcome-accent" />

            <div>
              <h1>
                Welcome, {officerId}
              </h1>

              <p>
                {designation}

                <span className="welcome-dot">
                  •
                </span>

                {policeStation}
              </p>
            </div>
          </div>

          <div className="date-time">
            <div>
              <CalendarDays
                size={19}
                strokeWidth={1.8}
              />

              <strong>
                {displayDate}
              </strong>
            </div>

            <span className="date-divider" />

            <div>
              <Clock3
                size={19}
                strokeWidth={1.8}
              />

              <strong>
                {displayTime}
              </strong>
            </div>
          </div>
        </section>

        {message && (
          <div className="home-message">
            {message}
          </div>
        )}

        <div className="home-grid">
          <div className="home-left-column">
            <section className="home-panel continue-panel">
              <div className="section-heading">
                <h2>
                  CONTINUE INVESTIGATION
                </h2>

                <span />
              </div>

              {loading ? (
                <div className="home-loading">
                  Loading investigation records...
                </div>
              ) : primaryCase ? (
                <div className="continue-case">
                  <button
                    type="button"
                    className="continue-tile"
                    onClick={() =>
                      navigate(
                        `/cases/${primaryCase.id}`
                      )
                    }
                  >
                    <FolderOpen
                      size={36}
                      strokeWidth={1.5}
                    />

                    <strong>
                      Continue
                    </strong>

                    <strong>
                      Investigation
                    </strong>

                    <ArrowRight size={24} />
                  </button>

                  <div className="continue-details">
                    <div className="continue-title-row">
                      <div>
                        <div className="case-title-line">
                          <h3>
                            {getCaseIdentifier(
                              primaryCase
                            )}
                          </h3>

                          <Star
                            size={22}
                            strokeWidth={1.7}
                          />
                        </div>

                        <h4>
                          {getCaseTitle(
                            primaryCase
                          )}
                        </h4>

                        <p>
                          {getPoliceStation(
                            primaryCase
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="primary-action"
                        onClick={() =>
                          navigate(
                            `/cases/${primaryCase.id}`
                          )
                        }
                      >
                        Continue Case

                        <ArrowRight
                          size={18}
                        />
                      </button>
                    </div>

                    <div className="case-metadata">
                      <div>
                        <span>
                          FIR No.
                        </span>

                        <strong>
                          {getFirNumber(
                            primaryCase
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Case Date
                        </span>

                        <strong>
                          {formatDate(
                            primaryCase.fir_date ||
                              primaryCase.case_date ||
                              primaryCase.created_at
                          )}
                        </strong>
                      </div>

                      <div className="metadata-wide">
                        <span>
                          Last Updated
                        </span>

                        <strong>
                          {formatDateTime(
                            getLastUpdated(
                              primaryCase
                            )
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Status
                        </span>

                        <strong>
                          {getCaseStatus(
                            primaryCase
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="home-empty">
                  <FolderOpen
                    size={28}
                    strokeWidth={1.5}
                  />

                  <div>
                    <strong>
                      No cases available
                    </strong>

                    <span>
                      Investigation cases will
                      appear here when assigned.
                    </span>
                  </div>
                </div>
              )}
            </section>

            <section className="home-panel cases-panel">
              <div className="cases-panel-heading">
                <div className="section-heading">
                  <h2>MY CASES</h2>
                  <span />
                </div>

                <button
                  type="button"
                  className="text-action"
                  onClick={() =>
                    navigate("/cases")
                  }
                >
                  View All Cases
                </button>
              </div>

              <div className="cases-table-wrapper">
                <table className="cases-table">
                  <thead>
                    <tr>
                      <th>Case ID</th>
                      <th>FIR No.</th>
                      <th>Crime / Case</th>
                      <th>
                        Police Station
                      </th>
                      <th>Status</th>
                      <th>
                        Last Updated
                      </th>
                      <th aria-label="Open case" />
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan="7"
                          className="table-message"
                        >
                          Loading cases...
                        </td>
                      </tr>
                    ) : visibleCases.length > 0 ? (
                      visibleCases.map(
                        (caseItem) => (
                          <tr
                            key={caseItem.id}
                            onClick={() =>
                              navigate(
                                `/cases/${caseItem.id}`
                              )
                            }
                          >
                            <td className="case-link">
                              {getCaseIdentifier(
                                caseItem
                              )}
                            </td>

                            <td>
                              {getFirNumber(
                                caseItem
                              )}
                            </td>

                            <td>
                              <strong>
                                {getCaseTitle(
                                  caseItem
                                )}
                              </strong>

                              {caseItem.sections && (
                                <span>
                                  {
                                    caseItem.sections
                                  }
                                </span>
                              )}
                            </td>

                            <td>
                              {getPoliceStation(
                                caseItem
                              )}
                            </td>

                            <td>
                              {getCaseStatus(
                                caseItem
                              )}
                            </td>

                            <td>
                              {formatDateTime(
                                getLastUpdated(
                                  caseItem
                                )
                              )}
                            </td>

                            <td className="row-arrow">
                              <ChevronRight
                                size={18}
                              />
                            </td>
                          </tr>
                        )
                      )
                    ) : (
                      <tr>
                        <td
                          colSpan="7"
                          className="table-message"
                        >
                          No cases found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="home-right-column">
            <section className="home-panel pending-panel">
              <div className="section-heading">
                <h2>
                  PENDING ATTENTION
                </h2>

                <span />
              </div>

              <div className="pending-list">
                <div className="pending-item">
                  <FileText
                    size={24}
                    strokeWidth={1.6}
                  />

                  <div>
                    <strong>
                      Statements to be Recorded
                    </strong>

                    <span>
                      Review required case
                      records
                    </span>
                  </div>
                </div>

                <div className="pending-item">
                  <Camera
                    size={24}
                    strokeWidth={1.6}
                  />

                  <div>
                    <strong>
                      Evidence Pending
                      Verification
                    </strong>

                    <span>
                      Review submitted
                      evidence
                    </span>
                  </div>
                </div>

                <div className="pending-item">
                  <Phone
                    size={24}
                    strokeWidth={1.6}
                  />

                  <div>
                    <strong>
                      CDR / Digital Records
                      to Review
                    </strong>

                    <span>
                      Review available digital
                      records
                    </span>
                  </div>
                </div>

                <div className="pending-item">
                  <MapPin
                    size={24}
                    strokeWidth={1.6}
                  />

                  <div>
                    <strong>
                      Site Visit / Spot
                      Verification
                    </strong>

                    <span>
                      Check investigation
                      requirements
                    </span>
                  </div>
                </div>
              </div>

              <div className="pending-footer">
                <span>
                  Case-specific actions
                </span>

                <ArrowRight size={17} />
              </div>
            </section>

            <section className="home-panel quick-panel">
              <div className="section-heading">
                <h2>QUICK ACCESS</h2>
                <span />
              </div>

              <div className="quick-list">
                <button
                  type="button"
                  onClick={() =>
                    navigate("/cases")
                  }
                >
                  <Plus
                    size={21}
                    strokeWidth={1.7}
                  />

                  <span>Cases</span>

                  <ChevronRight
                    size={18}
                  />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/persons")
                  }
                >
                  <UserRound
                    size={21}
                    strokeWidth={1.7}
                  />

                  <span>Persons</span>

                  <ChevronRight
                    size={18}
                  />
                </button>

                <button type="button">
                  <FolderOpen
                    size={21}
                    strokeWidth={1.7}
                  />

                  <span>Evidence</span>

                  <ChevronRight
                    size={18}
                  />
                </button>

                <button type="button">
                  <Upload
                    size={21}
                    strokeWidth={1.7}
                  />

                  <span>
                    Upload Document
                  </span>

                  <ChevronRight
                    size={18}
                  />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/search")
                  }
                >
                  <Search
                    size={21}
                    strokeWidth={1.7}
                  />

                  <span>
                    Search Records
                  </span>

                  <ChevronRight
                    size={18}
                  />
                </button>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <footer className="cintra-footer">
        <div>
          <ShieldCheck
            size={20}
            strokeWidth={1.7}
          />

          <span>
            Secure. Intelligent. Responsive.
          </span>
        </div>

        <span>
          © 2026 CINTRA. All rights reserved.
        </span>

        <div className="footer-links">
          <span>Privacy Policy</span>
          <span>Terms of Use</span>
          <span>Help &amp; Support</span>
        </div>
      </footer>
    </div>
  );
}

export default OfficerHome;
