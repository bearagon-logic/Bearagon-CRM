"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AppShell } from "@/components/app-shell";
type Workflow = {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  safetyLevel: string;
  approvalRequired: boolean;
  active: boolean;
  linked: boolean;
  workspaceId: string | null;
  deliveryStage: string;
  desiredState: string;
  observedState: string;
  runnerKey: string;
  externalWorkflowId: string;
  configVersion: string;
  owner: string;
  acceptanceCriteria: string;
  lastObservedAt: string;
  lastRunStatus: string;
  lastRunAt: string;
  failureCount: number;
};
type ClientOption = { id: string; companyName: string };
type AutomationApiPayload = { error?: string; workflow?: Workflow; workflows?: Workflow[] };
type ClientApiPayload = { error?: string; clients?: ClientOption[] };
const blankWorkflow = {
  clientId: "",
  name: "",
  objective: "",
  trigger: "",
  action: "",
  safetyLevel: "Supervised",
  approvalRequired: true,
  owner: "",
  runnerKey: "unassigned",
  externalWorkflowId: "",
  configVersion: "",
  acceptanceCriteria: "",
};
function observationLabel(value: string) {
  if (!value) return "not reconciled";
  const observed = new Date(value);
  return Number.isNaN(observed.getTime())
    ? "timestamp unavailable"
    : `as of ${observed.toLocaleString()}`;
}
const tutorialSteps = [
  {
    eyebrow: "AUTOMATIONS 101",
    title: "An automation is a simple if-this-then-that rule.",
    body: "It watches for one approved event, checks your guardrails, and then prepares or performs one approved action.",
    example: "Example: When a verified intake form arrives → prepare a client record for review.",
  },
  {
    eyebrow: "STEP 1 · TRIGGER",
    title: "Choose what starts the workflow.",
    body: "A trigger should be specific and verifiable, such as a new client record, an overdue checklist item, or a missed call.",
    example: "Cipher ignores incomplete or unverified events before anything can continue.",
  },
  {
    eyebrow: "STEP 2 · GUARDRAILS",
    title: "Decide where Cipher must stop and ask.",
    body: "Approval gates, duplicate checks, permission limits, retry limits, and emergency pause rules keep every workflow inside its lane.",
    example: "Drafting an email can be automatic; sending it can still require human approval.",
  },
  {
    eyebrow: "STEP 3 · SAFE TEST",
    title: "Test in the harness and return evidence.",
    body: "Ops records the acceptance criteria and requests a test through an adapter. The harness performs the test and Console reports the observed result.",
    example: "Ops never invents a passing result by changing a status field locally.",
  },
  {
    eyebrow: "STEP 4 · ACTIVATE",
    title: "Request activation, then wait for acknowledgement.",
    body: "Desired state captures Bearagon’s instruction. The automation is only shown as active after the harness acknowledges it and runtime telemetry confirms it.",
    example: "Requested active and observed active are deliberately separate facts.",
  },
];
export default function Automations() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Workflow[]>([]),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState<Workflow | null>(null),
    [testing, setTesting] = useState(false),
    [tutorialStep, setTutorialStep] = useState<number | null>(null),
    [view, setView] = useState<"library" | "create">("library"),
    [clients, setClients] = useState<ClientOption[]>([]),
    [workflowForm, setWorkflowForm] = useState(blankWorkflow),
    [creating, setCreating] = useState(false);
  useEffect(() => {
    fetch("/api/automations")
      .then(async (r) => {
        const data = await r.json() as AutomationApiPayload;
        if (!r.ok) throw new Error(data.error || "Automation service unavailable");
        return data;
      })
      .then((d) => setItems(d.workflows || []))
      .catch((error) => {
        setItems([]);
        setMessage(error instanceof Error ? error.message : "Automation records are unavailable");
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    fetch("/api/clients").then((response) => response.json() as Promise<ClientApiPayload>).then((data) => setClients(data.clients || [])).catch(() => setClients([]));
  }, []);
  useEffect(() => {
    const accountId = searchParams.get("accountId");
    if (searchParams.get("view") === "create") setView("create");
    if (accountId) setWorkflowForm((current) => current.clientId === accountId ? current : { ...current, clientId: accountId });
  }, [searchParams]);
  const active = items.filter((x) => x.observedState === "active").length,
    requested = items.filter((x) => x.desiredState === "active").length,
    approvals = items.filter((x) => x.approvalRequired).length,
    failures = items.reduce((sum, x) => sum + x.failureCount, 0),
    allPaused = items.length > 0 && items.every((item) => item.desiredState !== "active");
  async function toggle(item: Workflow) {
    const desiredState = item.desiredState === "active" ? "paused" : "active";
    const optimistic = { ...item, desiredState };
    setItems((v) => v.map((x) => (x.id === item.id ? optimistic : x)));
    setSelected((current) =>
      current?.id === item.id ? optimistic : current,
    );
    try {
      const r = await fetch("/api/automations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, desiredState }),
      });
      const data = await r.json() as AutomationApiPayload;
      if (!r.ok) throw new Error(data.error || "Update failed");
      if (!data.workflow) throw new Error("The updated automation was not returned.");
      const updated = data.workflow;
      setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
      setSelected((current) => current?.id === item.id ? updated : current);
      setMessage(
        desiredState === "active"
          ? `${item.name}: activation requested · awaiting harness acknowledgement`
          : `${item.name}: pause requested · observed state remains ${item.observedState}`,
      );
    } catch (error) {
      setItems((v) => v.map((x) => (x.id === item.id ? item : x)));
      setSelected((current) => (current?.id === item.id ? item : current));
      setMessage(error instanceof Error ? error.message : "Change was not saved");
    }
  }
  async function pauseAll() {
    if (allPaused) return;
    const before = items;
    setItems((v) => v.map((x) => ({ ...x, desiredState: "paused" })));
    try {
      const r = await fetch("/api/automations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pauseAll: true }),
      });
      const data = await r.json() as AutomationApiPayload;
      if (!r.ok) throw new Error(data.error || "Update failed");
      setItems(data.workflows || []);
      setMessage("Pause requested for every installation · runtime acknowledgement is still separate");
    } catch (error) {
      setItems(before);
      setMessage(error instanceof Error ? error.message : "Change was not saved");
    }
  }
  async function testWorkflow() {
    if (!selected) return;
    setTesting(true);
    try {
      const r = await fetch("/api/automations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selected.id, simulate: true }),
      });
      const data = await r.json() as AutomationApiPayload;
      if (!r.ok) throw new Error(data.error || "Test failed");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Test could not be completed");
    } finally {
      setTesting(false);
    }
  }
  async function createWorkflow(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setMessage("Saving paused workflow…");
    try {
      const response = await fetch("/api/automations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(workflowForm) });
      const data = await response.json() as AutomationApiPayload;
      if (!response.ok) throw new Error(data.error || "Unable to create workflow");
      if (!data.workflow) throw new Error("The created automation was not returned.");
      const created = data.workflow;
      setItems((current) => [...current, created]);
      setWorkflowForm(blankWorkflow);
      setView("library");
      setMessage(`${created.name}: blueprint and paused installation created`);
      const returnTo = searchParams.get("returnTo");
      if (returnTo?.startsWith("/clients/")) window.location.assign(returnTo);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create workflow");
    } finally {
      setCreating(false);
    }
  }
  return (
    <AppShell><main className="automation-page">
      <section className="automation-hero">
        <div>
          <small>CONTROL CENTER</small>
          <h1>Automations</h1>
          <p>
            Design delivery here, build in the right harness, and verify the
            runtime through Console telemetry.
          </p>
        </div>
        <div className="automation-hero-actions">
          <label className="automation-client-jump">
            <span>CLIENT WORKSPACE</span>
            <select defaultValue="" onChange={(event) => { if (event.target.value) window.location.href = `/clients/${event.target.value}`; }}>
              <option value="" disabled>Jump to a client…</option>
              {clients.map((client) => <option value={client.id} key={client.id}>{client.companyName}</option>)}
            </select>
          </label>
          <button className="tutorial-button" onClick={() => setTutorialStep(0)}>▶ Start tutorial</button>
          <button
            className="pause-all"
            onClick={pauseAll}
            disabled={!items.length || allPaused}
          >
            {!items.length ? "No installations" : allPaused ? "All requests paused" : "Request pause for all"}
          </button>
        </div>
      </section>
      <div className="automation-content">
        <nav className="automation-view-tabs" aria-label="Automation Center sections">
          <button className={view === "library" ? "active" : ""} onClick={() => setView("library")}>Workflow Library</button>
          <button className={view === "create" ? "active" : ""} onClick={() => setView("create")}>＋ Create Workflow</button>
        </nav>
        {view === "library" ? <>
        <section className="automation-metrics">
          <article>
            <small>OBSERVED ACTIVE</small>
            <strong>{active}</strong>
            <span>Reported by a harness</span>
          </article>
          <article>
            <small>ACTIVE REQUESTED</small>
            <strong>{requested}</strong>
            <span>Desired runtime state</span>
          </article>
          <article>
            <small>APPROVAL REQUIRED</small>
            <strong>{approvals}</strong>
            <span>Supervised actions</span>
          </article>
          <article>
            <small>REPORTED FAILURES</small>
            <strong>{failures}</strong>
            <span>Never inferred from intent</span>
          </article>
        </section>
        <section className="automation-note" id="safety">
          <img src="/cipher-bearagon.png" alt="" aria-hidden="true" />
          <div>
            <small>CIPHER SAFETY CHECK</small>
            <h2>Ops is the control plane—not the execution harness</h2>
            <p>
              A requested state records operator intent. Only harness
              acknowledgement and Console telemetry can mark an automation as
              actually running.
            </p>
          </div>
        </section>
        <section className="workflow-diagram-card" aria-labelledby="example-workflow-title">
          <div className="diagram-heading"><div><small>EXAMPLE WORKFLOW DIAGRAM</small><h2 id="example-workflow-title">Urgent RETell call routing</h2><p>A safe, client-scoped path from incoming call to human follow-up.</p></div><span>Example only</span></div>
          <div className="workflow-diagram">
            <article className="diagram-node trigger-node"><i>1</i><span><small>TRIGGER</small><b>Incoming RETell call</b><p>A call reaches the client’s business line.</p></span></article>
            <i className="diagram-arrow">→</i>
            <article className="diagram-node cipher-node"><img src="/cipher-bearagon.png" alt="" aria-hidden="true"/><span><small>CIPHER</small><b>Verify and classify</b><p>Capture the message without making promises.</p></span></article>
            <i className="diagram-arrow">→</i>
            <article className="diagram-node decision-node"><i>?</i><span><small>CONDITION</small><b>Is it urgent?</b><p>Outage, safety issue, or same-day deadline.</p></span></article>
            <div className="diagram-branches">
              <div><em>YES · URGENT</em><article className="diagram-node approval-node"><i>✓</i><span><small>APPROVAL GATE</small><b>Send to Approval Inbox</b><p>An authorized person reviews the callback.</p></span></article><i className="branch-arrow">↓</i><article className="diagram-node result-node"><i>☎</i><span><small>HUMAN ACTION</small><b>Assign priority callback</b><p>Decision and owner are recorded.</p></span></article></div>
              <div><em>NO · ROUTINE</em><article className="diagram-node routine-node"><i>＋</i><span><small>INTERNAL ACTION</small><b>Create follow-up task</b><p>Add it to the correct client workspace.</p></span></article><i className="branch-arrow">↓</i><article className="diagram-node result-node"><i>◎</i><span><small>AUDIT</small><b>Record activity</b><p>The entire path remains traceable.</p></span></article></div>
            </div>
          </div>
          <footer><b>Guardrails throughout:</b><span>No automatic calling</span><span>No promises or pricing</span><span>Client ID required</span><span>Every decision logged</span></footer>
        </section>
        <section className="workflow-list" id="workflow-library">
          <div className="workflow-heading">
            <div>
              <small>WORKFLOW LIBRARY</small>
              <h2>Onboarding automations</h2>
            </div>
            <span>{message}</span>
          </div>
          {loading ? (
            <p className="workflow-loading">Loading workflows…</p>
          ) : items.length ? (
            items.map((item) => (
              <article className="workflow-card" key={item.id}>
                <div className="workflow-main">
                  <div className="workflow-icon">⚡</div>
                  <div>
                    <div className="workflow-name">
                      <h3>{item.name}</h3>
                      <span
                        className={
                          "risk-badge " + item.safetyLevel.toLowerCase()
                        }
                      >
                        {item.safetyLevel}
                      </span>
                    </div>
                    <p>{item.description}</p>
                    <div className="workflow-path">
                      <span>
                        <small>TRIGGER</small>
                        <b>{item.trigger}</b>
                      </span>
                      <i>→</i>
                      <span>
                        <small>ACTION</small>
                        <b>{item.action}</b>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="workflow-control">
                  <span className={item.observedState === "active" ? "state active" : "state"}>
                    Projection: {item.observedState.replaceAll("_", " ")} · {observationLabel(item.lastObservedAt)}
                  </span>
                  <Switch
                    checked={item.desiredState === "active"}
                    onCheckedChange={() => toggle(item)}
                    aria-label={`Request ${item.desiredState === "active" ? "pause" : "activation"} for ${item.name}`}
                  />
                </div>
                <div className="workflow-footer">
                  <span>
                    <small>APPROVAL</small>
                    <b>
                      {item.approvalRequired
                        ? "Required before action"
                        : "Not required"}
                    </b>
                  </span>
                  <span>
                    <small>DELIVERY / DESIRED</small>
                    <b>{item.deliveryStage.replaceAll("_", " ")} · {item.desiredState}</b>
                  </span>
                  <span>
                    <small>HARNESS / LAST RUN</small>
                    <b className="never-run">{item.linked ? item.runnerKey : "Not linked"} · {item.lastRunStatus}</b>
                  </span>
                  <button onClick={() => setSelected(item)}>
                    Review installation →
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="client-workflow-empty">
              <img src="/cipher-bearagon.png" alt="" aria-hidden="true" />
              <div>
                <h3>No automation blueprints yet.</h3>
                <p>Create the first design here, then link its installation to the delivery harness when it exists.</p>
                <button onClick={() => setView("create")}>＋ Create automation blueprint</button>
              </div>
            </div>
          )}
        </section>
        </> : <section className="workflow-builder">
          <div className="builder-intro"><img src="/cipher-bearagon.png" alt="Cipher, your workflow guide"/><div><small>AUTOMATION BLUEPRINT</small><h2>Specify here. Build in the harness.</h2><p>Capture the business intent, safety boundary, delivery owner, and external workflow link. New installations always begin paused.</p></div></div>
          <form onSubmit={createWorkflow}>
            <label><span>Account<small>The business relationship—not a runtime tenant</small></span><select required value={workflowForm.clientId} onChange={(event) => setWorkflowForm({ ...workflowForm, clientId: event.target.value })}><option value="">Select an account…</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.companyName}</option>)}</select></label>
            <label><span>Automation name<small>Use a short, specific name</small></span><input required value={workflowForm.name} onChange={(event) => setWorkflowForm({ ...workflowForm, name: event.target.value })} placeholder="Example: Missed-call follow-up"/></label>
            <label className="builder-wide"><span>Objective<small>What business outcome should this create?</small></span><textarea value={workflowForm.objective} onChange={(event) => setWorkflowForm({ ...workflowForm, objective: event.target.value })} placeholder="Ensure every urgent missed call reaches a human owner quickly."/></label>
            <label><span>When this happens…<small>Trigger</small></span><input required value={workflowForm.trigger} onChange={(event) => setWorkflowForm({ ...workflowForm, trigger: event.target.value })} placeholder="RETell marks a call as missed"/></label>
            <label><span>Prepare this action…<small>Action</small></span><input required value={workflowForm.action} onChange={(event) => setWorkflowForm({ ...workflowForm, action: event.target.value })} placeholder="Create a callback task for review"/></label>
            <label><span>Safety level<small>Controls the review expectation</small></span><select value={workflowForm.safetyLevel} onChange={(event) => setWorkflowForm({ ...workflowForm, safetyLevel: event.target.value })}><option>Automatic</option><option>Supervised</option><option>Restricted</option></select></label>
            <label><span>Delivery owner<small>Person responsible for build and verification</small></span><input value={workflowForm.owner} onChange={(event) => setWorkflowForm({ ...workflowForm, owner: event.target.value })} placeholder="Name or team"/></label>
            <label><span>Execution harness<small>Where the automation is built</small></span><select value={workflowForm.runnerKey} onChange={(event) => setWorkflowForm({ ...workflowForm, runnerKey: event.target.value })}><option value="unassigned">Not assigned yet</option><option value="n8n">n8n</option><option value="openai">OpenAI / agent harness</option><option value="custom">Custom service</option><option value="other">Other</option></select></label>
            <label><span>External workflow ID<small>Identifier from the harness; optional now</small></span><input value={workflowForm.externalWorkflowId} onChange={(event) => setWorkflowForm({ ...workflowForm, externalWorkflowId: event.target.value })} placeholder="Example: wf_01H…"/></label>
            <label><span>Configuration version<small>Version intended for deployment</small></span><input value={workflowForm.configVersion} onChange={(event) => setWorkflowForm({ ...workflowForm, configVersion: event.target.value })} placeholder="Example: 1.0.0"/></label>
            <label className="builder-wide"><span>Acceptance criteria<small>What a real harness test must prove</small></span><textarea value={workflowForm.acceptanceCriteria} onChange={(event) => setWorkflowForm({ ...workflowForm, acceptanceCriteria: event.target.value })} placeholder="A verified missed call creates exactly one task; urgent calls require human approval."/></label>
            <label className="builder-approval"><input type="checkbox" checked={workflowForm.approvalRequired} onChange={(event) => setWorkflowForm({ ...workflowForm, approvalRequired: event.target.checked })}/><span><b>Require human approval</b><small>Recommended for every client-facing action</small></span></label>
            <div className="builder-guardrail builder-wide"><b>✓ Separation of control and execution</b><span>This creates a blueprint and installation record only. It never deploys code, changes the observed state, or contacts an outside service.</span></div>
            <footer className="builder-wide"><span>{message}</span><button type="button" onClick={() => setView("library")}>Cancel</button><button className="create-workflow-action" disabled={creating || !clients.length}>{creating ? "Creating…" : "Create blueprint + paused installation"}</button></footer>
          </form>
          {!clients.length && <p className="builder-warning">Add an account before creating an account-scoped automation.</p>}
        </section>}
      </div>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent className="workflow-sheet">
          {selected && (
            <>
              <SheetHeader>
                <span className={"risk-badge " + selected.safetyLevel.toLowerCase()}>
                  {selected.safetyLevel}
                </span>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>{selected.description}</SheetDescription>
              </SheetHeader>
              <div className="sheet-body">
                <div className="guardrail-box">
                  <b>Control-plane state</b>
                  <span>Account: {selected.clientName}</span>
                  <span>Delivery: {selected.deliveryStage.replaceAll("_", " ")}</span>
                  <span>Desired: {selected.desiredState}</span>
                   <span>Observed: {selected.observedState}</span>
                   <span>Observation: {observationLabel(selected.lastObservedAt)}</span>
                </div>
                <div className="sheet-step"><i>1</i><span><small>TRIGGER</small><b>{selected.trigger}</b><p>The workflow waits for this verified event.</p></span></div>
                <div className="sheet-step"><i>2</i><span><small>CONDITION</small><b>Duplicate and permission checks pass</b><p>Unsafe or incomplete requests stop here.</p></span></div>
                <div className="sheet-step"><i>3</i><span><small>APPROVAL</small><b>{selected.approvalRequired ? "A Bearagon team member must approve" : "No approval required"}</b><p>{selected.approvalRequired ? "The action remains queued until approved." : "This low-risk internal action may continue automatically."}</p></span></div>
                <div className="sheet-step"><i>4</i><span><small>ACTION</small><b>{selected.action}</b><p>Every result is recorded in the activity log.</p></span></div>
                <div className="guardrail-box"><b>Harness link</b><span>Runner: {selected.runnerKey}</span><span>External ID: {selected.externalWorkflowId || "Not linked"}</span><span>Config: {selected.configVersion || "Not versioned"}</span><span>Owner: {selected.owner || "Unassigned"}</span></div>
                <div className="guardrail-box"><b>Acceptance criteria</b><span>{selected.acceptanceCriteria || "Define the evidence a real harness test must produce."}</span></div>
                {selected.lastRunAt && <div className="test-result"><b>✓ {selected.lastRunStatus}</b><span>{new Date(selected.lastRunAt).toLocaleString()}</span></div>}
              </div>
              <SheetFooter>
                <button className="test-button" onClick={testWorkflow} disabled={testing || !selected.linked}>{testing ? "Requesting harness test…" : selected.linked ? "Test through harness" : "Link harness before testing"}</button>
                <button className="toggle-button" onClick={() => toggle(selected)}>{selected.desiredState === "active" ? "Request pause" : "Request activation"}</button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
      {tutorialStep !== null && (
        <div className="tutorial-backdrop" role="presentation" onMouseDown={() => setTutorialStep(null)}>
          <section
            className="tutorial-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutorial-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="tutorial-close" aria-label="Close tutorial" onClick={() => setTutorialStep(null)}>×</button>
            <div className="tutorial-cipher">
              <img src="/cipher-bearagon.png" alt="Cipher, your Bearagon automation guide" />
              <span><small>CIPHER GUIDE</small><b>I’ll keep this simple.</b></span>
            </div>
            <div className="tutorial-progress" aria-label={`Tutorial step ${tutorialStep + 1} of ${tutorialSteps.length}`}>
              {tutorialSteps.map((_, index) => <i key={index} className={index <= tutorialStep ? "complete" : ""} />)}
            </div>
            <small className="tutorial-eyebrow">{tutorialSteps[tutorialStep].eyebrow}</small>
            <h2 id="tutorial-title">{tutorialSteps[tutorialStep].title}</h2>
            <p>{tutorialSteps[tutorialStep].body}</p>
            <div className="tutorial-example"><b>IN PRACTICE</b><span>{tutorialSteps[tutorialStep].example}</span></div>
            <footer>
              <button className="tutorial-back" disabled={tutorialStep === 0} onClick={() => setTutorialStep((step) => Math.max(0, (step || 0) - 1))}>← Back</button>
              {tutorialStep < tutorialSteps.length - 1 ? (
                <button className="tutorial-next" onClick={() => setTutorialStep(tutorialStep + 1)}>Next →</button>
              ) : (
                <button className="tutorial-next" onClick={() => { setTutorialStep(null); document.querySelector(".workflow-list")?.scrollIntoView({ behavior: "smooth" }); }}>Explore workflows →</button>
              )}
            </footer>
          </section>
        </div>
      )}
    </main></AppShell>
  );
}
