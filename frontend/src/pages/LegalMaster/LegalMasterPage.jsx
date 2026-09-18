import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Search, ShieldCheck } from "lucide-react";
import AppHeader from "../../components/layout/AppHeader.jsx";
import { featureApi } from "../../services/expandedFeatures.js";
import "../Shared/InvestigationSupport.css";

export default function LegalMasterPage(){
 const navigate=useNavigate();
 const [frameworks,setFrameworks]=useState([]),[framework,setFramework]=useState(""),[q,setQ]=useState(""),[sections,setSections]=useState([]),[loading,setLoading]=useState(true),[msg,setMsg]=useState("");
 async function load(){try{setLoading(true);setMsg("");const [f,s]=await Promise.all([featureApi.legalFrameworks(),featureApi.legalSections(q,framework)]);setFrameworks(f||[]);setSections(s||[])}catch(e){setMsg(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 return <div>
    <AppHeader activePage="legal" />
    <main className="ix-page"><section className="ix-heading"><div><span>CINTRA · LEGAL MASTER DATA</span><h1>Legal Codes & Offences</h1><p>BNS, legacy IPC and special-law references for officer-confirmed case provisions.</p></div><div className="ix-actions"><button type="button" onClick={()=>navigate("/master-data")}><BookOpen size={15}/>Master Data</button></div></section><div className="ix-note"><ShieldCheck size={16}/>CINTRA may retrieve or suggest legal references, but an authorized officer must confirm provisions applied to a case.</div><form className="ix-toolbar" onSubmit={e=>{e.preventDefault();load()}}><select value={framework} onChange={e=>setFramework(e.target.value)}><option value="">All frameworks</option>{frameworks.map(f=><option key={f.id} value={f.code}>{f.code} · {f.name}</option>)}</select><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search section number, offence, cheating, theft, conspiracy…"/><button className="ix-primary"><Search size={15}/>Search</button></form>{msg&&<div className="ix-warning">{msg}</div>}<section className="ix-panel"><header><div><small>LEGAL SECTION DIRECTORY</small><h2>{sections.length} reference{sections.length===1?"":"s"}</h2></div><BookOpen size={20}/></header>{loading?<div className="ix-loading">Loading legal master…</div>:<table className="ix-table"><thead><tr><th>Framework</th><th>Section</th><th>Offence / Subject</th><th>Legacy / Cross-reference</th></tr></thead><tbody>{sections.map(s=><tr key={s.id}><td><span className="ix-badge">{s.framework_code}</span></td><td><strong>{s.section_number}</strong></td><td><b>{s.offence_name}</b><br/><small>{s.description||"—"}</small></td><td>{s.legacy_reference||"—"}</td></tr>)}</tbody></table>}</section></main></div>
}
