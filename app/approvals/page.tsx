"use client";
import { useEffect, useMemo, useState } from "react";
import { WorkNavigation } from '@/components/work-navigation';
import { AppShell } from "@/components/app-shell";
import { useSearchParams } from "next/navigation";

type Approval = { id:string; clientId:string; clientName:string; type:string; title:string; summary:string; riskLevel:string; status:string; requestedBy:string; decidedBy:string; decidedAt:string; createdAt:string };
type ApprovalPayload = { error?:string; approval?:Approval; approvals?:Approval[] };
const filters = ["Pending", "Approved", "Rejected", "All"];

export default function ApprovalsPage(){
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("request");
  const [items,setItems]=useState<Approval[]>([]),[selected,setSelected]=useState<Approval|null>(null),[filter,setFilter]=useState("Pending"),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);
  async function load(){
    setLoading(true);
    try{const response=await fetch("/api/approvals");const data=await response.json() as ApprovalPayload;if(!response.ok)throw new Error(data.error);setItems(data.approvals||[]);setSelected((current)=>current ? (data.approvals||[]).find((item:Approval)=>item.id===current.id)||null : (data.approvals||[])[0]||null)}catch(error){setMessage(error instanceof Error?error.message:"Unable to load approvals")}finally{setLoading(false)}
  }
  useEffect(()=>{
    let cancelled=false;
    fetch("/api/approvals")
      .then(async(response)=>{const data=await response.json() as ApprovalPayload;if(!response.ok)throw new Error(data.error);return data.approvals||[]})
      .then((approvals)=>{if(cancelled)return;setItems(approvals);setSelected(approvals.find((item:Approval)=>item.id===requestedId)||approvals[0]||null);if(requestedId)setFilter("All")})
      .catch((error)=>{if(!cancelled)setMessage(error instanceof Error?error.message:"Unable to load approvals")})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[requestedId]);
  const visible=useMemo(()=>items.filter(item=>filter==="All"||item.status===filter),[items,filter]);
  useEffect(()=>{setSelected((current)=>current&&visible.some((item)=>item.id===current.id)?current:visible[0]||null)},[visible]);
  async function decide(status:"Approved"|"Rejected"){
    if(!selected||selected.status!=="Pending"||saving||loading)return;
    setSaving(true);setMessage("Saving decision…");
    try {
      const response=await fetch("/api/approvals",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:selected.id,status})});
      const data=await response.json() as ApprovalPayload;
      if(!response.ok)throw new Error(data.error||"Decision could not be saved");
      setMessage(status+" · audit event recorded");await load();
    } catch(error) {
      setMessage(error instanceof Error?error.message:"Decision could not be saved. Reload the requests to check their current status.");
    } finally {setSaving(false);}
  }
  return <AppShell><main className="approvals-page work-view">
    <section className="approvals-hero"><div><small>HUMAN CONTROL CENTER</small><h1>Approvals</h1><p>Review saved requests and record a decision. Execution is a separate step.</p></div></section>
    <WorkNavigation current="/approvals"/><div className="approvals-content"><section className="approval-metrics"><article><small>PENDING</small><strong>{items.filter(x=>x.status==="Pending").length}</strong><span>Waiting for a person</span></article><article><small>APPROVED</small><strong>{items.filter(x=>x.status==="Approved").length}</strong><span>Decision recorded</span></article><article><small>REJECTED</small><strong>{items.filter(x=>x.status==="Rejected").length}</strong><span>Decision recorded</span></article></section>
      <section className={selected ? "approval-layout" : "approval-layout approval-layout-empty"}><div className="approval-inbox"><div className="approval-heading"><div><small>REVIEW QUEUE</small><h2>Approval requests</h2></div><span>{visible.length} shown</span></div><div className="approval-filters">{filters.map(item=><button key={item} className={filter===item?"active":""} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{item}</button>)}</div>{loading?<p className="approval-empty">Loading approvals…</p>:visible.length?visible.map(item=><button key={item.id} className={selected?.id===item.id?"approval-row selected":"approval-row"} onClick={()=>setSelected(item)}><i>{item.type[0]}</i><span><b>{item.title}</b><small>{item.clientName} · {item.type}</small></span><em className={item.status.toLowerCase()}>{item.status}</em></button>):<div className="approval-empty"><b>No {filter.toLowerCase()} requests</b><span>{items.length ? "Choose another status to see your saved requests." : "Requests cannot yet be created from Ops pages. Scope, launch and internal-use reviews remain within each company’s workflow."}</span></div>}</div>
        {selected && <aside className="approval-detail">{selected?<><div className="approval-client"><small>ACCOUNT-SCOPED REQUEST</small><b>{selected.clientName}</b><a href={`/clients/${encodeURIComponent(selected.clientId)}`}>Open company →</a></div><h2>{selected.title}</h2><p>{selected.summary}</p><div className="approval-facts"><span><small>TYPE</small><b>{selected.type}</b></span><span><small>RISK</small><b>{selected.riskLevel}</b></span><span><small>REQUESTED BY</small><b>{selected.requestedBy}</b></span><span><small>STATUS</small><b>{selected.status}</b></span></div><div className="approval-guardrail"><b>Decision only</b><span>This records your review. It does not launch, pause or run an automation. Open the company to continue its workflow.</span></div>{selected.status==="Pending"?<div className="approval-actions"><button disabled={saving||loading} onClick={()=>decide("Rejected")}>Reject request</button><button className="approve" disabled={saving||loading} onClick={()=>decide("Approved")}>Approve & record</button></div>:<div className="approval-decision"><b>{selected.status}</b><span>{selected.decidedBy||"Authorized reviewer"} · audit event saved</span></div>}</>:<div className="approval-empty">Select a request to review it.</div>}</aside>}</section><p className="approval-message" role="status">{message}</p><button disabled={saving||loading} onClick={()=>void load()}>Refresh requests</button>
    </div></main></AppShell>
}
