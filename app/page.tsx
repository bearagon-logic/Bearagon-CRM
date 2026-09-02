"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
type Client = {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  stage: string;
  nextStep: string;
  dueDate: string;
  createdAt: string;
};
const stages = [
  "All clients",
  "Intake",
  "Connections",
  "Building",
  "Testing",
  "Live",
];
const progress: Record<string, number> = {
  Intake: 18,
  Connections: 42,
  Building: 68,
  Testing: 86,
  Live: 100,
};
const tasks = [
  ["Connect website intake form", "Bearagon CRM", "Next build"],
  ["Define onboarding checklist", "Internal setup", "Ready to plan"],
  ["Choose first test client", "Launch preparation", "After intake form"],
];
const blank = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  stage: "Intake",
  dueDate: "",
};
export default function Home() {
  const [clients, setClients] = useState<Client[]>([]),
    [stage, setStage] = useState("All clients"),
    [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [form, setForm] = useState(blank),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState<number[]>([]);
  useEffect(() => {
    fetch("/api/clients")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setClients(d.clients);
      })
      .catch(() => setError("Client records are temporarily unavailable."))
      .finally(() => setLoading(false));
  }, []);
  async function addClient(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/clients", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setClients((c) => [d.client, ...c]);
      setForm(blank);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add client.");
    } finally {
      setSaving(false);
    }
  }
  const visible = useMemo(
      () =>
        clients.filter(
          (c) =>
            (stage === "All clients" || c.stage === stage) &&
            c.companyName.toLowerCase().includes(query.toLowerCase()),
        ),
      [clients, stage, query],
    ),
    active = clients.filter((c) => c.stage !== "Live").length;
  return (
    <main className="shell">
      <aside>
        <div className="brand">
          <img src="/cipher-bearagon.png" alt="Cipher, the Bearagon bear" />
          <span>BEARAGON</span>
        </div>
        <nav>
          <a className="active" href="#overview">
            ◫ <span>Overview</span>
          </a>
          <details className="side-dropdown">
            <summary>
              <i>◎</i><span>Clients</span><b>{clients.length}</b><em>⌄</em>
            </summary>
            <div className="side-dropdown-menu">
              {clients.length ? clients.map((client) => (
                <a href={`/clients/${client.id}`} key={client.id}>
                  <i>{client.companyName.split(" ").map((word) => word[0]).join("").slice(0, 2)}</i>
                  <span>{client.companyName}<small>{client.stage}</small></span>
                </a>
              )) : <button onClick={() => setOpen(true)}>＋ Add first client</button>}
              {clients.length > 0 && <a className="dropdown-view-all" href="#clients">View client pipeline →</a>}
            </div>
          </details>
          <details className="side-dropdown">
            <summary>
              <i>✓</i><span>Tasks</span><b>{tasks.length - done.length}</b><em>⌄</em>
            </summary>
            <div className="side-dropdown-menu task-dropdown">
              {tasks.map((task, index) => (
                <button className={done.includes(index) ? "complete" : ""} key={task[0]} onClick={() => setDone((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])}>
                  <i>✓</i><span>{task[0]}<small>{task[2]}</small></span>
                </button>
              ))}
              <a className="dropdown-view-all" href="#tasks">Open task list →</a>
            </div>
          </details>
          <details className="side-dropdown"><summary><i>◉</i><span>Approvals</span><em>⌄</em></summary><div className="side-dropdown-menu"><a href="/approvals"><i>◉</i><span>Review queue<small>Approve or reject requests</small></span></a><a href="/approvals"><i>✓</i><span>Decision history<small>Client-scoped audit trail</small></span></a></div></details>
          <details className="side-dropdown"><summary><i>⚡</i><span>Automations</span><em>⌄</em></summary><div className="side-dropdown-menu"><a href="/automations"><i>⚡</i><span>Control Center<small>Manage all workflows</small></span></a><a href="/automations#workflow-library"><i>◎</i><span>Workflow library<small>Review and safe test</small></span></a><a href="/automations#safety"><i>✓</i><span>Safety rules<small>Approvals and limits</small></span></a></div></details>
          <details className="side-dropdown"><summary><i>↗</i><span>Connections</span><em>⌄</em></summary><div className="side-dropdown-menu"><a href="/connections"><i>↗</i><span>All connections<small>Guarded setup center</small></span></a><a href="/connections#service-connections"><i>G</i><span>Email & calendar<small>Google and Microsoft</small></span></a><a href="/connections#connection-safety"><i>✓</i><span>Permission review<small>Minimum access only</small></span></a></div></details>
          <details className="side-dropdown"><summary><i>☎</i><span>Calls & Messages</span><em>⌄</em></summary><div className="side-dropdown-menu"><a href="/communications#inbox"><i>✉</i><span>Unified inbox<small>Calls and messages</small></span></a><a href="/communications#routing"><i>↗</i><span>Answering rules<small>Filtering and routing</small></span></a><a href="/communications#phone-flow"><i>☎</i><span>REtell call flow<small>Greet, verify, route</small></span></a></div></details>
          <details className="side-dropdown"><summary><i>◈</i><span>Cipher</span><em>⌄</em></summary><div className="side-dropdown-menu"><a href="/cipher"><i>◈</i><span>Cipher profile<small>Identity and voice</small></span></a><a href="/cipher#cipher-settings"><i>☎</i><span>Phone & email<small>Scripts and drafts</small></span></a><a href="/cipher#cipher-settings"><i>✓</i><span>Guardrails<small>Limits and escalation</small></span></a></div></details>
          <details className="side-dropdown"><summary><i>◆</i><span>Security</span><em>⌄</em></summary><div className="side-dropdown-menu"><a href="/security"><i>◆</i><span>Security Center<small>Posture and pause</small></span></a><a href="/security#permissions"><i>✓</i><span>Permissions<small>Application access</small></span></a><a href="/security#audit-history"><i>◎</i><span>Audit history<small>Tests and approvals</small></span></a></div></details>
        </nav>
        <div className="cipher-card">
          <img src="/cipher-bearagon.png" alt="" aria-hidden="true" />
          <span>
            <small>CIPHER</small>
            <b>Secure. Automate. Elevate.</b>
          </span>
        </div>
        <div className="sidefoot">
          <small>ONBOARDING HEALTH</small>
          <p>
            <i /> Active clients <b>{active}</b>
          </p>
          <p>
            <i className="risk" /> Needs attention <b>0</b>
          </p>
          <div className="user">
            <i>DM</i>
            <span>
              <b>Derek Manchego</b>
              <small>Administrator</small>
            </span>
          </div>
        </div>
      </aside>
      <section className="workspace" id="overview">
        <header>
          <div>
            <small>BEARAGON CLIENT OPERATIONS</small>
            <h1>Your onboarding command center.</h1>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button>＋ Add client</button>
            </DialogTrigger>
            <DialogContent className="crm-dialog">
              <form onSubmit={addClient}>
                <DialogHeader>
                  <DialogTitle>Add a new client</DialogTitle>
                  <DialogDescription>
                    Create their record and start the Bearagon onboarding
                    process.
                  </DialogDescription>
                </DialogHeader>
                <div className="form-grid">
                  <label>
                    Company name
                    <Input
                      required
                      value={form.companyName}
                      onChange={(e) =>
                        setForm({ ...form, companyName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Primary contact
                    <Input
                      required
                      value={form.contactName}
                      onChange={(e) =>
                        setForm({ ...form, contactName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Email
                    <Input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Phone
                    <Input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Starting stage
                    <select
                      value={form.stage}
                      onChange={(e) =>
                        setForm({ ...form, stage: e.target.value })
                      }
                    >
                      {stages.slice(1).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Target date
                    <Input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) =>
                        setForm({ ...form, dueDate: e.target.value })
                      }
                    />
                  </label>
                </div>
                {error && <p className="form-error">{error}</p>}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Create client"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>
        <div className="content">
          <section className="alert ready">
            <i>✓</i>
            <div>
              <small>THE FOUNDATION IS READY</small>
              <h2>Client records now save permanently</h2>
              <p>
                Add your first real client. Their record will remain available
                whenever you return to the CRM.
              </p>
            </div>
            <button onClick={() => setOpen(true)}>Add first client →</button>
          </section>
          <section className="metrics">
            <article>
              <small>ACTIVE ONBOARDINGS</small>
              <strong>{active}</strong>
              <span>Across your pipeline</span>
            </article>
            <article>
              <small>TOTAL CLIENTS</small>
              <strong>{clients.length}</strong>
              <span>Saved client records</span>
            </article>
            <article>
              <small>TASKS TO SET UP</small>
              <strong>3</strong>
              <span>For the next build</span>
            </article>
            <article>
              <small>SYSTEM STATUS</small>
              <strong className="status">Live</strong>
              <span className="good">Database connected</span>
            </article>
          </section>
          <section className="panel" id="clients">
            <div className="panelhead">
              <div>
                <small>CLIENT PIPELINE</small>
                <h2>Onboarding progress</h2>
              </div>
              <label>
                ⌕{" "}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search clients"
                />
              </label>
            </div>
            <div className="tabs">
              {stages.map((s) => (
                <button
                  key={s}
                  className={stage === s ? "selected" : ""}
                  onClick={() => setStage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="rows">
              <div className="row labels">
                <span>CLIENT</span>
                <span>STAGE</span>
                <span>PROGRESS</span>
                <span>NEXT STEP</span>
                <span>TARGET</span>
              </div>
              {loading ? (
                <p className="empty">Loading client records…</p>
              ) : (
                visible.map((c) => (
                  <a className="row client" href={`/clients/${c.id}`} key={c.id}>
                    <span className="name">
                      <i>
                        {c.companyName
                          .split(" ")
                          .map((x) => x[0])
                          .join("")
                          .slice(0, 3)}
                      </i>
                      <span>
                        <b>{c.companyName}</b>
                        <small>{c.contactName}</small>
                      </span>
                    </span>
                    <span>
                      <em className={"pill " + c.stage.toLowerCase()}>
                        {c.stage}
                      </em>
                    </span>
                    <span className="progress">
                      <i>
                        <b style={{ width: (progress[c.stage] || 10) + "%" }} />
                      </i>
                      <small>{progress[c.stage] || 10}%</small>
                    </span>
                    <span>{c.nextStep}</span>
                    <span>
                      {c.dueDate || "Not set"} <b>›</b>
                    </span>
                  </a>
                ))
              )}
              {!loading && !visible.length && (
                <div className="empty">
                  <b>
                    {clients.length
                      ? "No clients match this view."
                      : "No clients yet."}
                  </b>
                  <span>
                    {clients.length
                      ? "Try another stage or search."
                      : "Add your first real client to begin onboarding."}
                  </span>
                  <button onClick={() => setOpen(true)}>＋ Add client</button>
                </div>
              )}
            </div>
          </section>
          <section className="panel tasks" id="tasks">
            <div className="panelhead">
              <div>
                <small>NEXT BUILD</small>
                <h2>What we connect next</h2>
              </div>
            </div>
            {tasks.map((t, i) => (
              <label
                className={done.includes(i) ? "task done" : "task"}
                key={t[0]}
              >
                <input
                  type="checkbox"
                  checked={done.includes(i)}
                  onChange={() =>
                    setDone((d) =>
                      d.includes(i) ? d.filter((x) => x !== i) : [...d, i],
                    )
                  }
                />
                <i>✓</i>
                <span>
                  <b>{t[0]}</b>
                  <small>
                    {t[1]} · {t[2]}
                  </small>
                </span>
                <b>›</b>
              </label>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
