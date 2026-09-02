"use client";
import { useEffect, useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
type Workflow = {
  id: number;
  name: string;
  description: string;
  trigger: string;
  action: string;
  safetyLevel: string;
  approvalRequired: boolean;
  active: boolean;
  lastRunStatus: string;
  lastRunAt: string;
  failureCount: number;
};
type ClientOption = { id: number; companyName: string };
const blankWorkflow = { clientId: "", name: "", description: "", trigger: "", action: "", safetyLevel: "Supervised", approvalRequired: true };
const previewWorkflows: Workflow[] = [
  {
    id: -1,
    name: "Website intake → Client record",
    description: "Validates a Bearagon.com submission and prepares a new onboarding record.",
    trigger: "Verified website intake",
    action: "Prepare client and checklist",
    safetyLevel: "Automatic",
    approvalRequired: false,
    active: false,
    lastRunStatus: "Ready for safe test",
    lastRunAt: "",
    failureCount: 0,
  },
  {
    id: -2,
    name: "Welcome email approval",
    description: "Prepares a personalized welcome email draft after a client record is created.",
    trigger: "New client created",
    action: "Draft welcome email",
    safetyLevel: "Supervised",
    approvalRequired: true,
    active: false,
    lastRunStatus: "Ready for safe test",
    lastRunAt: "",
    failureCount: 0,
  },
  {
    id: -3,
    name: "Overdue onboarding alert",
    description: "Flags stalled clients and prepares an internal Bearagon alert.",
    trigger: "Checklist item becomes overdue",
    action: "Prepare internal alert",
    safetyLevel: "Automatic",
    approvalRequired: false,
    active: false,
    lastRunStatus: "Ready for safe test",
    lastRunAt: "",
    failureCount: 0,
  },
  {
    id: -4,
    name: "Client launch approval",
    description: "Prevents a client from moving to Live until a team member approves launch.",
    trigger: "Checklist reaches 100%",
    action: "Queue stage change to Live",
    safetyLevel: "Restricted",
    approvalRequired: true,
    active: false,
    lastRunStatus: "Ready for safe test",
    lastRunAt: "",
    failureCount: 0,
  },
];
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
    title: "Test the path without touching a client.",
    body: "Open Review workflow and run a safe test. Cipher simulates the trigger and confirms that the approval gate stops external action.",
    example: "Safe tests never send messages, change outside systems, or move money.",
  },
  {
    eyebrow: "STEP 4 · ACTIVATE",
    title: "Turn it on only after the result looks right.",
    body: "Start with one low-risk workflow, watch its activity, and expand slowly. You can pause one workflow—or all workflows—at any time.",
    example: "Recommended first workflow: Welcome email approval in draft-only mode.",
  },
];
export default function Automations() {
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
        if (!r.ok) throw new Error("Workflow service unavailable");
        return r.json();
      })
      .then((d) => setItems(d.workflows?.length ? d.workflows : previewWorkflows))
      .catch(() => {
        setItems(previewWorkflows);
        setMessage("Preview mode · changes stay in this browser");
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    fetch("/api/clients").then((response) => response.json()).then((data) => setClients(data.clients || [])).catch(() => setClients([]));
  }, []);
  const active = items.filter((x) => x.active).length,
    approvals = items.filter((x) => x.approvalRequired).length,
    failures = items.reduce((sum, x) => sum + x.failureCount, 0),
    allPaused = items.length > 0 && active === 0;
  async function toggle(item: Workflow) {
    const active = !item.active;
    setItems((v) => v.map((x) => (x.id === item.id ? { ...x, active } : x)));
    setSelected((current) =>
      current?.id === item.id ? { ...current, active } : current,
    );
    if (item.id < 0) {
      setMessage(`${item.name}: ${active ? "activated" : "paused"} in preview mode`);
      return;
    }
    try {
      const r = await fetch("/api/automations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, active }),
      });
      if (!r.ok) throw new Error("Update failed");
      setMessage(`${item.name}: ${active ? "activated" : "paused"}`);
    } catch {
      setItems((v) => v.map((x) => (x.id === item.id ? item : x)));
      setSelected((current) => (current?.id === item.id ? item : current));
      setMessage("Change was not saved · please try again");
    }
  }
  async function pauseAll() {
    const pauseAll = !allPaused;
    const before = items;
    setItems((v) => v.map((x) => ({ ...x, active: !pauseAll })));
    if (items.every((item) => item.id < 0)) {
      setMessage(pauseAll ? "All preview workflows paused" : "Preview workflows activated");
      return;
    }
    try {
      const r = await fetch("/api/automations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pauseAll }),
      });
      if (!r.ok) throw new Error("Update failed");
      setMessage(pauseAll ? "All workflows paused" : "Workflows activated");
    } catch {
      setItems(before);
      setMessage("Change was not saved · please try again");
    }
  }
  async function testWorkflow() {
    if (!selected) return;
    setTesting(true);
    if (selected.id < 0) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      const tested = { ...selected, lastRunStatus: "Safe test passed", lastRunAt: new Date().toISOString() };
      setItems((v) => v.map((x) => (x.id === selected.id ? tested : x)));
      setSelected(tested);
      setMessage(selected.name + ": safe preview test passed");
      setTesting(false);
      return;
    }
    try {
      const r = await fetch("/api/automations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selected.id, simulate: true }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error("Test failed");
      setItems((v) => v.map((x) => (x.id === selected.id ? data.workflow : x)));
      setSelected(data.workflow);
      setMessage(selected.name + ": safe test passed");
    } catch {
      setMessage("Test could not be completed · no external action was taken");
    } finally {
      setTesting(false);
    }
  }
  async function createWorkflow(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setMessage("Saving paused workflow…");
    try {
      const response = await fetch("/api/automations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...workflowForm, clientId: Number(workflowForm.clientId) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create workflow");
      setItems((current) => [...current.filter((item) => item.id > 0), data.workflow]);
      setWorkflowForm(blankWorkflow);
      setView("library");
      setMessage(`${data.workflow.name}: created paused and ready for review`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create workflow");
    } finally {
      setCreating(false);
    }
  }
  return (
    <main className="automation-page">
      <header className="detail-top">
        <a href="/" className="detail-brand">
          <img src="/cipher-bearagon.png" alt="Cipher, the Bearagon bear" />
          <span>
            <b>BEARAGON</b>
            <small>AUTOMATION CONTROL</small>
          </span>
        </a>
        <a href="/" className="back-link">
          ← Back to dashboard
        </a>
      </header>
      <section className="automation-hero">
        <div>
          <small>CONTROL CENTER</small>
          <h1>Automations</h1>
          <p>
            Control what runs automatically, what requires approval, and what
            remains manual.
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
            className={allPaused ? "activate-all" : "pause-all"}
            onClick={pauseAll}
          >
            {allPaused ? "Activate workflows" : "Pause all workflows"}
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
            <small>ACTIVE</small>
            <strong>{active}</strong>
            <span>of {items.length} workflows</span>
          </article>
          <article>
            <small>APPROVAL REQUIRED</small>
            <strong>{approvals}</strong>
            <span>Supervised actions</span>
          </article>
          <article>
            <small>FAILURES</small>
            <strong>{failures}</strong>
            <span>Across recent runs</span>
          </article>
          <article>
            <small>SAFETY STATUS</small>
            <strong className="safe-status">Protected</strong>
            <span>Guardrails enabled</span>
          </article>
        </section>
        <section className="automation-note" id="safety">
          <img src="/cipher-bearagon.png" alt="" aria-hidden="true" />
          <div>
            <small>CIPHER SAFETY CHECK</small>
            <h2>External actions are not connected yet</h2>
            <p>
              These controls are ready, but no workflow will send messages,
              change outside systems, or move money until its connection and
              approval rules are reviewed.
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
          ) : (
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
                  <span className={item.active ? "state active" : "state"}>
                    {item.active ? "Active" : "Paused"}
                  </span>
                  <Switch
                    checked={item.active}
                    onCheckedChange={() => toggle(item)}
                    aria-label={`Toggle ${item.name}`}
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
                    <small>LAST RUN</small>
                    <b>{item.lastRunAt || "Not connected"}</b>
                  </span>
                  <span>
                    <small>STATUS</small>
                    <b className="never-run">{item.lastRunStatus}</b>
                  </span>
                  <button onClick={() => setSelected(item)}>
                    Review workflow →
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
        </> : <section className="workflow-builder">
          <div className="builder-intro"><img src="/cipher-bearagon.png" alt="Cipher, your workflow guide"/><div><small>CIPHER WORKFLOW BUILDER</small><h2>Create safely, activate later.</h2><p>Define one clear trigger and one approved action. New workflows always begin paused.</p></div></div>
          <form onSubmit={createWorkflow}>
            <label><span>Client workspace<small>Required for data separation</small></span><select required value={workflowForm.clientId} onChange={(event) => setWorkflowForm({ ...workflowForm, clientId: event.target.value })}><option value="">Select a client…</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.companyName}</option>)}</select></label>
            <label><span>Workflow name<small>Use a short, specific name</small></span><input required value={workflowForm.name} onChange={(event) => setWorkflowForm({ ...workflowForm, name: event.target.value })} placeholder="Example: Missed-call follow-up"/></label>
            <label className="builder-wide"><span>Description<small>What business problem does this solve?</small></span><textarea value={workflowForm.description} onChange={(event) => setWorkflowForm({ ...workflowForm, description: event.target.value })} placeholder="Cipher prepares a follow-up task when an important call is missed."/></label>
            <label><span>When this happens…<small>Trigger</small></span><input required value={workflowForm.trigger} onChange={(event) => setWorkflowForm({ ...workflowForm, trigger: event.target.value })} placeholder="RETell marks a call as missed"/></label>
            <label><span>Prepare this action…<small>Action</small></span><input required value={workflowForm.action} onChange={(event) => setWorkflowForm({ ...workflowForm, action: event.target.value })} placeholder="Create a callback task for review"/></label>
            <label><span>Safety level<small>Controls the review expectation</small></span><select value={workflowForm.safetyLevel} onChange={(event) => setWorkflowForm({ ...workflowForm, safetyLevel: event.target.value })}><option>Automatic</option><option>Supervised</option><option>Restricted</option></select></label>
            <label className="builder-approval"><input type="checkbox" checked={workflowForm.approvalRequired} onChange={(event) => setWorkflowForm({ ...workflowForm, approvalRequired: event.target.checked })}/><span><b>Require human approval</b><small>Recommended for every client-facing action</small></span></label>
            <div className="builder-guardrail builder-wide"><b>✓ Safe creation policy</b><span>This saves configuration only. The workflow begins paused and cannot contact an outside service.</span></div>
            <footer className="builder-wide"><span>{message}</span><button type="button" onClick={() => setView("library")}>Cancel</button><button className="create-workflow-action" disabled={creating || !clients.length}>{creating ? "Creating…" : "Create paused workflow"}</button></footer>
          </form>
          {!clients.length && <p className="builder-warning">Add a client before creating a client-scoped workflow.</p>}
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
                <div className="sheet-step"><i>1</i><span><small>TRIGGER</small><b>{selected.trigger}</b><p>The workflow waits for this verified event.</p></span></div>
                <div className="sheet-step"><i>2</i><span><small>CONDITION</small><b>Duplicate and permission checks pass</b><p>Unsafe or incomplete requests stop here.</p></span></div>
                <div className="sheet-step"><i>3</i><span><small>APPROVAL</small><b>{selected.approvalRequired ? "A Bearagon team member must approve" : "No approval required"}</b><p>{selected.approvalRequired ? "The action remains queued until approved." : "This low-risk internal action may continue automatically."}</p></span></div>
                <div className="sheet-step"><i>4</i><span><small>ACTION</small><b>{selected.action}</b><p>Every result is recorded in the activity log.</p></span></div>
                <div className="guardrail-box"><b>Guardrails</b><span>✓ Duplicate protection</span><span>✓ Audit logging</span><span>✓ Retry limit</span><span>✓ Emergency pause</span></div>
                {selected.lastRunAt && <div className="test-result"><b>✓ {selected.lastRunStatus}</b><span>{new Date(selected.lastRunAt).toLocaleString()}</span></div>}
              </div>
              <SheetFooter>
                <button className="test-button" onClick={testWorkflow} disabled={testing}>{testing ? "Running safe test…" : "Run safe test"}</button>
                <button className="toggle-button" onClick={() => toggle(selected)}>{selected.active ? "Pause workflow" : "Activate workflow"}</button>
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
    </main>
  );
}
