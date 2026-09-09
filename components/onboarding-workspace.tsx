"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, TriangleAlert } from "lucide-react";
import { Progress } from "./ui/progress";

type Onboarding = {
  id: string;
  accountId: string;
  accountName: string;
  contactName: string;
  contactEmail: string;
  stage: string;
  status: string;
  nextStep: string;
  targetDate: string;
  owner: string;
  total: number;
  complete: number;
  open: number;
  blocked: number;
};

const stages = ["All delivery", "Intake", "Connections", "Building", "Testing", "Live"];

function targetLabel(targetDate: string) {
  if (!targetDate) return "No target";
  return targetDate;
}

function isOverdue(targetDate: string) {
  return Boolean(targetDate && targetDate < new Date().toISOString().slice(0, 10));
}

export function OnboardingWorkspace() {
  const [items, setItems] = useState<Onboarding[]>([]);
  const [stage, setStage] = useState("All delivery");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/onboarding")
      .then(async (response) => {
        const data = await response.json() as { onboardings?: Onboarding[]; error?: string };
        if (!response.ok) throw new Error(data.error);
        setItems(data.onboardings || []);
      })
      .catch(() => setError("Onboarding work is temporarily unavailable."))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => items
    .filter((item) => (stage === "All delivery" || item.stage === stage)
      && [item.accountName, item.contactName, item.nextStep].some((value) => value.toLowerCase().includes(query.toLowerCase())))
    .sort((left, right) => Number(right.status === "blocked" || right.blocked > 0) - Number(left.status === "blocked" || left.blocked > 0)
      || Number(isOverdue(right.targetDate)) - Number(isOverdue(left.targetDate))
      || left.targetDate.localeCompare(right.targetDate)), [items, query, stage]);
  const totalOpen = items.reduce((sum, item) => sum + item.open, 0);
  const blocked = items.filter((item) => item.status === "blocked" || item.blocked > 0).length;
  const overdue = items.filter((item) => isOverdue(item.targetDate)).length;

  return <main className="company-experience">
    <header className="company-record-header"><div><small className="eyebrow">DELIVERY WORKSPACE</small><h1>Onboarding</h1><p>Accepted engagements, from setup through the final handoff.</p></div><Link href="/companies">View companies →</Link></header>
    <div className="company-lane-toolbar"><label className="account-search"><Search aria-hidden="true"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search onboarding work" aria-label="Search onboarding work"/></label><label>Delivery stage <select value={stage} onChange={e=>setStage(e.target.value)}>{stages.map(s=><option key={s}>{s}</option>)}</select></label><span>{blocked} need attention · {overdue} past target</span></div>
    {loading&&<p role="status">Loading onboarding…</p>}{error&&<p role="alert" className="company-error">{error}</p>}
    <div className="company-lane-cards">{!loading&&!error&&visible.map(item=><article className="company-panel" key={item.id}><div className="panel-heading"><div><small className="eyebrow">CLIENT ONBOARDING</small><h2>{item.accountName}</h2></div><span className="company-status">{item.blocked?'Blocked':['Building','Testing','Live'].includes(item.stage)?'Build & test':'Setup'}</span></div><p className="company-help">Owner: {item.owner||'Unassigned'} · {item.contactName} · Target: {targetLabel(item.targetDate)}</p><div className="company-lane-progress"><Progress value={item.total?100*item.complete/item.total:0} aria-label={`Saved delivery requirements for ${item.accountName}`}/><span>{item.complete}/{item.total} requirements resolved</span></div>{item.blocked>0&&<p className="company-error"><TriangleAlert size={16}/> {item.blocked} blocked requirements — open delivery for the recorded reasons.</p>}<div className="company-lane-next"><div><small className="eyebrow">NEXT ACTION</small><b>{item.nextStep||'Review saved delivery plan'}</b></div><Link className="company-primary-link" href={`/clients/${item.accountId}?tab=delivery`}>Continue onboarding →</Link></div></article>)}</div>
    {!loading&&!error&&!visible.length&&<section className="company-panel"><h2>No active onboarding in this view</h2><p>Accepted engagements stay here until the handoff to ongoing service.</p><Link href="/companies">View companies →</Link></section>}
  </main>;
}
