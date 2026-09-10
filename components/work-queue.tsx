"use client";
import { useState } from "react";
import { InquiryCleanup } from "@/components/inquiry-cleanup";
import Link from "next/link";
import { ArrowUpRight, ListTodo, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useWorkspaceRecords } from "@/components/use-workspace-records";
import { queueItems, type InquiryRecord, type DeliveryRecord, type DecisionRecord } from "@/lib/workspace-model";

export function WorkQueue() {
  const inquiries = useWorkspaceRecords<InquiryRecord>("/api/inquiries", "inquiries");
  const deliveries = useWorkspaceRecords<DeliveryRecord>("/api/onboarding", "onboardings");
  const decisions = useWorkspaceRecords<DecisionRecord>("/api/approvals?status=pending", "approvals");
  const [filter, setFilter] = useState("All work");
  const [notice,setNotice] = useState("");
  const sources = [{ label: "Inquiries", href: "/communications", ...inquiries }, { label: "Onboarding", href: "/onboarding", ...deliveries }, { label: "Approvals", href: "/approvals", ...decisions }];
  const loading = sources.some(s => s.loading);
  const failed = sources.some(s => s.error);
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const items = queueItems(inquiries.records, deliveries.records, decisions.records, today);
  const visible = items.filter(i => filter === "All work" || (filter === "Delivery" ? i.kind.includes("delivery") || i.kind === "Delivery" : i.kind === filter));
  return <AppShell><main className="lane-page">
    <header className="lane-header"><div><small>YOUR OPERATING PICTURE</small><h1>Work queue</h1><p>Follow up, deliver, and keep the next decision moving.</p></div><Button variant="outline" disabled={loading} onClick={() => sources.forEach(s => s.refresh())}><RefreshCw size={16} />Refresh</Button></header>
    <div className="lane-body">
      {notice && <p role="status">{notice}</p>}
      <div className="lane-shortcuts"><Link href="/communications">Inquiry inbox & intake review <ArrowUpRight /></Link><Link href="/approvals">Review approvals <ArrowUpRight /></Link><Link href="/operations">Ongoing operations <ArrowUpRight /></Link></div>
      <p className="lane-note">Saved inquiries and delivery records appear here. Open the inquiry inbox to sync website/call receipts and resolve identity review. Current Console reports are retrieved within each company’s Services page.</p>
      {sources.filter(s => s.error).map(s => <p className="lane-error" role="alert" key={s.label}>{s.label}: {s.error} <Link href={s.href}>Open {s.label.toLowerCase()}</Link></p>)}
      <section className="lane-panel" aria-labelledby="queue-title"><div className="lane-panel-heading"><h2 id="queue-title">Next actions</h2><label className="lane-filter">Show<select value={filter} onChange={e => setFilter(e.target.value)}>{["All work", "Inquiry", "Delivery", "Approval"].map(v => <option key={v}>{v}</option>)}</select></label></div>
        {loading && <p role="status" className="lane-empty">Loading saved work…</p>}
        {!loading && visible.map(item => {const inquiry=inquiries.records.find(i=>`inquiry:${i.id}`===item.id);return <div key={item.id}><Link className="lane-work-row" href={item.href}><span className="lane-kind">{item.kind}</span><div><strong>{item.company}</strong><p>{item.title}</p></div><span className="lane-owner">{item.owner}<small>{item.due ? `Due ${item.due}` : "No date set"}</small></span><ArrowUpRight aria-hidden="true" /></Link>{inquiry&&<div className="inquiry-cleanup-action"><InquiryCleanup inquiry={inquiry} onDone={message=>{setNotice(message);inquiries.refresh();}}/></div>}</div>;})}
        {!loading && !visible.length && <div className="lane-empty"><ListTodo /><h3>{failed ? "This view is incomplete" : "No open work in this view"}</h3><p>{failed ? "Some sources are unavailable. Resolve those errors before relying on this queue." : "Review intake for new receipts, or open a company to plan the next action."}</p></div>}
      </section>
    </div></main></AppShell>;
}
