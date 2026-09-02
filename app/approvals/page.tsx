"use client";
import { useEffect, useMemo, useState } from "react";

type Approval = { id:number; clientId:number; clientName:string; type:string; title:string; summary:string; riskLevel:string; status:string; requestedBy:string; decidedBy:string; decidedAt:string; createdAt:string };
type Client = { id:number; companyName:string };
const filters = ["Pending", "Approved", "Rejected", "All"];

export default function ApprovalsPage(){
  const [items,setItems]=useState<Approval[]>([]),[clients,setClients]=useState<Client[]>([]),[selected,setSelected]=useState<Approval|null>(null),[filter,setFilter]=useState("Pending"),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
  async function load(){
    setLoading(true);
    try{const [a,c]=await Promise.all([fetch("/api/approvals"),fetch("/api/clients")]);const ad=await a.json(),cd=await c.json();if(!a.ok)throw new Error(ad.error);setItems(ad.approvals||[]);setClients(cd.clients||[]);setSelected((current)=>current ? (ad.approvals||[]).find((item:Approval)=>item.id===current.id)||null : (ad.approvals||[])[0]||null)}catch(error){setMessage(error instanceof Error?error.message:"Unable to load approvals")}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);
  const visible=useMemo(()=>items.filter(item=>filter==="All"||item.status===filter),[items,filter]);
  async function decide(status:"Approved"|"Rejected"){
    if(!selected||selected.status!=="Pending")return;setMessage("Saving decision…");
    const response=await fetch("/api/approvals",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:selected.id,status})});const data=await response.json();
    if(!response.ok){setMessage(data.error||"Decision could not be saved");return}setMessage(`${status} · audit event recorded`);await load();
  }
  async function createDemo(){
    if(!clients.length){setMessage("Add a client before creating an approval request.");return}setMessage("Creating guarded demo request…");
    const response=await fetch("/api/approvals",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId:clients[0].id,type:"Call follow-up",title:"Review urgent REtell call follow-up",summary:"Cipher classified a simulated missed call as urgent. Review the suggested callback task before it is assigned. No call or message will be sent."})});const data=await response.json();
    if(!response.ok){setMessage(data.error||"Demo request could not be created");return}setFilter("Pending");setMessage("Demo approval created · no external action taken");await load();
  }
  return <main className="approvals-page"><header className="detail-top"><a href="/" className="detail-brand"><img src="/cipher-bearagon.png" alt="Cipher, the Bearagon bear"/><span><b>BEARAGON</b><small>APPROVAL INBOX</small></span></a><a href="/" className="back-link">← Back to dashboard</a></header>
    <section className="approvals-hero"><div><small>HUMAN CONTROL CENTER</small><h1>Nothing important happens silently.</h1><p>Review client-specific requests before any guarded action can continue.</p></div><button onClick={createDemo}>＋ Create safe demo request</button></section>
    <div className="approvals-content"><section className="approval-metrics"><article><small>PENDING</small><strong>{items.filter(x=>x.status==="Pending").length}</strong><span>Waiting for a person</span></article><article><small>APPROVED</small><strong>{items.filter(x=>x.status==="Approved").length}</strong><span>Decision recorded</span></article><article><small>REJECTED</small><strong>{items.filter(x=>x.status==="Rejected").length}</strong><span>Action stopped</span></article><article><small>CLIENT BOUNDARY</small><strong>Enforced</strong><span>Every request has a client ID</span></article></section>
      <section className="approval-layout"><div className="approval-inbox"><div className="approval-heading"><div><small>REVIEW QUEUE</small><h2>Approval requests</h2></div><span>{visible.length} shown</span></div><div className="approval-filters">{filters.map(item=><button key={item} className={filter===item?"active":""} onClick={()=>setFilter(item)}>{item}</button>)}</div>{loading?<p className="approval-empty">Loading approvals…</p>:visible.length?visible.map(item=><button key={item.id} className={selected?.id===item.id?"approval-row selected":"approval-row"} onClick={()=>setSelected(item)}><i>{item.type[0]}</i><span><b>{item.title}</b><small>{item.clientName} · {item.type}</small></span><em className={item.status.toLowerCase()}>{item.status}</em></button>):<div className="approval-empty"><b>No {filter.toLowerCase()} requests</b><span>Create a safe demo request to prove the approval flow.</span></div>}</div>
        <aside className="approval-detail">{selected?<><div className="approval-client"><small>CLIENT-SCOPED REQUEST</small><b>{selected.clientName}</b><span>Client ID {selected.clientId}</span></div><h2>{selected.title}</h2><p>{selected.summary}</p><div className="approval-facts"><span><small>TYPE</small><b>{selected.type}</b></span><span><small>RISK</small><b>{selected.riskLevel}</b></span><span><small>REQUESTED BY</small><b>{selected.requestedBy}</b></span><span><small>STATUS</small><b>{selected.status}</b></span></div><div className="approval-guardrail"><b>✓ External action remains blocked</b><span>Approving this demonstration records the decision only. It does not call, message, email, schedule, or move money.</span></div>{selected.status==="Pending"?<div className="approval-actions"><button onClick={()=>decide("Rejected")}>Reject request</button><button className="approve" onClick={()=>decide("Approved")}>Approve & record</button></div>:<div className="approval-decision"><b>{selected.status}</b><span>{selected.decidedBy||"Authorized reviewer"} · audit event saved</span></div>}</>:<div className="approval-empty">Select a request to review it.</div>}</aside></section><p className="approval-message">{message}</p>
    </div></main>
}
