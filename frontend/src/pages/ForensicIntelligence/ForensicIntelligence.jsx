import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  GitBranch,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import ForensicPageLayout from "../../components/layout/ForensicPageLayout.jsx";
import { getForensicCases } from "../../services/forensics.js";
import { featureApi } from "../../services/expandedFeatures.js";
import "../Shared/InvestigationSupport.css";

function text(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function normalizeLead(raw = {}) {
  return {
    id: raw.id,
    leadType: text(raw.lead_type, raw.type, raw.category, "INVESTIGATIVE_LEAD"),
    title: text(raw.title, raw.lead_title, raw.name, "Investigative Lead"),
    explanation: text(
      raw.explanation,
      raw.description,
      raw.summary,
      raw.message,
      "No explanation has been recorded for this lead."
    ),
    supporting: raw.supporting_json || raw.supporting || raw.evidence || {},
    confidence:
      raw.confidence === undefined || raw.confidence === null
        ? null
        : Number(raw.confidence),
    status: text(raw.verification_status, raw.status, "Pending"),
    createdAt: raw.created_at || null,
  };
}

function normalizeAlert(raw = {}, index = 0) {
  return {
    id: raw.id ?? `alert-${index}`,
    type: text(raw.alert_type, raw.type, raw.category, "CASE_ALERT"),
    title: text(raw.title, raw.alert_title, raw.name, raw.alert_type, "Case Alert"),
    description: text(
      raw.description,
      raw.message,
      raw.summary,
      "No additional alert details recorded."
    ),
    severity: text(raw.severity, raw.priority, "Medium"),
    status: text(raw.status, "Open"),
    createdAt: raw.created_at || null,
  };
}

function EvidenceRefs({ supporting }) {
  const refs = useMemo(() => {
    if (!supporting) return [];
    if (Array.isArray(supporting)) return supporting;
    const values = [];
    if (Array.isArray(supporting.evidence)) values.push(...supporting.evidence);
    if (supporting.evidence_id) values.push(supporting.evidence_id);
    if (supporting.source_reference) values.push(supporting.source_reference);
    return [...new Set(values.filter(Boolean).map(String))].slice(0, 4);
  }, [supporting]);

  if (!refs.length) return null;

  return (
    <div className="ix-supporting">
      <span>Supporting references</span>
      <div>
        {refs.map((ref) => (
          <b key={ref}>{ref}</b>
        ))}
      </div>
    </div>
  );
}

export default function ForensicIntelligence() {
  const navigate = useNavigate();

  const [cases, setCases] = useState([]);
  const [caseId, setCaseId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load(selectedCaseId) {
    if (!selectedCaseId) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      const response = await featureApi.caseIntelligence(selectedCaseId);
      setData(response || {});
    } catch (error) {
      setMessage(error?.message || "Unable to load case intelligence.");
    } finally {
      setLoading(false);
    }
  }

  async function initialise() {
    try {
      setLoading(true);
      setMessage("");
      const availableCases = (await getForensicCases()) || [];
      setCases(availableCases);

      const firstId = availableCases?.[0]?.id ? String(availableCases[0].id) : "";
      setCaseId(firstId);

      if (firstId) {
        const response = await featureApi.caseIntelligence(firstId);
        setData(response || {});
      } else {
        setData(null);
      }
    } catch (error) {
      setMessage(error?.message || "Unable to initialise case intelligence.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    initialise();
  }, []);

  async function generate() {
    if (!caseId) return;
    try {
      setMessage("");
      await featureApi.generateLeads(caseId);
      await load(caseId);
    } catch (error) {
      setMessage(error?.message || "Unable to generate leads.");
    }
  }

  async function review(id, status) {
    try {
      setMessage("");
      await featureApi.reviewLead(id, status);
      await load(caseId);
    } catch (error) {
      setMessage(error?.message || "Unable to review this lead.");
    }
  }

  const leads = (data?.leads || []).map(normalizeLead);
  const alerts = (data?.alerts || []).map(normalizeAlert);
  const overlaps = Array.isArray(data?.cross_case?.overlaps)
    ? data.cross_case.overlaps
    : [];

  return (
    <ForensicPageLayout module="intelligence">
      <div className="ix-page">
        <section className="ix-heading">
          <div>
            <span>FORENSIC ANALYST · INTELLIGENCE</span>
            <h1>Case Intelligence</h1>
            <p>
              Explainable investigative leads, alerts and cross-case indicators for
              assigned investigations.
            </p>
          </div>

          <div className="ix-actions">
            <div className="ix-select-wrap">
              <select
                value={caseId}
                onChange={(event) => {
                  const next = event.target.value;
                  setCaseId(next);
                  load(next);
                }}
              >
                {cases.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.case_id} · {item.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>

            <button type="button" onClick={generate} disabled={!caseId || loading}>
              <BrainCircuit size={15} />
              Generate Leads
            </button>

            <button type="button" onClick={() => navigate("/cross-case")}>
              <GitBranch size={15} />
              Cross-Case
            </button>

            <button
              type="button"
              className="ghost"
              onClick={() => load(caseId)}
              aria-label="Refresh case intelligence"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </section>

        {message && (
          <div className="ix-warning">
            <AlertTriangle size={15} />
            {message}
          </div>
        )}

        <div className="ix-note">
          <ShieldCheck size={16} />
          <span>
            AI and graph analytics surface investigative leads only. Verification
            remains an officer decision.
          </span>
        </div>

        {loading ? (
          <div className="ix-loading">Loading case intelligence…</div>
        ) : !caseId ? (
          <div className="ix-loading">No forensic case is currently assigned.</div>
        ) : (
          <div className="ix-grid">
            <section className="ix-panel">
              <header>
                <div>
                  <small>INVESTIGATIVE LEADS</small>
                  <h2>
                    {leads.length} lead{leads.length === 1 ? "" : "s"}
                  </h2>
                </div>
                <BrainCircuit size={20} />
              </header>

              {leads.length ? (
                leads.map((lead) => (
                  <article className="ix-card" key={lead.id ?? `${lead.title}-${lead.createdAt}`}>
                    <div className="ix-card-top">
                      <span>{lead.leadType.replaceAll("_", " ")}</span>
                      <b className={`ix-state ${lead.status.toLowerCase()}`}>
                        {lead.status}
                      </b>
                    </div>

                    <h3>{lead.title}</h3>
                    <p>{lead.explanation}</p>

                    <EvidenceRefs supporting={lead.supporting} />

                    {lead.confidence === null ? (
                      <small>Confidence not computed</small>
                    ) : (
                      <small>Computed confidence: {Math.round(lead.confidence * 100)}%</small>
                    )}

                    {lead.status.toLowerCase() === "pending" && (
                      <div className="ix-review">
                        <button type="button" onClick={() => review(lead.id, "Verified")}>
                          <CheckCircle2 size={14} />
                          Verify Lead
                        </button>
                        <button
                          type="button"
                          className="reject"
                          onClick={() => review(lead.id, "Rejected")}
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <div className="ix-empty">
                  No saved leads. Use Generate Leads to evaluate current case data.
                </div>
              )}
            </section>

            <aside className="ix-side">
              <section className="ix-panel">
                <header>
                  <div>
                    <small>CASE ALERTS</small>
                    <h2>
                      {alerts.length} alert{alerts.length === 1 ? "" : "s"}
                    </h2>
                  </div>
                  <AlertTriangle size={20} />
                </header>

                {alerts.length ? (
                  alerts.slice(0, 8).map((alert) => (
                    <article className="ix-mini" key={alert.id}>
                      <div className="ix-mini-head">
                        <b>{alert.severity}</b>
                        <span>{alert.status}</span>
                      </div>
                      <strong>{alert.title}</strong>
                      <p>{alert.description}</p>
                      <small>{alert.type.replaceAll("_", " ")}</small>
                    </article>
                  ))
                ) : (
                  <div className="ix-empty">No current alerts.</div>
                )}
              </section>

              <section className="ix-panel">
                <header>
                  <div>
                    <small>CROSS-CASE</small>
                    <h2>
                      {overlaps.length} overlap{overlaps.length === 1 ? "" : "s"}
                    </h2>
                  </div>
                  <GitBranch size={20} />
                </header>

                {overlaps.length ? (
                  overlaps.slice(0, 8).map((overlap, index) => (
                    <article
                      className="ix-mini ix-clickable"
                      key={`${overlap.identifier_type}-${overlap.normalized_value}-${index}`}
                      onClick={() => navigate("/cross-case")}
                    >
                      <div className="ix-mini-head">
                        <b>{text(overlap.identifier_type, "IDENTIFIER").replaceAll("_", " ")}</b>
                        <ExternalLink size={13} />
                      </div>
                      <strong>{text(overlap.value, overlap.normalized_value, "Unknown")}</strong>
                      <p>
                        Also appears in {(overlap.other_cases || []).length} other
                        investigation{(overlap.other_cases || []).length === 1 ? "" : "s"}.
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="ix-empty">No cross-case overlaps found.</div>
                )}
              </section>
            </aside>
          </div>
        )}
      </div>
    </ForensicPageLayout>
  );
}
