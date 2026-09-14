"use client";
import { useEffect, useMemo, useState } from "react";
import { WorkNavigation } from '@/components/work-navigation';
import { AppShell } from "@/components/app-shell";
import { useSearchParams } from "next/navigation";

type Approval = { canDecide?:boolean;assignedToMe?:boolean;reviewerEmail?:string;removalKind?:string; id:string; clientId:string; clientName:string; type:string; title:string; summary:string; riskLevel:string; status:string; requestedBy:string; decidedBy:string; decidedAt:string; createdAt:string };
type ApprovalPayload = { message?:string;error?:string; approval?:Approval; approvals?:Approval[] };
const filters = ["Pending", "Approved", "Rejected", "All"];

export default function ApprovalsPage(){
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("request");
  const [items,setItems]=useState<Approval[]>([]),[selected,setSelected]=useState<Approval|null>(null),[filter,setFilter]=useState("Pending"),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
  const [saving,setSaving]=useState(false),[assignedOnly,setAssignedOnly]=useState(true);
  async function load(){
    setLoading(true);
    try{const response=await fetch("/api/approvals");const data=await response.json() as ApprovalPayload;if(!response.ok)throw new Error(data.error);setItems(data.approvals||[]);setSelected((current)=>current ? (data.approvals||[]).find((item:Approval)=>item.id===current.id)||null : (data.approvals||[])[0]||null)}catch(error){setMessage(error instanceof Error?error.message:"Unable to load approvals")}finally{setLoading(false)}
  }
  useEffect(()=>{
    let cancelled=false;
    fetch("/api/approvals")
      .then(async(response)=>{const data=await response.json() as ApprovalPayload;if(!response.ok)throw new Error(data.error);return data.approvals||[]})
      .then((approvals)=>{if(cancelled)return;setItems(approvals);setSelected(approvals.find((item:Approval)=>item.id===requestedId)||approvals[0]||null);if(requestedId){setFilter("All");setAssignedOnly(false)}})
      .catch((error)=>{if(!cancelled)setMessage(error instanceof Error?error.message:"Unable to load approvals")})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[requestedId]);
  const reviewItems=useMemo(()=>items.filter(item=>!assignedOnly||item.assignedToMe||item.type!=="Company removal"),[items,assignedOnly]);
  const visible=useMemo(()=>reviewItems.filter(item=>filter==="All"||item.status===filter),[reviewItems,filter]);
  useEffect(()=>{setSelected((current)=>current&&visible.some((item)=>item.id===current.id)?current:visible[0]||null)},[visible]);
  async function decide(status:"Approved"|"Rejected"){
    if(!selected||selected.status!=="Pending"||selected.canDecide===false||saving||loading)return;
    setSaving(true);setMessage("Saving decision…");
    try {
      const response=await fetch("/api/approvals",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:selected.id,status})});
      const data=await response.json() as ApprovalPayload;
      if(!response.ok)throw new Error(data.error||"Decision could not be saved");
      setMessage(data.message||status+" · audit event recorded");await load();
    } catch(error) {
      setMessage(error instanceof Error?error.message:"Decision could not be saved. Reload the requests to check their current status.");
    } finally {setSaving(false);}
  }
  return <AppShell><main className="approvals-page work-view">
    <section className="approvals-hero"><div><small>HUMAN CONTROL CENTER</small><h1>Approvals</h1><p>Review requests assigned to you. Approved company removals take effect in Ops.</p></div></section>
    <WorkNavigation current="/approvals"/><div className="approvals-content"><section className="approval-metrics"><article><small>PENDING</small><strong>{reviewItems.filter(x=>x.status==="Pending").length}</strong><span>Waiting for a person</span></article><article><small>APPROVED</small><strong>{reviewItems.filter(x=>x.status==="Approved").length}</strong><span>Decision recorded</span></article><article><small>REJECTED</small><strong>{reviewItems.filter(x=>x.status==="Rejected").length}</strong><span>Decision recorded</span></article></section>
      <section className={selected ? "approval-layout" : "approval-layout approval-layout-empty"}><div className="approval-inbox"><div className="approval-heading"><div><small>REVIEW QUEUE</small><h2>Approval requests</h2></div><span>{visible.length} shown</span></div><label className="approval-assignment">Show<select value={assignedOnly?"mine":"all"} onChange={e=>setAssignedOnly(e.target.value==="mine")}><option value="mine">My reviews</option><option value="all">All requests</option></select></label><div className="approval-filters">{filters.map(item=><button key={item} className={filter===item?"active":""} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{item}</button>)}</div>{loading?<p className="approval-empty">Loading approvals…</p>:visible.length?visible.map(item=><button key={item.id} className={selected?.id===item.id?"approval-row selected":"approval-row"} onClick={()=>setSelected(item)}><i>{item.type[0]}</i><span><b>{item.title}</b><small>{item.clientName} · {item.type}</small></span><em className={item.status.toLowerCase()}>{item.status}</em></button>):<div className="approval-empty"><b>No {filter.toLowerCase()} requests</b><span>{items.length ? "Choose another status or All requests to see other saved requests." : "To request test/spam removal, open a company and choose Mark test / spam. Its assigned reviewer will see the request here."}</span></div>}</div>
        {selected && <aside className="approval-detail">{selected?<><div className="approval-client"><small>ACCOUNT-SCOPED REQUEST</small><b>{selected.clientName}</b><a href={`/clients/${encodeURIComponent(selected.clientId)}`}>Open company →</a></div><h2>{selected.title}</h2><p>{selected.summary}</p><div className="approval-facts"><span><small>TYPE</small><b>{selected.type}</b></span><span><small>RISK</small><b>{selected.riskLevel}</b></span><span><small>REQUESTED BY</small><b>{selected.requestedBy}</b></span><span><small>ASSIGNED REVIEWER</small><b>{selected.reviewerEmail||"Any authorized operator"}</b></span><span><small>STATUS</small><b>{selected.status}</b></span></div><div className="approval-guardrail"><b>{selected.type==='Company removal'?'Company removal · '+(selected.removalKind==='test'?'test data':'spam'):'Decision only'}</b><span>{selected.type==='Company removal'?'Approval archives this company from active Companies, Onboarding, Operations and inquiry queues. Saved contacts, scope, delivery evidence and history remain. This does not stop running automations.':'This records your review. It does not launch, pause or run an automation.'}</span></div>{selected.status==='Pending'&&selected.canDecide===false&&<p className="approval-message">Waiting for {selected.reviewerEmail}. Only that reviewer can decide; you cannot approve your own request.</p>}{selected.status==="Pending"?<div className="approval-actions"><button disabled={saving||loading||selected.canDecide===false} onClick={()=>decide("Rejected")}>Reject request</button><button className="approve" disabled={saving||loading||selected.canDecide===false} onClick={()=>decide("Approved")}>{selected.type==='Company removal'?'Approve removal':'Approve & record'}</button></div>:<div className="approval-decision"><b>{selected.status}</b><span>{selected.decidedBy||"Authorized reviewer"} · audit event saved</span></div>}</>:<div className="approval-empty">Select a request to review it.</div>}</aside>}</section><p className="approval-message" role="status">{message}</p><button disabled={saving||loading} onClick={()=>void load()}>Refresh requests</button>
    </div></main></AppShell>
}
