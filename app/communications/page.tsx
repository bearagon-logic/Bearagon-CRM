"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";

type Item = { id:number; type:"Call"|"Text"; name:string; contact:string; time:string; category:string; priority:"Urgent"|"Normal"|"Spam"; summary:string; transcript:string };
const initialItems:Item[] = [
  { id:1,type:"Call",name:"Jordan Lee",contact:"New prospect",time:"10:42 AM",category:"Needs callback",priority:"Urgent",summary:"Website is down before a customer launch. Requested a callback as soon as possible.",transcript:"Caller reported that the company website became unavailable this morning. Cipher collected their name, company, callback number, and impact. No technical promise was made." },
  { id:2,type:"Text",name:"Maya Chen",contact:"Atlas Design Co.",time:"9:18 AM",category:"Appointment request",priority:"Normal",summary:"Asked to move tomorrow’s onboarding call to the afternoon.",transcript:"Hi, could we move tomorrow’s onboarding call to sometime after 2 PM? Thank you." },
  { id:3,type:"Call",name:"Unknown caller",contact:"Unverified number",time:"8:54 AM",category:"Likely solicitation",priority:"Spam",summary:"Repeated sales solicitation with no client or service context.",transcript:"Filtered after the caller could not provide a client name, project, or legitimate service request." },
  { id:4,type:"Call",name:"Robert Ellis",contact:"North Ridge Plumbing",time:"Yesterday",category:"Billing question",priority:"Normal",summary:"Asked whether the onboarding deposit was received.",transcript:"Cipher captured the question for the billing team. No account balance or payment information was disclosed." },
];
const filters=["All","Urgent","Needs reply","Filtered"];

export default function Communications(){
  const [filter,setFilter]=useState("All");
  const [selected,setSelected]=useState<Item>(initialItems[0]);
  const [handled,setHandled]=useState<number[]>([]);
  const [escalated,setEscalated]=useState<number[]>([]);
  const [rules,setRules]=useState({disclosure:true,sensitive:true,emergency:true,recording:false});
  const visible=useMemo(()=>initialItems.filter(item=>filter==="All"||(filter==="Urgent"&&item.priority==="Urgent")||(filter==="Needs reply"&&item.priority!=="Spam"&&!handled.includes(item.id))||(filter==="Filtered"&&item.priority==="Spam")),[filter,handled]);
  useEffect(()=>{if(!visible.some((item)=>item.id===selected.id))setSelected(visible[0]||initialItems[0])},[visible,selected.id]);
  return <AppShell><main className="communications-page">
    <section className="communications-hero"><div><small>CLIENT COMMUNICATIONS</small><h1>Every caller gets a clear next step.</h1><p>Answer, filter, summarize, and route inbound conversations with human control.</p></div><a href="/security">Review safeguards →</a></section>
    <div className="communications-content">
      <section className="communications-metrics"><article><small>NEW TODAY</small><strong>3</strong><span>Calls and messages</span></article><article><small>URGENT</small><strong>1</strong><span>Needs human callback</span></article><article><small>FILTERED</small><strong>1</strong><span>Likely solicitation</span></article><article><small>AVERAGE ANSWER</small><strong>&lt; 10s</strong><span>Target response time</span></article></section>
      <section className="communications-layout" id="inbox">
        <div className="inbox-panel">
          <div className="communications-heading"><div><small>UNIFIED INBOX</small><h2>Calls and messages</h2></div><span>{visible.length} shown</span></div>
          <div className="communications-filters">{filters.map(item=><button key={item} className={filter===item?"selected":""} onClick={()=>setFilter(item)}>{item}</button>)}</div>
          <div className="communications-list">{visible.map(item=><button key={item.id} className={"communication-row "+(selected.id===item.id?"active":"")} onClick={()=>setSelected(item)}>
            <i>{item.type==="Call"?"☎":"✉"}</i><span><b>{item.name}</b><small>{item.summary}</small></span><em className={item.priority.toLowerCase()}>{item.priority}</em><time>{item.time}</time>
          </button>)}{!visible.length&&<div className="communication-empty">No conversations match this view.</div>}</div>
        </div>
        <aside className="conversation-detail">
          <div className="conversation-title"><span><small>{selected.type.toUpperCase()} · {selected.time}</small><h2>{selected.name}</h2><p>{selected.contact}</p></span><em className={selected.priority.toLowerCase()}>{selected.priority}</em></div>
          <div className="intent-card"><small>DETECTED INTENT</small><b>{selected.category}</b><p>{selected.summary}</p></div>
          <div className="transcript-card"><small>MESSAGE SUMMARY</small><p>{selected.transcript}</p><span>Demo content · Recording not enabled</span></div>
          <div className="conversation-actions">
            <button className="primary-call-action" onClick={()=>setHandled(v=>v.includes(selected.id)?v:[...v,selected.id])}>{handled.includes(selected.id)?"✓ Marked handled":"Mark handled"}</button>
            <button onClick={()=>setEscalated(v=>v.includes(selected.id)?v:[...v,selected.id])}>{escalated.includes(selected.id)?"✓ Escalated":"Escalate to human"}</button>
          </div>
        </aside>
      </section>
      <section className="routing-section" id="routing">
        <div className="routing-heading"><small>ANSWERING GUARDRAILS</small><h2>Rules for every conversation</h2><p>These demonstration controls show what clients can approve before their phone line goes live.</p></div>
        <div className="routing-rules">
          <label><span><b>Identify as an AI assistant</b><small>Give a clear disclosure at the beginning of the call.</small></span><input type="checkbox" checked={rules.disclosure} onChange={()=>setRules({...rules,disclosure:!rules.disclosure})}/></label>
          <label><span><b>Protect sensitive information</b><small>Never repeat passwords, payment details, or private account data.</small></span><input type="checkbox" checked={rules.sensitive} onChange={()=>setRules({...rules,sensitive:!rules.sensitive})}/></label>
          <label><span><b>Emergency handoff</b><small>Stop the business flow and direct emergencies to appropriate emergency services.</small></span><input type="checkbox" checked={rules.emergency} onChange={()=>setRules({...rules,emergency:!rules.emergency})}/></label>
          <label><span><b>Recording and transcription</b><small>Off until the client approves a legally appropriate consent notice.</small></span><input type="checkbox" checked={rules.recording} onChange={()=>setRules({...rules,recording:!rules.recording})}/></label>
        </div>
      </section>
      <section className="phone-flow" id="phone-flow"><img src="/cipher-bearagon.png" alt="" aria-hidden="true"/><div><small>CIPHER CALL FLOW</small><h2>Greet → Verify → Understand → Route → Log</h2><p>No promises, payments, or sensitive disclosures without an authorized person.</p></div></section>
    </div>
  </main></AppShell>;
}
