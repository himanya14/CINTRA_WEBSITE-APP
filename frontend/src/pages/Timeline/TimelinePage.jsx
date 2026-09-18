import { useEffect, useState } from "react";
import { Clock3, RefreshCw } from "lucide-react";
import { useParams } from "react-router-dom";
import AppHeader from "../../components/layout/AppHeader.jsx";
import { featureApi } from "../../services/expandedFeatures.js";
import "../Shared/InvestigationSupport.css";

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function TimelinePage() {
  const { caseId } = useParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);
      setMessage("");
      setRows(await featureApi.timeline(caseId));
    } catch (error) {
      setMessage(error.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const syncTimer = window.setInterval(() => load(true), 7000);
    return () => window.clearInterval(syncTimer);
  }, [caseId]);

  return (
    <div>
      <AppHeader activePage="cases" caseId={caseId} />
      <main className="ix-page">
        <section className="ix-heading">
          <div>
            <span>CASE RECONSTRUCTION</span>
            <h1>Investigation Timeline</h1>
            <p>
              Chronological reconstruction from case, evidence, diary, intelligence
              and forensic activity.
            </p>
          </div>
          <div className="ix-actions">
            <button className="ghost" onClick={() => load()}>
              <RefreshCw size={15} />
            </button>
          </div>
        </section>

        {message && <div className="ix-warning">{message}</div>}

        <section className="ix-panel">
          <header>
            <div>
              <small>TIMELINE</small>
              <h2>
                {rows.length} event{rows.length === 1 ? "" : "s"}
              </h2>
            </div>
            <Clock3 size={20} />
          </header>

          {loading ? (
            <div className="ix-loading">Building timeline…</div>
          ) : (
            rows.map((row, index) => (
              <article
                className="ix-card"
                key={`${row.event_type}-${row.source_id}-${index}`}
              >
                <div className="ix-card-top">
                  <span>{row.event_type}</span>
                  <b>{formatDateTime(row.event_at)}</b>
                </div>
                <h3>{row.title}</h3>
                <p>{row.description || "No additional description recorded."}</p>
                <small>
                  {row.source_type || "System"}
                  {row.source_id ? ` · ${row.source_id}` : ""}
                  {row.officer_id ? ` · ${row.officer_id}` : ""}
                </small>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
