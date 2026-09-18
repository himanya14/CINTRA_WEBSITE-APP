import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Plus, RefreshCw, Scale, Search, Trash2, X } from "lucide-react";
import AppHeader from "../../components/layout/AppHeader.jsx";
import { featureApi } from "../../services/expandedFeatures.js";
import "../Shared/InvestigationSupport.css";

export default function CaseLegalPage(){
  const {caseId}=useParams();
  const navigate=useNavigate();
  const [q,setQ]=useState("");
  const [framework,setFramework]=useState("");
  const [sections,setSections]=useState([]);
  const [linked,setLinked]=useState([]);
  const [frameworks,setFrameworks]=useState([]);
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);

  async function load(){
    try{
      setMsg("");
      const [f,s,l]=await Promise.all([
        featureApi.legalFrameworks(),
        featureApi.legalSections(q,framework),
        featureApi.caseLegalSections(caseId),
      ]);
      setFrameworks(f||[]);
      setSections(s||[]);
      setLinked(l||[]);
    }catch(e){setMsg(e.message)}
  }

  useEffect(()=>{load()},[caseId]);

  const confirmed=useMemo(()=>linked.filter(x=>String(x.status).toLowerCase()==="confirmed"),[linked]);
  const candidates=useMemo(()=>linked.filter(x=>String(x.status).toLowerCase()==="candidate"),[linked]);
  const rejected=useMemo(()=>linked.filter(x=>String(x.status).toLowerCase()==="rejected"),[linked]);
  const linkedIds=new Set(linked.filter(x=>String(x.status).toLowerCase()!=="rejected").map(x=>x.legal_section_id));

  async function suggest(){
    try{setBusy(true);setMsg("");const r=await featureApi.suggestCaseLegalSections(caseId);setMsg(r.message||"Potential provisions generated.");await load()}catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  async function add(id){
    try{await featureApi.addCaseLegalSection(caseId,{legal_section_id:id,status:"Confirmed",rationale:"Manually confirmed by authorized officer in CINTRA."});await load()}catch(e){setMsg(e.message)}
  }
  async function review(id,status){
    try{await featureApi.reviewCaseLegalSection(caseId,id,status);await load()}catch(e){setMsg(e.message)}
  }
  async function remove(id){
    try{await featureApi.removeCaseLegalSection(caseId,id);await load()}catch(e){setMsg(e.message)}
  }

  return <div>
    <AppHeader activePage="cases" caseId={caseId}/>
    <main className="ix-page">
      <section className="ix-heading">
        <div>
          <span>CASE LEGAL PROVISIONS</span>
          <h1>Legal Provision Review</h1>
          <p>CINTRA may surface potential provisions from the case narrative. Only officer-confirmed provisions are sent to the chargesheet.</p>
        </div>
        <div className="ix-actions">
          <button className="ghost" onClick={()=>navigate(`/cases/${caseId}`)}><ArrowLeft size={15}/></button>
          <button className="ix-primary" onClick={suggest} disabled={busy}><RefreshCw size={15}/>{busy?"Reviewing…":"Generate Candidates"}</button>
        </div>
      </section>

      <div className="ix-note"><Scale size={16}/>Potential provisions are investigative/legal workflow aids, not automatic legal conclusions. An authorized officer must confirm each provision.</div>
      {msg&&<div className="ix-warning">{msg}</div>}

      <div className="ix-grid">
        <section className="ix-panel">
          <header><div><small>PENDING OFFICER REVIEW</small><h2>{candidates.length} candidate{candidates.length===1?"":"s"}</h2></div><Scale size={20}/></header>
          {candidates.map(item=><article className="ix-card" key={item.id}>
            <div className="ix-card-top"><span>{item.section?.framework_code} {item.section?.section_number}</span><span className="ix-badge">Candidate</span></div>
            <h3>{item.section?.offence_name}</h3>
            <p>{item.rationale||item.section?.description||"No rationale recorded."}</p>
            {item.section?.legacy_reference&&<small>Cross-reference: {item.section.legacy_reference}</small>}
            <div className="ix-actions" style={{marginTop:12}}>
              <button className="ix-primary" onClick={()=>review(item.id,"Confirmed")}><Check size={14}/>Confirm</button>
              <button className="ghost" onClick={()=>review(item.id,"Rejected")}><X size={14}/>Reject</button>
            </div>
          </article>)}
          {!candidates.length&&<div className="ix-empty">No pending legal candidates. Create/update the case narrative or generate candidates again.</div>}

          <header style={{marginTop:18}}><div><small>CONFIRMED FOR CHARGESHEET</small><h2>{confirmed.length} provision{confirmed.length===1?"":"s"}</h2></div><Check size={20}/></header>
          {confirmed.map(item=><article className="ix-card" key={item.id}>
            <div className="ix-card-top"><span>{item.section?.framework_code} {item.section?.section_number}</span><button className="ix-icon-danger" onClick={()=>remove(item.id)}><Trash2 size={14}/></button></div>
            <h3>{item.section?.offence_name}</h3>
            <p>{item.section?.description||"No description recorded."}</p>
            {item.section?.legacy_reference&&<p><b>Cross-reference:</b> {item.section.legacy_reference}</p>}
            <small>Confirmed by {item.reviewed_by||item.added_by} · {item.reviewed_at?new Date(item.reviewed_at).toLocaleString():item.status}</small>
          </article>)}
          {!confirmed.length&&<div className="ix-empty">No legal provisions are confirmed yet. The chargesheet will not present candidate sections as confirmed.</div>}

          {rejected.length>0&&<details style={{marginTop:16}}><summary>{rejected.length} rejected candidate{rejected.length===1?"":"s"}</summary>{rejected.map(item=><div className="ix-mini" key={item.id}><b>{item.section?.framework_code} {item.section?.section_number}</b><strong>{item.section?.offence_name}</strong></div>)}</details>}
        </section>

        <section className="ix-panel">
          <header><div><small>LEGAL MASTER</small><h2>Manual provision lookup</h2></div><Plus size={20}/></header>
          <form className="ix-toolbar" style={{padding:"12px",margin:0}} onSubmit={e=>{e.preventDefault();load()}}>
            <select value={framework} onChange={e=>setFramework(e.target.value)}><option value="">All frameworks</option>{frameworks.map(f=><option key={f.id} value={f.code}>{f.code}</option>)}</select>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Section or offence"/>
            <button className="ix-primary"><Search size={14}/></button>
          </form>
          {sections.slice(0,40).map(s=><article className="ix-mini" key={s.id}>
            <b>{s.framework_code} {s.section_number}</b>
            <strong>{s.offence_name}</strong>
            <p>{s.legacy_reference||s.description||"—"}</p>
            <button className="ix-add-link" disabled={linkedIds.has(s.id)} onClick={()=>add(s.id)}>{linkedIds.has(s.id)?"Already linked":"+ Confirm manually"}</button>
          </article>)}
        </section>
      </div>
    </main>
  </div>
}
