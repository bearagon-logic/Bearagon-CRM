"use client";
import { useState } from "react";
import { InquiryActions } from "@/components/inquiry-actions";
import Link from "next/link";
import { ArrowUpRight, ListTodo, RefreshCw } from "lucide-react";
import { WorkNavigation } from '@/components/work-navigation';
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useWorkspaceRecords } from "@/components/use-workspace-records";
import type { ScopingRecord } from '@/lib/server/scoping-work';
import { queueItems, scopingQueueItems, type InquiryRecord, type DeliveryRecord, type DecisionRecord, type QueueItem } from "@/lib/workspace-model";

export function WorkQueue() {
  const inquiries = useWorkspaceRecords<InquiryRecord>("/api/inquiries", "inquiries");
  const deliveries = useWorkspaceRecords<DeliveryRecord>("/api/onboarding", "onboardings");
  const decisions = useWorkspaceRecords<DecisionRecord>("/api/approvals?status=pending", "approvals");
  const scoping = useWorkspaceRecords<ScopingRecord>("/api/scoping", "scoping");
  const internal = useWorkspaceRecords<QueueItem>("/api/internal-work", "items");
  const [filter, setFilter] = useState("All work");
  const [owner,setOwner]=useState('All owners'),[timing,setTiming]=useState('All dates');
  const [notice,setNotice] = useState("");
  const sources = [{label:"Scope",href:"/onboarding",...scoping},{ label: "Inquiries", href: "/communications", ...inquiries }, { label: "Onboarding", href: "/onboarding", ...deliveries }, { label: "Approvals", href: "/approvals", ...decisions }, {label:"Internal automations",href:"/operations",...internal}];
  const loading = sources.some(s => s.loading);
  const failed = sources.some(s => s.error);
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const items = [...queueItems(inquiries.records, deliveries.records, decisions.records, today),...scopingQueueItems(scoping.records,today),...internal.records].sort((a,b)=>a.priority-b.priority);
  const visible = items.filter(i=>(owner==='All owners'||i.owner===owner)&&(timing==='All dates'||timing==='Overdue'&&!!i.due&&i.due<today||timing==='No date'&&!i.due)).filter(i => filter === "All work" || (filter === "Delivery" ? i.kind.includes("delivery") || i.kind === "Delivery" : i.kind === filter));
  return <AppShell><main className="lane-page work-view onboarding-work-queue">
    <header className="lane-header work-queue-header"><div className="work-queue-brand-strip"><img src="/bearagon-work-queue-banner.png" alt="Bearagon Logic" width={2172} height={724} decoding="async"/></div><div className="work-queue-heading"><div><h1>Work queue</h1><p>Follow up, deliver, and keep the next decision moving.</p></div><Button variant="outline" disabled={loading} onClick={() => sources.forEach(s => s.refresh())}><RefreshCw size={16} />Refresh</Button></div></header>
    <WorkNavigation current="/"/><div className="lane-body">
      {notice && <p role="status">{notice}</p>}

      <p className="lane-note">Prioritized follow-ups, scope, delivery work and decisions. Use Inbox to review new website and call inquiries.</p>
      {sources.filter(s => s.error).map(s => <p className="lane-error" role="alert" key={s.label}>{s.label}: {s.error} <Link href={s.href}>Open {s.label.toLowerCase()}</Link></p>)}
      <section className="lane-panel" aria-labelledby="queue-title"><div className="lane-panel-heading"><h2 id="queue-title">Next actions</h2><label className="lane-filter">Show<select value={filter} onChange={e => setFilter(e.target.value)}>{["All work", "Inquiry", "Lead", "Scope", "Delivery", "Internal automation", "Approval"].map(v => <option key={v}>{v}</option>)}</select></label><label className="lane-filter">Owner<select value={owner} onChange={e=>setOwner(e.target.value)}>{['All owners',...new Set(items.map(i=>i.owner))].map(v=><option key={v}>{v}</option>)}</select></label><label className="lane-filter">Due<select value={timing} onChange={e=>setTiming(e.target.value)}>{['All dates','Overdue','No date'].map(v=><option key={v}>{v}</option>)}</select></label></div>
        {loading && <p role="status" className="lane-empty">Loading saved work…</p>}
        {!loading && visible.map(item => {const inquiry=inquiries.records.find(i=>`inquiry:${i.id}`===item.id);return <div className="queue-item" key={item.id}><Link className="lane-work-row" href={item.href}><span className="lane-kind">{item.kind}</span><div><strong>{item.company}</strong><p>{item.title}</p></div><span className="lane-owner">{item.owner}<small>{item.due ? `Due ${item.due}` : "No date set"}</small></span><ArrowUpRight aria-hidden="true" /></Link>{inquiry&&<InquiryActions inquiry={inquiry} onDone={message=>{setNotice(message);inquiries.refresh();}}/>}</div>;})}
        {!loading && !visible.length && <div className="lane-empty"><ListTodo /><h3>{failed ? "This view is incomplete" : "No open work in this view"}</h3><p>{failed ? "Some sources are unavailable. Resolve those errors before relying on this queue." : "Review intake for new receipts, or open a company to plan the next action."}</p></div>}
      </section>
    </div></main></AppShell>;
}
