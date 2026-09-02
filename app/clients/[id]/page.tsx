"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
type Client = {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  stage: string;
  nextStep: string;
  dueDate: string;
  notes: string;
};
type Task = { id: number; title: string; completed: boolean };
type Workflow = { id:number; name:string; description:string; trigger:string; action:string; safetyLevel:string; approvalRequired:boolean; active:boolean; lastRunStatus:string; lastRunAt:string; failureCount:number };
const stages = ["Intake", "Connections", "Building", "Testing", "Live"];
const workspaceTabs = ["Overview", "Workflows", "Connections", "Communications", "Cipher", "Security", "Activity"] as const;
type WorkspaceTab = (typeof workspaceTabs)[number];
const clientConnections = [
  ["REtell", "Business calls and filtered messages", "Ready to configure"],
  ["Google Workspace", "Gmail drafts and calendar", "Draft only"],
  ["Microsoft 365", "Outlook drafts and calendar", "Draft only"],
  ["Website intake", "Verified onboarding submissions", "Ready to configure"],
];
export default function ClientDetail() {
  const params = useParams<{ id: string }>(),
    id = params.id;
  const [client, setClient] = useState<Client | null>(null),
    [tasks, setTasks] = useState<Task[]>([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [tab, setTab] = useState<WorkspaceTab>("Overview"),
    [workflows, setWorkflows] = useState<Workflow[]>([]),
    [connectionStates, setConnectionStates] = useState<boolean[]>([false, false, false, false]),
    [cipherEnabled, setCipherEnabled] = useState(true),
    [emergencyPaused, setEmergencyPaused] = useState(false);
  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setClient(d.client);
        setTasks(d.tasks);
        setWorkflows(d.workflows || []);
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => {
    const stored = localStorage.getItem(`bearagon-client-controls-${id}`);
    if (!stored) return;
    try {
      const data = JSON.parse(stored);
      if (Array.isArray(data.connectionStates)) setConnectionStates(data.connectionStates);
      if (typeof data.cipherEnabled === "boolean") setCipherEnabled(data.cipherEnabled);
      if (typeof data.emergencyPaused === "boolean") setEmergencyPaused(data.emergencyPaused);
    } catch {}
  }, [id]);
  function saveClientControls(next: Record<string, unknown>) {
    const state = { connectionStates, cipherEnabled, emergencyPaused, ...next };
    localStorage.setItem(`bearagon-client-controls-${id}`, JSON.stringify(state));
    setMessage("Client-specific demo settings saved in this browser");
  }
  const complete = tasks.filter((t) => t.completed).length,
    percent = tasks.length ? Math.round((complete / tasks.length) * 100) : 0;
  async function toggle(task: Task) {
    const completed = !task.completed;
    setTasks((v) => v.map((t) => (t.id === task.id ? { ...t, completed } : t)));
    const r = await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: task.id, completed }),
    });
    if (!r.ok) setTasks((v) => v.map((t) => (t.id === task.id ? task : t)));
  }
  async function save() {
    if (!client) return;
    setSaving(true);
    setMessage("");
    const r = await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stage: client.stage,
        notes: client.notes,
        nextStep: client.nextStep,
      }),
    });
    setMessage(r.ok ? "Changes saved" : "Unable to save changes");
    setSaving(false);
  }
  async function toggleWorkflow(workflow: Workflow) {
    const active = !workflow.active;
    setWorkflows((current) => current.map((item) => item.id === workflow.id ? { ...item, active } : item));
    const response = await fetch("/api/automations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: workflow.id, active }) });
    if (!response.ok) {
      setWorkflows((current) => current.map((item) => item.id === workflow.id ? workflow : item));
      setMessage("Workflow change could not be saved");
    } else setMessage(`${workflow.name}: ${active ? "activated" : "paused"}`);
  }
  async function testClientWorkflow(workflow: Workflow) {
    setMessage(`${workflow.name}: running safe test…`);
    const response = await fetch("/api/automations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: workflow.id, simulate: true }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "Safe test could not be completed"); return; }
    setWorkflows((current) => current.map((item) => item.id === workflow.id ? data.workflow : item));
    setMessage(`${workflow.name}: safe test passed · no external action taken`);
  }
  async function pauseClient() {
    const next = !emergencyPaused;
    if (next) {
      const response = await fetch(`/api/clients/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ pauseWorkflows: true }) });
      if (!response.ok) { setMessage("Client workflows could not be paused"); return; }
      setWorkflows((current) => current.map((workflow) => ({ ...workflow, active: false })));
    }
    setEmergencyPaused(next);
    saveClientControls({ emergencyPaused: next });
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
    return <div className="detail-loading">Loading client workspace…</div>;
  if (!client)
    return (
      <div className="detail-loading">
        {message || "Client not found."}
        <a href="/">Return to dashboard</a>
      </div>
    );
  return (
    <main className="detail-page">
      <header className="detail-top">
        <a href="/" className="detail-brand">
          <img src="/cipher-bearagon.png" alt="Cipher, the Bearagon bear" />
          <span>
            <b>BEARAGON</b>
            <small>CLIENT OPERATIONS</small>
          </span>
        </a>
        <a href="/" className="back-link">
          ← Back to dashboard
        </a>
      </header>
      <section className="detail-hero">
        <div className="client-avatar">{initials}</div>
        <div>
          <small>CLIENT WORKSPACE</small>
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
          </article>
          <article className="detail-card connections-card">
            <div className="cipher-mini">
              <img src="/cipher-bearagon.png" alt="" aria-hidden="true" />
              <span>
                <small>CIPHER CHECK</small>
                <b>Connections</b>
              </span>
            </div>
            <p>
              <i /> Email & calendar <b>Pending</b>
            </p>
            <p>
              <i /> Accounting system <b>Pending</b>
            </p>
            <p>
              <i /> Payment system <b>Pending</b>
            </p>
          </article>
          <article className="detail-card">
            <small>ACTIVITY</small>
            <div className="activity">
              <i />
              <span>
                <b>Client workspace created</b>
                <small>Onboarding record is active</small>
              </span>
            </div>
          </article>
        </aside>
      </div>}
      {tab === "Workflows" && <section className="client-section">
        <div className="client-section-heading"><div><small>CLIENT-SPECIFIC AUTOMATIONS</small><h2>{client.companyName} workflows</h2><p>These database-backed controls affect only this client. Every external action remains approval-gated.</p></div><span>{workflows.filter((workflow) => workflow.active).length} active</span></div>
        {workflows.length ? <div className="client-control-grid">{workflows.map((workflow) => <article className="client-control-card" key={workflow.id}>
          <div className="control-card-top"><i>⚡</i><span><h3>{workflow.name}</h3><small>{workflow.approvalRequired ? "Approval required" : workflow.safetyLevel}</small></span><button className={workflow.active ? "control-toggle on" : "control-toggle"} aria-label={`${workflow.active ? "Pause" : "Activate"} ${workflow.name}`} onClick={() => toggleWorkflow(workflow)}>{workflow.active ? "Active" : "Paused"}</button></div>
          {workflow.description && <p className="client-workflow-description">{workflow.description}</p>}
          <div className="client-flow"><span><small>TRIGGER</small><b>{workflow.trigger}</b></span><em>→</em><span><small>ACTION</small><b>{workflow.action}</b></span></div>
          <div className="client-workflow-footer"><span><small>LAST STATUS</small><b>{workflow.lastRunStatus}</b></span><button className="safe-client-action" onClick={() => testClientWorkflow(workflow)}>Run safe test</button></div>
        </article>)}</div> : <div className="client-workflow-empty"><img src="/cipher-bearagon.png" alt="" aria-hidden="true"/><div><h3>No workflows created for this client yet.</h3><p>Use the Workflow Builder to create a paused, client-scoped automation.</p><a href="/automations">＋ Create workflow</a></div></div>}<p className="client-control-message">{message}</p>
      </section>}
      {tab === "Connections" && <section className="client-section">
        <div className="client-section-heading"><div><small>ISOLATED CONNECTION VAULT</small><h2>{client.companyName} connections</h2><p>Credentials and permissions for this client are never shared with another client workspace.</p></div><span>{connectionStates.filter(Boolean).length} configured</span></div>
        <div className="client-control-grid two-column">{clientConnections.map((connection, index) => <article className="client-control-card" key={connection[0]}>
          <div className="connection-client-row"><i>{connection[0][0]}</i><span><h3>{connection[0]}</h3><p>{connection[1]}</p><small>{connection[2]}</small></span></div>
          <button className="safe-client-action" onClick={() => { const next = connectionStates.map((value, i) => i === index ? !value : value); setConnectionStates(next); saveClientControls({ connectionStates: next }); }}>{connectionStates[index] ? "Review demo setup" : "Build guarded connection"}</button>
        </article>)}</div><p className="client-control-message">{message}</p>
      </section>}
      {tab === "Communications" && <section className="client-section">
        <div className="client-section-heading"><div><small>CALLS & MESSAGES</small><h2>{client.companyName} communication rules</h2><p>REtell calls, summaries, and message filtering remain inside this client record.</p></div><span>Human review on</span></div>
        <div className="client-control-grid two-column"><article className="client-control-card"><h3>REtell call handling</h3><div className="client-rule"><b>Answering mode</b><span>Cipher greeting + human escalation</span></div><div className="client-rule"><b>After hours</b><span>Take message and flag urgent calls</span></div><div className="client-rule"><b>Commitments</b><span>Never quote, promise, or schedule without approval</span></div><button className="safe-client-action" onClick={() => setMessage("Call-handling preview opened safely")}>Preview call flow</button></article><article className="client-control-card"><h3>Message filtering</h3><div className="client-rule"><b>Urgent</b><span>Notify a human immediately</span></div><div className="client-rule"><b>Needs reply</b><span>Prepare a response draft</span></div><div className="client-rule"><b>Spam or solicitation</b><span>Filter without responding</span></div><button className="safe-client-action" onClick={() => setMessage("Message-filtering rules are ready for review")}>Review filtering rules</button></article></div><p className="client-control-message">{message}</p>
      </section>}
      {tab === "Cipher" && <section className="client-section">
        <div className="client-section-heading"><div><small>CLIENT AI PROFILE</small><h2>Cipher for {client.companyName}</h2><p>This voice, knowledge, and behavior profile belongs only to this client.</p></div><span>{cipherEnabled ? "Enabled in demo" : "Disabled"}</span></div>
        <article className="client-control-card cipher-client-card"><img src="/cipher-bearagon.png" alt="Cipher, the Bearagon bear"/><div><h3>Helpful within limits. Human when it matters.</h3><label>Approved greeting<textarea defaultValue={`Thank you for calling ${client.companyName}. This is Cipher, your virtual assistant. How may I help you today?`} /></label><div className="cipher-client-actions"><button className="safe-client-action" onClick={() => setMessage("Greeting preview ready · no call was placed")}>Preview greeting</button><button className={cipherEnabled ? "danger-client-action" : "safe-client-action"} onClick={() => { const next = !cipherEnabled; setCipherEnabled(next); saveClientControls({ cipherEnabled: next }); }}>{cipherEnabled ? "Disable Cipher demo" : "Enable Cipher demo"}</button></div></div></article><p className="client-control-message">{message}</p>
      </section>}
      {tab === "Security" && <section className="client-section">
        <div className="client-section-heading"><div><small>CLIENT SECURITY BOUNDARY</small><h2>{client.companyName} safeguards</h2><p>Client ID {client.id} scopes every record, task, and future connection request.</p></div><span className={emergencyPaused ? "paused-label" : "protected-label"}>{emergencyPaused ? "Paused" : "Protected"}</span></div>
        <div className="client-control-grid two-column"><article className="client-control-card"><h3>Isolation rules</h3><div className="security-checks"><span>✓ Client-scoped workspace</span><span>✓ Separate connection configuration</span><span>✓ Approval before external action</span><span>✓ Activity recorded by client</span></div></article><article className="client-control-card"><h3>Emergency control</h3><p>Pause every database-backed workflow for this client without changing another client’s setup.</p><button className={emergencyPaused ? "safe-client-action" : "danger-client-action"} onClick={pauseClient}>{emergencyPaused ? "Clear client pause" : "Pause this client"}</button></article></div><p className="client-control-message">{message}</p>
      </section>}
      {tab === "Activity" && <section className="client-section">
        <div className="client-section-heading"><div><small>CLIENT AUDIT TRAIL</small><h2>{client.companyName} activity</h2><p>A readable history of configuration, approvals, tests, and future external actions.</p></div><span>Client ID {client.id}</span></div>
        <article className="client-control-card client-timeline"><div><i/><span><b>Client workspace created</b><small>Onboarding record is active</small></span></div><div><i/><span><b>Security boundary assigned</b><small>Controls scoped to {client.companyName}</small></span></div><div><i/><span><b>Connection review pending</b><small>No external credentials have been requested</small></span></div></article>
      </section>}
    </main>
  );
}
