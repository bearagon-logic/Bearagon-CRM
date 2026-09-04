"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Approval = { id:string; clientId:string; clientName:string; type:string; title:string; summary:string; riskLevel:string; status:string; requestedBy:string; decidedBy:string; decidedAt:string; createdAt:string };
type ApprovalPayload = { error?:string; approval?:Approval; approvals?:Approval[] };
const filters = ["Pending", "Approved", "Rejected", "All"];

export default function ApprovalsPage(){
  const [items,setItems]=useState<Approval[]>([]),[selected,setSelected]=useState<Approval|null>(null),[filter,setFilter]=useState("Pending"),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
  async function load(){
    setLoading(true);
    try{const response=await fetch("/api/approvals");const data=await response.json() as ApprovalPayload;if(!response.ok)throw new Error(data.error);setItems(data.approvals||[]);setSelected((current)=>current ? (data.approvals||[]).find((item:Approval)=>item.id===current.id)||null : (data.approvals||[])[0]||null)}catch(error){setMessage(error instanceof Error?error.message:"Unable to load approvals")}finally{setLoading(false)}
  }
  useEffect(()=>{
    let cancelled=false;
    fetch("/api/approvals")
      .then(async(response)=>{const data=await response.json() as ApprovalPayload;if(!response.ok)throw new Error(data.error);return data.approvals||[]})
      .then((approvals)=>{if(cancelled)return;setItems(approvals);setSelected(approvals[0]||null)})
      .catch((error)=>{if(!cancelled)setMessage(error instanceof Error?error.message:"Unable to load approvals")})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[]);
  const visible=useMemo(()=>items.filter(item=>filter==="All"||item.status===filter),[items,filter]);
  async function decide(status:"Approved"|"Rejected"){
    if(!selected||selected.status!=="Pending")return;setMessage("Saving decision…");
    const response=await fetch("/api/approvals",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:selected.id,status})});const data=await response.json() as ApprovalPayload;
    if(!response.ok){setMessage(data.error||"Decision could not be saved");return}setMessage(`${status} · audit event recorded`);await load();
  }
  return <main className="approvals-page"><header className="detail-top"><Link href="/" className="detail-brand"><img src="/cipher-bearagon.png" alt="Cipher, the Bearagon bear"/><span><b>BEARAGON</b><small>APPROVAL INBOX</small></span></Link><Link href="/" className="back-link">← Back to dashboard</Link></header>
    <section className="approvals-hero"><div><small>HUMAN CONTROL CENTER</small><h1>Nothing important happens silently.</h1><p>Review account-specific requests before any guarded action can continue.</p></div></section>
    <div className="approvals-content"><section className="approval-metrics"><article><small>PENDING</small><strong>{items.filter(x=>x.status==="Pending").length}</strong><span>Waiting for a person</span></article><article><small>APPROVED</small><strong>{items.filter(x=>x.status==="Approved").length}</strong><span>Decision recorded</span></article><article><small>REJECTED</small><strong>{items.filter(x=>x.status==="Rejected").length}</strong><span>Action stopped</span></article><article><small>ACCOUNT BOUNDARY</small><strong>Enforced</strong><span>Every request has an account ID</span></article></section>
      <section className="approval-layout"><div className="approval-inbox"><div className="approval-heading"><div><small>REVIEW QUEUE</small><h2>Approval requests</h2></div><span>{visible.length} shown</span></div><div className="approval-filters">{filters.map(item=><button key={item} className={filter===item?"active":""} onClick={()=>setFilter(item)}>{item}</button>)}</div>{loading?<p className="approval-empty">Loading approvals…</p>:visible.length?visible.map(item=><button key={item.id} className={selected?.id===item.id?"approval-row selected":"approval-row"} onClick={()=>setSelected(item)}><i>{item.type[0]}</i><span><b>{item.title}</b><small>{item.clientName} · {item.type}</small></span><em className={item.status.toLowerCase()}>{item.status}</em></button>):<div className="approval-empty"><b>No {filter.toLowerCase()} requests</b><span>Requests appear here when a real workflow or operator action requires a decision.</span></div>}</div>
        <aside className="approval-detail">{selected?<><div className="approval-client"><small>ACCOUNT-SCOPED REQUEST</small><b>{selected.clientName}</b><span>Account {selected.clientId}</span></div><h2>{selected.title}</h2><p>{selected.summary}</p><div className="approval-facts"><span><small>TYPE</small><b>{selected.type}</b></span><span><small>RISK</small><b>{selected.riskLevel}</b></span><span><small>REQUESTED BY</small><b>{selected.requestedBy}</b></span><span><small>STATUS</small><b>{selected.status}</b></span></div><div className="approval-guardrail"><b>✓ External action remains blocked</b><span>Approving this request records the human decision only. A separate command gateway must execute and report any future action.</span></div>{selected.status==="Pending"?<div className="approval-actions"><button onClick={()=>decide("Rejected")}>Reject request</button><button className="approve" onClick={()=>decide("Approved")}>Approve & record</button></div>:<div className="approval-decision"><b>{selected.status}</b><span>{selected.decidedBy||"Authorized reviewer"} · audit event saved</span></div>}</>:<div className="approval-empty">Select a request to review it.</div>}</aside></section><p className="approval-message">{message}</p>
    </div></main>
}
