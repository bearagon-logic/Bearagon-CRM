"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
type Client = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  stage: string;
  nextStep: string;
  dueDate: string;
  notes: string;
  relationshipType: string;
};
type Task = { id: string; title: string; completed: boolean };
type Workspace = { id:string; lifecycle:string; consoleClientId:string|null; displayName:string };
type Workflow = { id:string; name:string; description:string; trigger:string; action:string; safetyLevel:string; approvalRequired:boolean; active:boolean; linked:boolean; desiredState:string; observedState:string; deliveryStage:string; runnerKey:string; externalWorkflowId:string; configVersion:string; lastObservedAt:string; lastRunStatus:string; lastRunAt:string; failureCount:number };
type Activity = { id:string; action:string; actorName:string; result:string; detail:string; createdAt:string };
type PlatformStatus = { state:string; message?:string; overview?:{automations:unknown[];runs:unknown[];connectors:unknown[];fetchedAt:string} };
type ClientDetailPayload = { error?:string; client?:Client; tasks?:Task[]; workflows?:Workflow[]; workspace?:Workspace|null; activity?:Activity[] };
type AutomationPayload = { error?:string; workflow?:Workflow };
type WorkspacePayload = { error?:string; workspace?:Workspace };
const stages = ["Intake", "Connections", "Building", "Testing", "Live"];
const workspaceTabs = ["Overview", "Onboarding", "Automations", "Activity"] as const;
type WorkspaceTab = (typeof workspaceTabs)[number];
function observationLabel(value: string) {
  if (!value) return "not reconciled";
  const observed = new Date(value);
  return Number.isNaN(observed.getTime())
    ? "timestamp unavailable"
    : `as of ${observed.toLocaleString()}`;
}
export default function ClientDetail() {
  const params = useParams<{ id: string }>(),
    id = params.id,
    searchParams = useSearchParams();
  const [client, setClient] = useState<Client | null>(null),
    [tasks, setTasks] = useState<Task[]>([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [tab, setTab] = useState<WorkspaceTab>("Overview"),
    [workflows, setWorkflows] = useState<Workflow[]>([]),
    [workspace, setWorkspace] = useState<Workspace | null>(null),
    [platformStatus, setPlatformStatus] = useState<PlatformStatus | null>(null),
    [activity, setActivity] = useState<Activity[]>([]);
  function applyDetail(data: ClientDetailPayload) {
    if (!data.client) throw new Error("Account record was not returned.");
    setClient(data.client);
    setTasks(data.tasks || []);
    setWorkflows(data.workflows || []);
    setWorkspace(data.workspace || null);
    setActivity(data.activity || []);
  }
  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then(async (r) => {
        const d = await r.json() as ClientDetailPayload;
        if (!r.ok) throw new Error(d.error);
        applyDetail(d);
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested && workspaceTabs.includes(requested as WorkspaceTab)) {
      setTab(requested as WorkspaceTab);
    }
  }, [searchParams]);
  useEffect(() => {
    fetch(`/api/platform/status?accountId=${encodeURIComponent(id)}`)
      .then((response) => response.json() as Promise<PlatformStatus>)
      .then((data) => setPlatformStatus(data))
      .catch(() => setPlatformStatus({ state: "unavailable", message: "Console status is unavailable." }));
  }, [id]);
  const complete = tasks.filter((t) => t.completed).length,
    percent = tasks.length ? Math.round((complete / tasks.length) * 100) : 0,
    pauseRequested = workflows.length > 0 && workflows.every((workflow) => workflow.desiredState !== "active");
  async function toggle(task: Task) {
    const completed = !task.completed;
    setTasks((v) => v.map((t) => (t.id === task.id ? { ...t, completed } : t)));
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: task.id, completed }),
      });
      const data = await response.json() as { error?: string; task?: Task };
      if (!response.ok) throw new Error(data.error || "Task status could not be saved");
      if (data.task) {
        setTasks((current) => current.map((item) =>
          item.id === task.id ? data.task as Task : item,
        ));
      }
      setMessage(completed ? "Checklist item completed" : "Checklist item reopened");
    } catch (error) {
      setTasks((current) => current.map((item) =>
        item.id === task.id ? task : item,
      ));
      setMessage(error instanceof Error ? error.message : "Task status could not be saved");
    }
  }
  async function save() {
    if (!client) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(client.stage === "Not started" ? {} : { stage: client.stage }),
          notes: client.notes,
          ...(client.stage === "Not started" ? {} : { nextStep: client.nextStep }),
        }),
      });
      const data = await response.json() as ClientDetailPayload;
      if (!response.ok) throw new Error(data.error || "Unable to save changes");
      if (data.client) setClient(data.client);
      setMessage("Changes saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save changes");
    } finally {
      setSaving(false);
    }
  }
  async function startOnboarding() {
    setSaving(true);
    setMessage("Starting onboarding…");
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startOnboarding: true }),
      });
      const data = await response.json() as ClientDetailPayload;
      if (!response.ok) throw new Error(data.error || "Onboarding could not be started");
      applyDetail(data);
      setMessage("Onboarding started · checklist created");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Onboarding could not be started");
    } finally {
      setSaving(false);
    }
  }
  async function toggleWorkflow(workflow: Workflow) {
    const desiredState = workflow.desiredState === "active" ? "paused" : "active";
    setWorkflows((current) => current.map((item) => item.id === workflow.id ? { ...item, desiredState } : item));
    try {
      const response = await fetch("/api/automations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: workflow.id, desiredState }) });
      const data = await response.json() as AutomationPayload;
      if (!response.ok) throw new Error(data.error || "Automation intent could not be saved");
      if (!data.workflow) throw new Error("The updated automation was not returned");
      const updated = data.workflow;
      setWorkflows((current) => current.map((item) => item.id === workflow.id ? updated : item));
      setMessage(`${workflow.name}: ${desiredState} requested · observed state remains separate`);
    } catch (error) {
      setWorkflows((current) => current.map((item) => item.id === workflow.id ? workflow : item));
      setMessage(error instanceof Error ? error.message : "Automation intent could not be saved");
    }
  }
  async function testClientWorkflow(workflow: Workflow) {
    setMessage(`${workflow.name}: requesting a real harness test…`);
    try {
      const response = await fetch("/api/automations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: workflow.id, simulate: true }) });
      const data = await response.json() as AutomationPayload;
      setMessage(data.error || "Harness test request was not accepted");
    } catch {
      setMessage("Harness test request could not reach the server");
    }
  }
  async function pauseClient() {
    if (pauseRequested) return;
    try {
      const response = await fetch(`/api/clients/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ pauseWorkflows: true }) });
      if (!response.ok) throw new Error("Account pause request could not be saved");
      setWorkflows((current) => current.map((workflow) => workflow.desiredState === "retired" ? workflow : { ...workflow, desiredState: "paused" }));
      setMessage("Pause requested for this account; observed runtime state is unchanged");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account pause request could not be saved");
    }
  }
  async function requestWorkspace() {
    setMessage("Requesting an operational workspace…");
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestWorkspace: true }),
      });
      const data = await response.json() as WorkspacePayload;
      if (!response.ok) throw new Error(data.error || "Workspace request could not be saved");
      if (!data.workspace) throw new Error("The requested workspace was not returned");
      setWorkspace(data.workspace);
      setMessage("Workspace requested · Console provisioning remains a separate step");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Workspace request could not be saved");
    }
  }
  const initials = useMemo(
    () =>
      client?.companyName
        .split(" ")
        .map((x) => x[0])
        .join("")
        .slice(0, 3),
    [client],
  );
  if (loading)
    return <AppShell><div className="detail-loading">Loading account workspace…</div></AppShell>;
  if (!client)
    return (
      <AppShell><div className="detail-loading">
        {message || "Client not found."}
        <Link href="/">Return to accounts</Link>
      </div></AppShell>
    );
  return (
    <AppShell><main className="detail-page">
      <div className="record-breadcrumb"><Link href="/">Accounts</Link><span>/</span><span>{client.companyName}</span></div>
      <section className="detail-hero">
        <div className="client-avatar">{initials}</div>
        <div>
          <small>ACCOUNT WORKSPACE · {client.relationshipType}</small>
          <h1>{client.companyName}</h1>
          <p>
            {client.contactName} · {client.email}
            {client.phone ? ` · ${client.phone}` : ""}
          </p>
        </div>
        <div className="hero-actions">
          <span className={"pill " + client.stage.toLowerCase()}>
            {client.stage}
          </span>
          <button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>
      <nav className="client-workspace-tabs" aria-label={`${client.companyName} workspace sections`}>
        {workspaceTabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => { setTab(item); setMessage(""); }}>{item}</button>)}
      </nav>
      {tab === "Overview" && <div className="detail-content">
        <section className="detail-main">
          {client.stage === "Not started" ? <article className="detail-card progress-card">
            <div className="card-title">
              <div>
                <small>ONBOARDING</small>
                <h2>Not started</h2>
              </div>
            </div>
            <p>This account is recorded without creating delivery work. Start onboarding when the relationship is ready to move into implementation.</p>
            <button className="safe-client-action" onClick={startOnboarding} disabled={saving}>{saving ? "Starting…" : "Start onboarding"}</button>
          </article> : <>
          <article className="detail-card progress-card">
            <div className="card-title">
              <div>
                <small>ONBOARDING PROGRESS</small>
                <h2>{percent}% complete</h2>
              </div>
              <strong>
                {complete}/{tasks.length}
              </strong>
            </div>
            <div className="big-progress">
              <i style={{ width: percent + "%" }} />
            </div>
            <p>
              {percent === 100
                ? "This client is ready to launch."
                : "Complete the checklist to move this client toward launch."}
            </p>
          </article>
          <article className="detail-card">
            <div className="card-title">
              <div>
                <small>LAUNCH CHECKLIST</small>
                <h2>Required onboarding steps</h2>
              </div>
            </div>
            <div className="checklist">
              {tasks.map((task) => (
                <label
                  className={
                    task.completed ? "check-item checked" : "check-item"
                  }
                  key={task.id}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggle(task)}
                  />
                  <i>✓</i>
                  <span>{task.title}</span>
                  <b>{task.completed ? "Complete" : "Pending"}</b>
                </label>
              ))}
            </div>
          </article>
          </>}
          <article className="detail-card">
            <div className="card-title">
              <div>
                <small>INTERNAL NOTES</small>
                <h2>Client context</h2>
              </div>
            </div>
            <textarea
              value={client.notes}
              onChange={(e) => setClient({ ...client, notes: e.target.value })}
              placeholder="Add decisions, preferences, blockers, or meeting notes…"
            />
            <div className="save-row">
              <span>{message}</span>
              <button onClick={save} disabled={saving}>
                Save notes
              </button>
            </div>
          </article>
        </section>
        <aside className="detail-side">
          <article className="detail-card">
            {client.stage === "Not started" ? <>
            <small>ONBOARDING</small>
            <p>Not started. Account notes can still be maintained without creating a delivery engagement.</p>
            <button className="safe-client-action" onClick={startOnboarding} disabled={saving}>{saving ? "Starting…" : "Start onboarding"}</button>
            </> : <>
            <small>CURRENT STAGE</small>
            <select
              value={client.stage}
              onChange={(e) => setClient({ ...client, stage: e.target.value })}
            >
              {stages.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <small>NEXT STEP</small>
            <input
              value={client.nextStep}
              onChange={(e) =>
                setClient({ ...client, nextStep: e.target.value })
              }
            />
            <small>TARGET DATE</small>
            <p>{client.dueDate || "Not set"}</p>
            </>}
          </article>
          <article className="detail-card connections-card">
            <div className="cipher-mini">
              <img src="/cipher-bearagon.png" alt="" aria-hidden="true" />
              <span>
                <small>PLATFORM BOUNDARY</small>
                <b>Operational workspace</b>
              </span>
            </div>
            <p>
              <i /> Ops record <b>Active</b>
            </p>
            <p>
              <i /> Workspace <b>{workspace ? workspace.lifecycle : "Not provisioned"}</b>
            </p>
            <p>
              <i /> Console telemetry <b>{platformStatus?.state?.replaceAll("_", " ") || "Checking"}{platformStatus?.overview?.fetchedAt ? ` · ${new Date(platformStatus.overview.fetchedAt).toLocaleString()}` : ""}</b>
            </p>
            {!workspace && <button className="safe-client-action" onClick={requestWorkspace}>Request workspace</button>}
          </article>
          <article className="detail-card">
            <small>ACTIVITY</small>
            {activity[0] ? <div className="activity">
              <i />
              <span>
                <b>{activity[0].action.replaceAll("_", " ").replaceAll(".", " · ")}</b>
                <small>{activity[0].actorName} · {activity[0].result}</small>
              </span>
            </div> : <p>No operator activity recorded yet.</p>}
          </article>
        </aside>
      </div>}
      {tab === "Onboarding" && <section className="client-section client-onboarding-section">
        <div className="client-section-heading"><div><small>DELIVERY PLAN</small><h2>{client.companyName} onboarding</h2><p>Use the checklist as the source of truth for readiness. Update stage and next action as work changes.</p></div><span>{tasks.length ? `${complete}/${tasks.length} complete` : "Not started"}</span></div>
        {client.stage === "Not started" ? <article className="client-control-card"><h3>Delivery has not started</h3><p>This relationship is recorded without an onboarding engagement. Start onboarding when implementation is ready.</p><button className="safe-client-action" onClick={startOnboarding} disabled={saving}>{saving ? "Starting…" : "Start onboarding"}</button></article> : <div className="detail-content client-onboarding-grid"><section className="detail-main"><article className="detail-card progress-card"><div className="card-title"><div><small>CHECKLIST PROGRESS</small><h2>{percent}% complete</h2></div><strong>{complete}/{tasks.length}</strong></div><div className="big-progress"><i style={{ width: percent + "%" }} /></div><p>{percent === 100 ? "This account is ready to launch." : "Finish the required setup before moving this account toward launch."}</p></article><article className="detail-card"><div className="card-title"><div><small>REQUIRED WORK</small><h2>Onboarding checklist</h2></div></div><div className="checklist">{tasks.map((task) => <label className={task.completed ? "check-item checked" : "check-item"} key={task.id}><input type="checkbox" checked={task.completed} onChange={() => toggle(task)} /><i>✓</i><span>{task.title}</span><b>{task.completed ? "Complete" : "Pending"}</b></label>)}</div></article></section><aside className="detail-side"><article className="detail-card"><small>CURRENT STAGE</small><select value={client.stage} onChange={(event) => setClient({ ...client, stage: event.target.value })}>{stages.map((item) => <option key={item}>{item}</option>)}</select><small>NEXT ACTION</small><input value={client.nextStep} onChange={(event) => setClient({ ...client, nextStep: event.target.value })} placeholder="What should happen next?"/><small>TARGET DATE</small><p>{client.dueDate || "Not set"}</p><button className="safe-client-action" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save delivery plan"}</button></article></aside></div>}
      </section>}
      {tab === "Automations" && <section className="client-section">
        <div className="client-section-heading"><div><small>ACCOUNT-SPECIFIC AUTOMATIONS</small><h2>{client.companyName} installations</h2><p>Ops records the blueprint, delivery stage, and desired state. Harness and Console telemetry own what is actually running.</p></div><div><span>{workflows.filter((workflow) => workflow.observedState === "active").length} observed active</span>{workflows.length > 0 && <button className={pauseRequested ? "safe-client-action" : "danger-client-action"} disabled={pauseRequested} onClick={pauseClient}>{pauseRequested ? "All pause requests recorded" : "Request account pause"}</button>}</div></div>
        {workflows.length ? <div className="client-control-grid">{workflows.map((workflow) => <article className="client-control-card" key={workflow.id}>
          <div className="control-card-top"><i>⚡</i><span><h3>{workflow.name}</h3><small>{workflow.deliveryStage.replaceAll("_", " ")} · {workflow.approvalRequired ? "Approval required" : workflow.safetyLevel}</small></span><button disabled className={workflow.observedState === "active" ? "control-toggle on" : "control-toggle"} aria-label={`Observed projection for ${workflow.name}`}>Projection: {workflow.observedState}</button></div>
          {workflow.description && <p className="client-workflow-description">{workflow.description}</p>}
          <div className="client-flow"><span><small>TRIGGER</small><b>{workflow.trigger}</b></span><em>→</em><span><small>ACTION</small><b>{workflow.action}</b></span></div>
          <div className="client-workflow-footer"><span><small>DESIRED / TELEMETRY</small><b>{workflow.desiredState} · {workflow.lastRunStatus} · {observationLabel(workflow.lastObservedAt)}</b></span><button className="safe-client-action" onClick={() => toggleWorkflow(workflow)} disabled={workflow.desiredState === "retired"}>{workflow.desiredState === "retired" ? "Retired" : workflow.desiredState === "active" ? "Request pause" : "Request activation"}</button><button className="safe-client-action" onClick={() => testClientWorkflow(workflow)} disabled={!workflow.linked}>Test through harness</button></div>
        </article>)}</div> : <div className="client-workflow-empty"><img src="/cipher-bearagon.png" alt="" aria-hidden="true"/><div><h3>No automation installations for this account yet.</h3><p>Create a paused, account-scoped blueprint, then link it to the delivery harness.</p><Link href={`/automations?view=create&accountId=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(`/clients/${id}?tab=automations`)}`}>Create automation</Link></div></div>}<p className="client-control-message">{message}</p>
      </section>}
      {tab === "Activity" && <section className="client-section">
        <div className="client-section-heading"><div><small>OPERATOR AUDIT TRAIL</small><h2>{client.companyName} activity</h2><p>Configuration intent and authenticated human decisions are recorded separately from runtime telemetry.</p></div><span>Account record</span></div>
        {activity.length ? <article className="client-control-card client-timeline">{activity.map((event) => <div key={event.id}><i/><span><b>{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</b><small>{event.actorName} · {event.result} · {new Date(event.createdAt).toLocaleString()}</small>{event.detail && <small>{event.detail}</small>}</span></div>)}</article> : <article className="client-control-card"><p>No operator activity has been recorded for this account.</p></article>}
      </section>}
    </main></AppShell>
  );
}
