"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConsoleConnection } from "@/components/console-connection";
import { serviceObservation } from "@/lib/service-observation";
import type { WorkspaceAutomationOverview } from "@/lib/contracts/platform";

type Service = {
  delivery?: ReturnType<typeof import('@/lib/workflow-ux').managedService>;
  id: string; name: string; status: string; quoteRef: string; acceptedAt: string;
  setupFeeCents: number | null; monthlyFeeCents: number | null; currency: string;
  scope: string; maintenance: string; configuration: string; startDate: string; endDate: string; installationIds: string[];
};
type Installation = { id: string; name: string; description: string; trigger: string; action: string; desiredState: string; consoleAutomationId: string | null; deliveryStage: string; approvalRequired: boolean };
type Status = { state: string; message?: string; workspace?: { displayName: string; consoleClientId: string }; overview?: WorkspaceAutomationOverview };
const blank: Service = { id: "", name: "", status: "proposed", quoteRef: "", acceptedAt: "", setupFeeCents: null, monthlyFeeCents: null, currency: "USD", scope: "", maintenance: "", configuration: "", startDate: "", endDate: "", installationIds: [] };
function money(cents: number | null, currency: string) { return cents === null ? "Not recorded" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100); }
function servicePrice(s:Service, kind:'setup'|'monthly') {
  const value=kind==='setup'?s.setupFeeCents:s.monthlyFeeCents;
  if(value!==null)return money(value,s.currency);
  if(s.delivery?.internal)return 'Internal service · no customer charge';
  if(s.delivery&&(kind==='setup'||s.delivery.packagePricing))return 'Included in accepted package';
  return 'Not recorded';
}
function when(value?: string) { return value ? new Date(value).toLocaleString() : "No run received"; }
function quoteLink(ref: string) { return /^https?:\/\//i.test(ref) ? <a href={ref} target="_blank" rel="noreferrer">View quote ↗</a> : ref || "No quote recorded"; }

export function ServiceSummary({ accountId, openServices }: { accountId: string; openServices: () => void }) {
  const [services, setServices] = useState<Service[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let active = true; fetch(`/api/clients/${accountId}/services`).then(async r => { if (!r.ok) throw new Error(); const data = await r.json() as { services: Service[] }; if (active) setServices(data.services); }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, [accountId]);
  return <article className="service-panel"><div className="service-panel-heading"><div><h2>Customer services</h2><p>{failed ? "Services could not be loaded." : !services ? "Loading services…" : services.length ? `${services.filter(s => s.status === "active").length} active · ${services.filter(s => s.status === "ordered").length} ordered · ${services.filter(s => s.status === "proposed").length} proposed` : "No purchased services recorded yet."}</p></div><button onClick={openServices}>Services &amp; automations →</button></div>{services?.filter(s => s.status !== "ended").map(s => <p key={s.id}><b>{s.name}</b> · {s.status} · {servicePrice(s,'monthly')}</p>)}</article>;
}

export function AccountServices({ accountId, companyName }: { accountId: string; companyName: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Service | null>(null);
  const [editError, setEditError] = useState("");
  const [linkChoices, setLinkChoices] = useState<Record<string, string>>({});
  const [showConnection, setShowConnection] = useState(false);
  const [tick, setTick] = useState(Date.now());
  async function load() {
    setLoading(true); setError(""); setStatus(null);
    const results = await Promise.allSettled([
      fetch(`/api/clients/${accountId}/services`, { cache: "no-store" }).then(async r => { const d = await r.json() as { error?: string; services: Service[] }; if (!r.ok) throw new Error(d.error || "Services could not be loaded."); return d; }),
      fetch(`/api/automations?accountId=${encodeURIComponent(accountId)}`, { cache: "no-store" }).then(async r => { const d = await r.json() as { error?: string; workflows: Installation[] }; if (!r.ok) throw new Error(d.error || "Automations could not be loaded."); return d; }),
      fetch(`/api/platform/status?accountId=${encodeURIComponent(accountId)}`, { cache: "no-store" }).then(async r => { const d = await r.json() as Status & { error?: string }; if (!r.ok && !d.state) throw new Error(d.error); return d as Status; }),
    ]);
    if (results[0].status === "fulfilled") setServices(results[0].value.services); else setError("Services could not be refreshed. Try again.");
    if (results[1].status === "fulfilled") setInstallations(results[1].value.workflows); else setError("Automations could not be refreshed. Try again.");
    setStatus(results[2].status === "fulfilled" ? results[2].value : { state: "unavailable", message: "Console could not be reached. No current observation is available." });
    setLoading(false);
  }
  useEffect(() => { void load(); }, [accountId]);
  useEffect(() => { const timer = setInterval(() => setTick(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const overview = status?.overview;
  const stale = overview ? tick - Date.parse(overview.fetchedAt) > 300000 : false;
  async function save() {
    if (!draft) return;
    setBusy(true); setEditError("");
    try {
      const r = await fetch(`/api/clients/${accountId}/services`, { method: draft.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const data = await r.json() as { error?: string }; if (!r.ok) throw new Error(data.error || "Unable to save service.");
      setDraft(null); setMessage("Service saved."); await load();
    } catch (e) { setEditError(e instanceof Error ? e.message : "Unable to save service."); }
    finally { setBusy(false); }
  }
  async function match(installation: Installation) {
    setBusy(true); setMessage(""); setError("");
    try {
      const r = await fetch("/api/platform/automation-link", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId, installationId: installation.id, consoleSlug: linkChoices[installation.id] ?? installation.consoleAutomationId ?? "" }) });
      const data = await r.json() as { error?: string }; if (!r.ok) throw new Error(data.error);
      setMessage("Console automation match saved."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to match automation."); }
    finally { setBusy(false); }
  }
  const acceptedPackage=services.find(s=>s.delivery)?.delivery;
  const linkedIds = new Set(services.flatMap(s => s.installationIds));
  const unmatched = overview?.automations.filter(a => !installations.some(i => i.consoleAutomationId === a.slug || i.consoleAutomationId === a.id)) ?? [];
  function automationRow(i: Installation) {
    const observation = serviceObservation(i, overview);
    return <div className="service-automation" key={i.id}>
      <div><h4>{i.name}</h4><p>{i.description || `${i.trigger} → ${i.action}`}</p><p><b>Intended:</b> {i.desiredState} · {i.deliveryStage.replaceAll("_", " ")} · {i.approvalRequired ? "Approval required" : "No approval step"}</p></div>
      <div><span className={`service-badge ${observation.mismatch ? "proposed" : ""}`}>{observation.label}</span>{observation.automation && <p><b>Console:</b> {observation.automation.lifecycle}{observation.mismatch && " · Differs from intended state"}{stale && " · Older snapshot"}</p>}<p>{observation.run ? `Last reported run: ${observation.run.status} · ${when(observation.run.finished_at || observation.run.started_at)}` : "No recent run received"}</p>{observation.automation?.cadence && <p>Reported schedule: {observation.automation.cadence}</p>}</div>
      <div className="automation-match"><label>Console automation<select value={linkChoices[i.id] ?? i.consoleAutomationId ?? ""} onChange={e => setLinkChoices({ ...linkChoices, [i.id]: e.target.value })} disabled={!overview || busy}><option value="">Not matched</option>{i.consoleAutomationId && !overview?.automations.some(a => a.slug === i.consoleAutomationId) && <option value={i.consoleAutomationId}>Saved reference: {i.consoleAutomationId}</option>}{overview?.automations.map(a => <option key={a.slug} value={a.slug}>{a.title}</option>)}</select></label><button disabled={!overview || busy} onClick={() => match(i)}>Save match</button></div>
    </div>;
  }
  return <section className="services-page account-services">
    <header className="service-panel-heading"><div><h2>Services &amp; automations</h2><p>Build readiness, linked installations and Console observations.</p></div><button onClick={() => { setDraft({ ...blank }); setEditError(""); }} disabled={loading || Boolean(error)}>Add service</button></header>
    <div className="service-panel console-summary"><div><h3>{loading ? "Checking Console…" : overview ? "Console data received" : "Console data not available"}</h3><p>{overview ? `Workspace ${status?.workspace?.displayName || overview.consoleClientId} · Retrieved ${when(overview.fetchedAt)}${stale ? " · Refresh to check current state" : ""}` : status?.message || "Checking account connection…"}</p>{overview && <p>{overview.automations.length} automations · {overview.runs.length} recent runs received · {overview.connectors.length} connectors</p>}</div><div className="service-actions"><button onClick={load} disabled={loading || busy}>Refresh data</button><button onClick={() => setShowConnection(!showConnection)}>{showConnection ? "Hide connection" : "Workspace connection"}</button></div></div>
    {!loading&&services.length>0&&<section className="service-panel"><h3>Delivery & reporting at a glance</h3><div className="service-progress-table"><table><thead><tr><th>Service</th><th>Build & test</th><th>Installation</th><th>Console observation</th><th>Next action</th></tr></thead><tbody>{services.map(s=>{const linked=installations.filter(i=>s.installationIds.includes(i.id));return <tr key={s.id}><th scope="row">{s.name}<small>{s.status}</small></th><td>{s.delivery?(s.delivery.current?s.delivery.order.status.replaceAll('_',' '):'Revalidation required'):'No package evidence'}<small>{s.delivery?`Setup revision ${s.delivery.order.setupRevision}`:''}</small></td><td>{s.installationIds.length?`${s.installationIds.length} linked`:'Not linked'}</td><td>{linked.length?linked.map(i=><div key={i.id}>{i.name}: {serviceObservation(i,overview).label}{stale?' · stale snapshot':''}</div>):'Unknown · no installation linked'}</td><td>{!s.installationIds.length?<Button variant="outline" onClick={()=>{setDraft(s);setEditError('');}}>Link installation</Button>:<a href={`#service-${s.id}`}>Review reports ↓</a>}<Link href={`/clients/${accountId}?tab=delivery`}>View build evidence →</Link></td></tr>;})}</tbody></table></div></section>}
    {acceptedPackage&&!acceptedPackage.internal&&<section className="service-panel accepted-package"><h3>Accepted package · scope revision {acceptedPackage.scopeRevision}</h3><dl className="service-facts"><div><dt>One-time setup</dt><dd>{money(acceptedPackage.setup,'USD')}</dd></div><div><dt>Monthly package · billed in advance</dt><dd>{money(acceptedPackage.monthly,'USD')}</dd></div></dl><p>Package totals—not additional charges per service. <Link href={`/clients/${accountId}?tab=services&step=review`}>Review agreed scope and usage limits →</Link></p></section>}
    {showConnection && <ConsoleConnection accountId={accountId} onLinked={load} />}
    {error && <p className="service-error" role="alert">{error}</p>}<p role="status">{message}</p>
    {!loading && !services.length && !error && <article className="service-panel service-empty"><h3>Record what this company purchased</h3><p>Add the service, accepted quote, setup fee, monthly fee, and agreed configuration. Then associate the automations that deliver it.</p><button onClick={() => { setDraft({ ...blank }); setEditError(""); }}>Add first service</button></article>}
    {services.map(s => <article className="service-panel" id={`service-${s.id}`} key={s.id}>
      <div className="service-panel-heading"><div><span className={`service-badge ${s.status}`}>{s.status}</span><h3>{s.name}</h3></div><button onClick={() => { setDraft(s); setEditError(""); }} disabled={busy || loading}>Edit service</button></div>
      <dl className="service-facts"><div><dt>Quote / agreement</dt><dd>{quoteLink(s.quoteRef)}</dd><dd>{s.acceptedAt ? `Accepted ${s.acceptedAt}` : "Acceptance not recorded"}</dd></div><div><dt>Setup fee</dt><dd>{servicePrice(s,'setup')}</dd></div><div><dt>Monthly service</dt><dd>{servicePrice(s,'monthly')}</dd><dd>Billed in advance</dd></div><div><dt>Service period</dt><dd>{s.startDate || "Start not set"} → {s.endDate || "Ongoing"}</dd></div></dl>
      <details className="service-scope-details"><summary>Agreed scope & configuration</summary><div className="service-scope"><div><h4>Purchased scope</h4><p>{s.scope || "Not recorded"}</p><h4>Included maintenance</h4><p>{s.maintenance || "Not recorded"}</p></div><div><h4>Agreed configuration</h4><p>{s.configuration || "Record the intended outcome, systems, schedule, and approval rules."}</p></div></div>
      </details><h4>Automations delivering this service</h4>{s.installationIds.length ? installations.filter(i => s.installationIds.includes(i.id)).map(automationRow) : <p>No automation linked yet. Create the automation, then select it in Edit service.</p>}
      <Link href={`/automations?view=create&accountId=${encodeURIComponent(accountId)}&returnTo=${encodeURIComponent(`/clients/${accountId}?tab=automations`)}`}>Create automation for this company ↗</Link>
    </article>)}
    {installations.some(i => !linkedIds.has(i.id)) && <article className="service-panel"><h3>Automations without a service assignment</h3><p>Assign these to purchased scope using Edit service.</p>{installations.filter(i => !linkedIds.has(i.id)).map(automationRow)}</article>}
    {unmatched.length > 0 && <article className="service-panel"><h3>Console automations without a CRM match</h3><p>These are reported by Console but aren’t matched to a CRM automation. Their presence does not establish a purchase.</p>{unmatched.map(a => <div className="console-unmatched" key={a.slug}><b>{a.title}</b><span>{a.lifecycle} · {a.health.label}</span><span>{a.slug}</span></div>)}</article>}
    {overview && <article className="service-panel"><h3>Connected systems reported by Console</h3>{overview.connectors.length ? overview.connectors.map((c, index) => <div className="console-unmatched" key={c.id || `${c.name}-${index}`}><b>{c.label || c.name}</b><span>{c.lifecycle.replaceAll("_", " ")}</span><span>{c.state.replaceAll("_", " ")}{c.health ? ` · ${c.health}` : ""}</span></div>) : <p>No connector records received for this workspace.</p>}<h3>Recent runs</h3>{overview.runs.length ? <div className="service-runs"><table><thead><tr><th>Automation</th><th>Result</th><th>Started</th></tr></thead><tbody>{[...overview.runs].sort((a,b) => Date.parse(b.started_at) - Date.parse(a.started_at)).slice(0, 10).map(r => <tr key={r.id}><td>{overview.automations.find(a => a.slug === r.automation_slug)?.title || r.automation_slug}</td><td>{r.status}</td><td>{when(r.started_at)}</td></tr>)}</tbody></table></div> : <p>No recent runs received. This does not establish whether the automations are healthy.</p>}</article>}
    <p><Link href="/automations">Manage automation delivery and activation requests ↗</Link></p>
    <Dialog open={Boolean(draft)} onOpenChange={open => { if (!open && !busy) setDraft(null); }}><DialogContent className="service-dialog">{draft && <form onSubmit={e => { e.preventDefault(); void save(); }}><DialogHeader><DialogTitle>{draft.id ? "Edit service" : "Add service"}</DialogTitle><DialogDescription>Record the agreed commercial scope. This records an existing acceptance; it does not send a quote or collect a signature.</DialogDescription></DialogHeader>
      <div className="service-form">
        <label>Service name<Input required maxLength={160} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label>Commercial status<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}><option value="proposed">Proposed</option><option value="ordered">Ordered</option><option value="active">Active service</option><option value="ended">Ended</option></select></label>
        <label>Quote / agreement reference<Input value={draft.quoteRef} onChange={e => setDraft({ ...draft, quoteRef: e.target.value })} placeholder="Quote number or document URL" /></label>
        <label>Acceptance date<Input type="date" value={draft.acceptedAt} onChange={e => setDraft({ ...draft, acceptedAt: e.target.value })} /></label>
        <label>Setup fee<Input type="number" min="0" step="0.01" value={draft.setupFeeCents === null ? "" : draft.setupFeeCents / 100} onChange={e => setDraft({ ...draft, setupFeeCents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })} placeholder="Not recorded" /></label>
        <label>Monthly fee<Input type="number" min="0" step="0.01" value={draft.monthlyFeeCents === null ? "" : draft.monthlyFeeCents / 100} onChange={e => setDraft({ ...draft, monthlyFeeCents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })} placeholder="Not recorded" /></label>
        <label>Currency<select value={draft.currency} onChange={e => setDraft({ ...draft, currency: e.target.value })}>{["USD","CAD","EUR","GBP"].map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Service start<Input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })} /></label>
        <label>Service end (if applicable)<Input type="date" value={draft.endDate} onChange={e => setDraft({ ...draft, endDate: e.target.value })} /></label>
        <label className="wide">Purchased scope<Textarea value={draft.scope} onChange={e => setDraft({ ...draft, scope: e.target.value })} placeholder="What was purchased, deliverables, limits, and exclusions" /></label>
        <label className="wide">Included maintenance<Textarea value={draft.maintenance} onChange={e => setDraft({ ...draft, maintenance: e.target.value })} placeholder="Support hours, maintenance, included changes, and third-party costs" /></label>
        <label className="wide">Agreed configuration<Textarea value={draft.configuration} onChange={e => setDraft({ ...draft, configuration: e.target.value })} placeholder="Outcome, connected systems, schedule, approval rules, and workspace requirements" /></label>
        <fieldset className="wide"><legend>Automations delivering this service</legend>{installations.length ? installations.map(i => <label className="service-checkbox" key={i.id}><Checkbox checked={draft.installationIds.includes(i.id)} onCheckedChange={checked => setDraft({ ...draft, installationIds: checked ? [...new Set([...draft.installationIds, i.id])] : draft.installationIds.filter(id => id !== i.id) })} />{i.name}</label>) : <p>Create a company automation after saving this service, then return here to link it.</p>}</fieldset>
      </div>{editError && <p className="service-error" role="alert">{editError}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setDraft(null)}>Cancel</Button><Button disabled={busy} type="submit">{busy ? "Saving…" : "Save service"}</Button></DialogFooter>
    </form>}</DialogContent></Dialog>
  </section>;
}
