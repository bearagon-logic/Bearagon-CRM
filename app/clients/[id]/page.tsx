"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { workspaceDestination } from "@/lib/workspace-model";
import { AccountServices, ServiceSummary } from "@/components/account-services";
import { AccountRelationship } from "@/components/account-relationship";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  organizationKind?: string;
  onboardingStatus: string;
};
type Task = {
  id: string;
  templateKey?: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "blocked" | "completed" | "skipped";
  completed: boolean;
  evidenceRef: string;
  completionNote: string;
  blockedReason: string;
};
type Workspace = { id:string; lifecycle:string; consoleClientId:string|null; displayName:string };
type Workflow = { id:string; name:string; description:string; trigger:string; action:string; safetyLevel:string; approvalRequired:boolean; active:boolean; linked:boolean; desiredState:string; observedState:string; deliveryStage:string; runnerKey:string; externalWorkflowId:string; configVersion:string; lastObservedAt:string; lastRunStatus:string; lastRunAt:string; failureCount:number };
type Activity = { id:string; action:string; actorName:string; result:string; detail:string; createdAt:string };
type PlatformStatus = { state:string; message?:string; overview?:{automations:unknown[];runs:unknown[];connectors:unknown[];fetchedAt:string} };
type ClientDetailPayload = { error?:string; client?:Client; tasks?:Task[]; workflows?:Workflow[]; workspace?:Workspace|null; activity?:Activity[] };
type AutomationPayload = { error?:string; workflow?:Workflow };
type WorkspacePayload = { error?:string; workspace?:Workspace; activity?:Activity[] };
const stages = ["Intake", "Connections", "Building", "Testing", "Live"];
const workspaceTabs = ["Overview", "Automations", "Onboarding", "Activity"] as const;
type WorkspaceTab = (typeof workspaceTabs)[number];
const workspaceTabLabels: Record<WorkspaceTab, string> = {
  Overview: "Overview",
  Onboarding: "Delivery",
  Automations: "Services",
  Activity: "Activity",
};
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
    router = useRouter(),
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
    [activity, setActivity] = useState<Activity[]>([]),
    [selectedTask, setSelectedTask] = useState<Task | null>(null),
    [taskDraft, setTaskDraft] = useState({ status: "pending" as Task["status"], evidenceRef: "", completionNote: "", blockedReason: "" });
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
    const requested = searchParams.get("tab")?.trim().toLowerCase();
    const alias = requested === "services" ? "automations" : requested === "delivery" ? "onboarding" : requested;
    const selected = workspaceTabs.find((item) => item.toLowerCase() === alias);
    setTab(selected ?? "Overview");
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
  function selectTab(next: WorkspaceTab) {
    setTab(next);
    setMessage("");
    router.replace(next === "Overview" ? `/clients/${id}` : `/clients/${id}?tab=${next.toLowerCase()}`, { scroll: false });
  }
  function editTask(task: Task) {
    if (task.templateKey?.startsWith("scope:")) {
      router.push(`/clients/${id}/scope?step=setup`);
      return;
    }
    setSelectedTask(task);
    setTaskDraft({ status: task.status, evidenceRef: task.evidenceRef || "", completionNote: task.completionNote || "", blockedReason: task.blockedReason || "" });
  }
  async function saveTask() {
    if (!selectedTask) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: selectedTask.id, ...taskDraft }),
      });
      const data = await response.json() as { error?: string; task?: Task; client?: Client; activity?: Activity[] };
      if (!response.ok) throw new Error(data.error || "Task status could not be saved");
      if (data.task) {
        setTasks((current) => current.map((item) =>
          item.id === selectedTask.id ? data.task as Task : item,
        ));
      }
      if (data.client) setClient(data.client);
      if (data.activity) setActivity(data.activity);
      setSelectedTask(null);
      setMessage("Onboarding requirement updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Task status could not be saved");
    } finally {
      setSaving(false);
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
          ...(client.stage === "Not started" ? {} : { targetDate: client.dueDate }),
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
      selectTab("Onboarding");
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
      if (data.activity) setActivity(data.activity);
      setMessage("Workspace requested · Console provisioning remains a separate step");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Workspace request could not be saved");
    }
  }
  async function completeOnboarding() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completeOnboarding: true }),
      });
      const data = await response.json() as ClientDetailPayload;
      if (!response.ok) throw new Error(data.error || "Onboarding could not be completed");
      applyDetail(data);
      setMessage("Onboarding completed and removed from the active delivery queue");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Onboarding could not be completed");
    } finally {
      setSaving(false);
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
        <Link href="/companies">Return to companies</Link>
      </div></AppShell>
    );
  return (
    <AppShell activeSection={workspaceDestination(`/clients/${id}`, tab, client.stage === "Live" && client.onboardingStatus === "completed")}><main className="detail-page">
      <div className="record-breadcrumb"><Link href="/companies">Companies</Link><span>/</span><span>{client.companyName}</span></div>
      <section className="detail-hero">
        <div className="client-avatar">{initials}</div>
        <div>
          <small>{client.organizationKind === "internal" ? "INTERNAL OPERATIONS · BEARAGON" : `ACCOUNT WORKSPACE · ${client.relationshipType}`}</small>
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
        {workspaceTabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => selectTab(item)}>{workspaceTabLabels[item]}</button>)}
      </nav>
      {tab === "Overview" && <div className="detail-content">
        <section className="detail-main">
          <AccountRelationship accountId={id} onRelationshipChange={(relationshipType) => setClient((current) => current ? { ...current, relationshipType } : current)} />
          <ServiceSummary accountId={id} openServices={() => selectTab("Automations")} />
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
                <small>DELIVERY WORK</small>
                <h2>Manage onboarding in one place</h2>
              </div>
            </div>
            <p>Requirements, evidence, exceptions, and completion all live in the onboarding plan. This overview stays focused on the account’s current operating picture.</p>
            <button className="safe-client-action" onClick={() => selectTab("Onboarding")}>Open onboarding plan</button>
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
            <Input type="date" value={client.dueDate} onChange={(e) => setClient({ ...client, dueDate: e.target.value })} />
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
        <div className="security-reference"><Link href={`/clients/${id}/scope?step=setup`}>Open guided setup & service work orders →</Link><p>Package work orders are maintained in guided setup. The existing requirements below remain part of launch review.</p></div>
        <div className="client-section-heading"><div><small>DELIVERY PLAN</small><h2>{client.companyName} onboarding</h2><p>Use the checklist as the source of truth for readiness. Update stage and next action as work changes.</p></div><span>{tasks.length ? `${complete}/${tasks.length} complete` : "Not started"}</span></div>
        {client.stage === "Not started" ? <article className="client-control-card"><h3>Delivery has not started</h3><p>This relationship is recorded without an onboarding engagement. Start onboarding when implementation is ready.</p><button className="safe-client-action" onClick={startOnboarding} disabled={saving}>{saving ? "Starting…" : "Start onboarding"}</button></article> : <div className="detail-content client-onboarding-grid"><section className="detail-main"><article className="detail-card progress-card"><div className="card-title"><div><small>CHECKLIST PROGRESS</small><h2>{percent}% complete</h2></div><strong>{complete}/{tasks.length}</strong></div><div className="big-progress"><i style={{ width: percent + "%" }} /></div><p>{client.onboardingStatus === "completed" ? "This onboarding is complete and no longer appears in the active delivery queue." : percent === 100 ? "All requirements are in a terminal state. Move to Live, then complete onboarding." : "Open each requirement to document evidence, exceptions, or blockers."}</p></article><article className="detail-card"><div className="card-title"><div><small>REQUIRED WORK</small><h2>Onboarding requirements</h2></div></div><div className="task-plan-list">{tasks.map((task) => <button type="button" className={`task-plan-row ${task.status}`} key={task.id} onClick={() => editTask(task)} disabled={client.onboardingStatus === "completed"}><span><b>{task.title}</b><small>{task.description || "Document the requirement before marking it complete."}</small>{task.evidenceRef && <small>Evidence: {task.evidenceRef}</small>}{task.blockedReason && <small>Blocked: {task.blockedReason}</small>}</span><em>{task.status.replaceAll("_", " ")}</em></button>)}</div></article></section><aside className="detail-side"><article className="detail-card"><small>CURRENT STAGE</small><select value={client.stage} onChange={(event) => setClient({ ...client, stage: event.target.value })} disabled={client.onboardingStatus === "completed"}>{stages.map((item) => <option key={item}>{item}</option>)}</select><small>NEXT ACTION</small><input value={client.nextStep} onChange={(event) => setClient({ ...client, nextStep: event.target.value })} placeholder="What should happen next?" disabled={client.onboardingStatus === "completed"}/><small>TARGET DATE</small><Input type="date" value={client.dueDate} onChange={(event) => setClient({ ...client, dueDate: event.target.value })} disabled={client.onboardingStatus === "completed"}/><button className="safe-client-action" onClick={save} disabled={saving || client.onboardingStatus === "completed"}>{saving ? "Saving…" : "Save delivery plan"}</button>{client.onboardingStatus === "completed" ? <p>Onboarding completed.</p> : <button className="safe-client-action" onClick={completeOnboarding} disabled={saving || client.stage !== "Live" || tasks.some((task) => !["completed", "skipped"].includes(task.status))}>Complete onboarding</button>}<p className="client-control-message">{message}</p></article></aside></div>}
      </section>}
      {tab === "Automations" && <><div className="security-reference"><Link href={`/clients/${id}/scope`}>Establish service package, pricing & quote →</Link><p>Accepted packages create service records here. Existing services remain unchanged.</p></div><AccountServices accountId={id} companyName={client.companyName} /></>}
      {tab === "Activity" && <section className="client-section">
        <div className="client-section-heading"><div><small>OPERATOR AUDIT TRAIL</small><h2>{client.companyName} activity</h2><p>Configuration intent and authenticated human decisions are recorded separately from runtime telemetry.</p></div><span>Account record</span></div>
        {activity.length ? <article className="client-control-card client-timeline">{activity.map((event) => <div key={event.id}><i/><span><b>{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</b><small>{event.actorName} · {event.result} · {new Date(event.createdAt).toLocaleString()}</small>{event.detail && <small>{event.detail}</small>}</span></div>)}</article> : <article className="client-control-card"><p>No operator activity has been recorded for this account.</p></article>}
      </section>}
      <Dialog open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="crm-dialog task-dialog">
          {selectedTask && <form onSubmit={(event) => { event.preventDefault(); void saveTask(); }}>
            <DialogHeader>
              <DialogTitle>{selectedTask.title}</DialogTitle>
              <DialogDescription>{selectedTask.description || "Document the work before changing its status."}</DialogDescription>
            </DialogHeader>
            <div className="form-grid">
              <label>Status<select value={taskDraft.status} onChange={(event) => setTaskDraft({ ...taskDraft, status: event.target.value as Task["status"] })}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="skipped">Skipped / approved exception</option></select></label>
              <label>Evidence reference<Input value={taskDraft.evidenceRef} onChange={(event) => setTaskDraft({ ...taskDraft, evidenceRef: event.target.value })} placeholder="URL, document ID, or verified system reference" /></label>
              <label>Completion note / approved exception<Textarea value={taskDraft.completionNote} onChange={(event) => setTaskDraft({ ...taskDraft, completionNote: event.target.value })} placeholder="What was verified, or who approved the exception?" /></label>
              <label>Blocker reason<Textarea value={taskDraft.blockedReason} onChange={(event) => setTaskDraft({ ...taskDraft, blockedReason: event.target.value })} placeholder="What is blocked and what would unblock it?" /></label>
              {taskDraft.status === "completed" && <p className="form-hint">A completion note or evidence reference is required. Prerequisite requirements must be complete first.</p>}
              {taskDraft.status === "blocked" && <p className="form-hint">A blocker reason is required.</p>}
              {taskDraft.status === "skipped" && <p className="form-hint">Document the approved exception in the completion note.</p>}
            </div>
            <DialogFooter><button type="button" onClick={() => setSelectedTask(null)}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save requirement"}</button></DialogFooter>
          </form>}
        </DialogContent>
      </Dialog>
    </main></AppShell>
  );
}
