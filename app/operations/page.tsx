"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { WorkNavigation } from '@/components/work-navigation';
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useWorkspaceRecords } from "@/components/use-workspace-records";
import { isOngoing, type CompanyRecord } from "@/lib/workspace-model";

export default function Operations() {
  const source = useWorkspaceRecords<CompanyRecord>("/api/clients", "clients");
  const [filter, setFilter] = useState("All");
  const companies = source.records.filter(c => (isOngoing(c) || c.organizationKind === "internal") && (filter === "All" || (filter === "Internal" ? c.organizationKind === "internal" : c.organizationKind !== "internal")));
  return <AppShell><main className="lane-page work-view"><header className="lane-header"><div><small>ONGOING SERVICE</small><h1>Operations</h1><p>What each company ordered, its installations, and the latest available Console reports.</p></div><Link className="ops-header-action" href="/automations">Automation inventory</Link></header><WorkNavigation current="/operations"/><div className="lane-body">
    <div className="lane-panel-heading"><label className="lane-filter">Show<select value={filter} onChange={e => setFilter(e.target.value)}>{["All", "Clients", "Internal"].map(v => <option key={v}>{v}</option>)}</select></label><Button variant="outline" onClick={source.refresh} disabled={source.loading}>Refresh companies</Button></div>
    <p className="lane-note">Completed live onboarding and Bearagon’s internal organization. A linked workspace is a configuration record—not proof of health. Open Services to retrieve account-scoped Console data, including its source and age.</p>
    {source.error && <p role="alert" className="lane-error">{source.error}</p>}{source.loading && <p role="status">Loading companies…</p>}
    {!source.loading && companies.map(c => <article className="lane-panel lane-company" key={c.id}><div><span className="lane-kind">{c.organizationKind === "internal" ? "Internal organization" : "Ongoing service"}</span><h2>{c.companyName}</h2><p>Owner: {c.relationshipOwner || "Unassigned"}</p></div><dl><div><dt>Workspace configuration</dt><dd>{c.workspaceStatus.replaceAll("_", " ")}</dd></div><div><dt>Next recorded action</dt><dd>{c.organizationKind==='internal'?'Review individual automation work':c.nextStep || "Not set"}</dd></div></dl><div className="lane-shortcuts"><Link href={`/clients/${encodeURIComponent(c.id)}?tab=automations`}>Services & Console reports <ArrowUpRight /></Link><Link href={`/clients/${encodeURIComponent(c.id)}?tab=onboarding`}>{c.organizationKind==='internal'?'Automation work':'Delivery history'} <ArrowUpRight /></Link></div></article>)}
    {!source.loading && !source.error && !companies.length && <section className="lane-panel lane-empty"><h2>No companies in this view</h2><p>Companies appear after onboarding is completed at the Live stage. Bearagon’s internal profile is available here once created.</p><Link href="/companies">Open companies</Link></section>}
  </div></main></AppShell>;
}
