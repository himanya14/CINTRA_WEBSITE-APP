import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, FileSearch, FolderOpen, RefreshCw, ShieldCheck, CheckCircle2, Clock3, AlertTriangle, ChevronRight } from "lucide-react";
import ForensicPageLayout from "../../components/layout/ForensicPageLayout.jsx";
import { getForensicOverview, getForensicEvidence } from "../../services/forensics.js";
import "./ForensicOverview.css";

function fmt(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

export default function ForensicOverview() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    try {
      setError(""); refresh ? setRefreshing(true) : setLoading(true);
      const [o, e] = await Promise.all([getForensicOverview(), getForensicEvidence()]);
      setOverview(o); setEvidence(Array.isArray(e) ? e : []);
    } catch (err) { setError(err?.message || "Unable to load forensic workspace."); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);

  const current = Array.isArray(overview?.current_assignments) ? overview.current_assignments : [];

  return (
    <ForensicPageLayout module="overview">
      <div className="forensic-overview">
        <section className="forensic-overview-heading">
          <div><div className="forensic-overview-eyebrow">FORENSIC ANALYST WORKSPACE</div><h1>Forensic Overview</h1><p>Assigned examinations, accessible evidence and current forensic work.</p></div>
          <button type="button" className="forensic-refresh-button" onClick={() => load(true)} disabled={refreshing}><RefreshCw size={15}/>{refreshing ? "Refreshing" : "Refresh"}</button>
        </section>

        {error && <div className="forensic-workspace-warning"><AlertTriangle size={16}/>{error}</div>}
        {loading ? <div className="forensic-workspace-loading"><RefreshCw size={17}/>Loading forensic workspace...</div> : <>
          <section className="forensic-workload-strip">
            <div><span>Total Assignments</span><strong>{overview?.total_assignments ?? 0}</strong><small>All assigned work</small></div>
            <div><span>In Examination</span><strong>{overview?.in_progress ?? 0}</strong><small>Currently active</small></div>
            <div><span>Completed</span><strong>{overview?.completed ?? 0}</strong><small>Recorded examinations</small></div>
            <div><span>Accessible Evidence</span><strong>{overview?.assigned_evidence ?? evidence.length}</strong><small>Across assigned cases</small></div>
          </section>

          <section className="forensic-overview-grid">
            <div className="forensic-work-panel">
              <div className="forensic-panel-heading"><div><span className="forensic-section-label">CURRENT WORK</span><h2>Examination Assignments</h2><p>Case-level and evidence-level assignments issued to your account.</p></div><ClipboardList size={21}/></div>
              {current.length ? current.map(a => <button key={a.id} className="forensic-record-row" onClick={() => navigate(`/forensic/digital-forensics?case=${a.case_id}&assignment=${a.id}`)}><span className="forensic-record-main"><span className="forensic-record-reference">ASSIGNMENT #{a.id}</span><strong>{a.examination_type}</strong><small>Case DB #{a.case_id} · {a.priority || "Normal"} priority · Assigned {fmt(a.assigned_at)}</small></span><span className={`forensic-status-badge ${(a.status||"").toLowerCase().replaceAll(" ","-")}`}>{a.status}</span><ChevronRight size={16}/></button>) : <div className="forensic-empty-mini">No forensic assignments are currently available.</div>}
              <button className="forensic-overview-link" onClick={() => navigate("/forensic/assignments")}>Open all assignments <ChevronRight size={15}/></button>
            </div>

            <div className="forensic-work-panel">
              <div className="forensic-panel-heading"><div><span className="forensic-section-label">ACCESSIBLE MATERIAL</span><h2>Evidence</h2><p>Evidence from investigations assigned to you.</p></div><FileSearch size={21}/></div>
              {evidence.slice(0,5).map(item => <button key={item.id} className="forensic-evidence-mini" onClick={() => navigate(`/forensic/digital-forensics?case=${item.case_id}&evidence=${item.id}`)}><span><b>{item.evidence_id}</b><strong>{item.title}</strong><small>{item.evidence_type} · {item.status}</small></span><ChevronRight size={15}/></button>)}
              {!evidence.length && <div className="forensic-empty-mini"><FolderOpen size={23}/>No accessible evidence.</div>}
            </div>
          </section>
        </>}
      </div>
    </ForensicPageLayout>
  );
}
