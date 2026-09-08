"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, TriangleAlert } from "lucide-react";

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

  return <main className="ops-onboarding-page">
    <header className="ops-onboarding-header">
      <div><small>DELIVERY WORKSPACE</small><h1>Onboarding</h1><p>Active delivery, blockers, and the next accountable action. Each row opens the company’s saved delivery plan.</p></div>
      <Link href="/companies" className="ops-header-action">View companies</Link>
    </header>
    <div className="ops-onboarding-content">
      <section className="onboarding-metrics" aria-label="Delivery queue summary">
        <article><small>ACTIVE ONBOARDINGS</small><strong>{items.length}</strong><span>In delivery now</span></article>
        <article className={blocked ? "attention" : ""}><small>NEEDS ATTENTION</small><strong>{blocked}</strong><span>Blocked account plans</span></article>
        <article><small>OPEN TASKS</small><strong>{totalOpen}</strong><span>Across active checklists</span></article>
        <article className={overdue ? "attention" : ""}><small>PAST TARGET</small><strong>{overdue}</strong><span>Plans to review</span></article>
      </section>
      <section className="onboarding-queue-panel" aria-labelledby="onboarding-queue-heading">
        <div className="onboarding-queue-head"><div><small>ACTIVE DELIVERY</small><h2 id="onboarding-queue-heading">Onboarding queue</h2></div><label className="account-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search onboarding work" aria-label="Search onboarding work" /></label></div>
        <div className="onboarding-filter-row"><label className="stage-filter"><span>Filter by delivery stage</span><select value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Filter onboarding work by delivery stage">{stages.map((item) => <option key={item}>{item}</option>)}</select></label><span>{loading ? "" : `${visible.length} shown`}</span></div>
        <div className="onboarding-table">
          <div className="onboarding-table-labels"><span>ACCOUNT</span><span>STAGE</span><span>CHECKLIST</span><span>NEXT ACTION</span><span>TARGET</span></div>
          {loading && <p className="onboarding-empty">Loading onboarding work…</p>}
          {!loading && error && <p className="onboarding-empty">{error}</p>}
          {!loading && !error && visible.map((item) => {
            const progress = item.total ? Math.round((item.complete / item.total) * 100) : 0;
            const attention = item.status === "blocked" || item.blocked > 0 || isOverdue(item.targetDate);
            return <Link href={`/clients/${item.accountId}?tab=onboarding`} className={attention ? "onboarding-row attention" : "onboarding-row"} key={item.id}>
              <span className="onboarding-account"><i>{item.accountName.split(" ").filter(Boolean).map((word) => word[0]).join("").slice(0, 3)}</i><span><b>{item.accountName}</b><small>{item.contactName}{item.contactEmail ? ` · ${item.contactEmail}` : ""}</small></span></span>
              <span><em className={`pill ${item.stage.toLowerCase()}`}>{item.stage}</em></span>
              <span className="onboarding-progress"><b>{item.complete}/{item.total}</b><i><span style={{ width: `${progress}%` }} /></i><small>{progress}% complete · {item.open} open</small></span>
              <span className="onboarding-next"><b>{item.nextStep || "Set next action"}</b>{item.blocked > 0 && <small><TriangleAlert aria-hidden="true" /> {item.blocked} blocked task{item.blocked === 1 ? "" : "s"}</small>}</span>
              <span className={isOverdue(item.targetDate) ? "onboarding-target overdue" : "onboarding-target"}>{targetLabel(item.targetDate)}{isOverdue(item.targetDate) && <small>Review target</small>}</span>
            </Link>;
          })}
          {!loading && !error && !visible.length && <div className="onboarding-empty"><b>{items.length ? "No onboarding work matches this view." : "No active onboarding work."}</b><span>{items.length ? "Try a different delivery stage or search term." : "Start onboarding from a company when delivery is ready."}</span>{!items.length && <Link href="/companies">Open companies</Link>}</div>}
        </div>
      </section>
    </div>
  </main>;
}
