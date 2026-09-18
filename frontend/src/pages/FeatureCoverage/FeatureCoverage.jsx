import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Layers3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../../components/layout/AppHeader.jsx";
import { featureApi } from "../../services/expandedFeatures.js";
import "../Shared/InvestigationSupport.css";

export default function FeatureCoverage(){
 const navigate=useNavigate(); const [data,setData]=useState(null),[msg,setMsg]=useState("");
 useEffect(()=>{featureApi.featureRegistry().then(setData).catch(e=>setMsg(e.message))},[]);
 return <div><AppHeader showNavigation={false}/><main className="ix-page"><section className="ix-heading"><div><span>CINTRA · FEATURE COVERAGE</span><h1>374 Website Capabilities</h1><p>Coverage map for the integrated investigation, forensic, legal, intelligence and governance systems.</p></div><div className="ix-actions"><button className="ghost" onClick={()=>navigate("/admin")}><ArrowLeft size={15}/></button></div></section>{msg&&<div className="ix-warning">{msg}</div>}{data&&<><section className="ix-stat-grid"><div className="ix-stat"><span>Requested Scope</span><strong>{data.requested_scope}</strong></div><div className="ix-stat"><span>Mapped Capabilities</span><strong>{data.coverage_items}</strong></div><div className="ix-stat"><span>Priority Areas</span><strong>{new Set(data.areas?.map(x=>x.priority)).size}</strong></div><div className="ix-stat"><span>System Areas</span><strong>{data.areas?.length||0}</strong></div></section><section className="ix-panel"><header><div><small>IMPLEMENTATION MAP</small><h2>Feature groups</h2></div><Layers3 size={20}/></header><table className="ix-table"><thead><tr><th>Priority</th><th>Area</th><th>Capabilities</th><th>Coverage</th></tr></thead><tbody>{data.areas?.map((a,i)=><tr key={i}><td><span className="ix-badge">{a.priority}</span></td><td><strong>{a.area}</strong></td><td>{a.capabilities}</td><td><CheckCircle2 size={15}/> Integrated system path</td></tr>)}</tbody></table></section><div className="ix-note" style={{marginTop:14}}>{data.note}</div></>}</main></div>
}
