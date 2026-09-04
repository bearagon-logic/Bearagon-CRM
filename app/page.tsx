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
import { Checkbox } from "@/components/ui/checkbox";
type Client = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  relationshipType: string;
  stage: string;
  nextStep: string;
  dueDate: string;
  workspaceStatus: string;
  openTasks: number;
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
const blank = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  relationshipType: "prospect",
  stage: "Intake",
  dueDate: "",
  startOnboarding: false,
};
export default function Home() {
  const [clients, setClients] = useState<Client[]>([]),
    [stage, setStage] = useState("All clients"),
    [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [form, setForm] = useState(blank),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/clients")
      .then(async (r) => {
        const d = await r.json() as { clients?: Client[]; error?: string };
        if (!r.ok) throw new Error(d.error);
        setClients(d.clients || []);
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
        d = await r.json() as { client?: Client; error?: string };
      if (!r.ok) throw new Error(d.error);
      if (!d.client) throw new Error("The saved account was not returned.");
      setClients((c) => [d.client as Client, ...c]);
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
            [c.companyName, c.contactName, c.email].some((value) =>
              value.toLowerCase().includes(query.toLowerCase()),
            ),
        ),
      [clients, stage, query],
    ),
    active = clients.filter((c) =>
      ["Intake", "Connections", "Building", "Testing"].includes(c.stage),
    ).length,
    openTasks = clients.reduce((sum, client) => sum + client.openTasks, 0),
    onboardingQueue = clients
      .filter((client) => client.openTasks > 0)
      .sort((left, right) => right.openTasks - left.openTasks)
      .slice(0, 5);
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
              <i>◎</i><span>Accounts & contacts</span><b>{clients.length}</b><em>⌄</em>
            </summary>
            <div className="side-dropdown-menu">
              {clients.length ? clients.map((client) => (
                <a href={`/clients/${client.id}`} key={client.id}>
                  <i>{client.companyName.split(" ").map((word) => word[0]).join("").slice(0, 2)}</i>
                  <span>{client.companyName}<small>{client.stage}</small></span>
                </a>
              )) : <button onClick={() => setOpen(true)}>＋ Add first account</button>}
              {clients.length > 0 && <a className="dropdown-view-all" href="#clients">View relationship pipeline →</a>}
            </div>
          </details>
          <details className="side-dropdown">
            <summary>
              <i>✓</i><span>Onboarding tasks</span><b>{openTasks}</b><em>⌄</em>
            </summary>
            <div className="side-dropdown-menu task-dropdown">
              {clients.filter((client) => client.openTasks > 0).map((client) => (
                <a href={`/clients/${client.id}`} key={client.id}>
                  <i>✓</i><span>{client.companyName}<small>{client.openTasks} open checklist items</small></span>
                </a>
              ))}
              {!openTasks && <span>All onboarding checklists are complete.</span>}
            </div>
          </details>
          <details className="side-dropdown"><summary><i>◉</i><span>Approvals</span><em>⌄</em></summary><div className="side-dropdown-menu"><a href="/approvals"><i>◉</i><span>Review queue<small>Approve or reject requests</small></span></a><a href="/approvals"><i>✓</i><span>Decision history<small>Client-scoped audit trail</small></span></a></div></details>
          <details className="side-dropdown"><summary><i>⚡</i><span>Automations</span><em>⌄</em></summary><div className="side-dropdown-menu"><a href="/automations"><i>⚡</i><span>Control Center<small>Manage all workflows</small></span></a><a href="/automations#workflow-library"><i>◎</i><span>Workflow library<small>Review and safe test</small></span></a><a href="/automations#safety"><i>✓</i><span>Safety rules<small>Approvals and limits</small></span></a></div></details>
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
            <i className="risk" /> Open tasks <b>{openTasks}</b>
          </p>
          <div className="user">
            <i>BO</i>
            <span>
              <b>Bearagon operator</b>
              <small>Authenticated access</small>
            </span>
          </div>
        </div>
      </aside>
      <section className="workspace" id="overview">
        <header>
          <div>
            <small>BEARAGON OPS</small>
            <h1>Your consulting operations command center.</h1>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button>＋ Add account</button>
            </DialogTrigger>
            <DialogContent className="crm-dialog">
              <form onSubmit={addClient}>
                <DialogHeader>
                  <DialogTitle>Add an account and primary contact</DialogTitle>
                  <DialogDescription>
                    Keep the business relationship, person, and onboarding
                    engagement as separate records from day one.
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
                    Relationship
                    <select
                      value={form.relationshipType}
                      onChange={(e) =>
                        setForm({ ...form, relationshipType: e.target.value })
                      }
                    >
                      <option value="prospect">Prospect</option>
                      <option value="client">Client</option>
                      <option value="partner">Partner</option>
                      <option value="vendor">Vendor</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <div className="form-choice">
                    <Checkbox
                      id="start-onboarding"
                      checked={form.startOnboarding}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          startOnboarding: checked === true,
                          ...(checked === true
                            ? { relationshipType: "client" }
                            : {}),
                        })
                      }
                    />
                    <label htmlFor="start-onboarding">
                      <b>Start onboarding now</b>
                      <small>Create the engagement and standard checklist. Leave this off for leads, partners, and contacts who are not ready for delivery.</small>
                    </label>
                  </div>
                  {form.startOnboarding && <>
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
                  </>}
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
                    {saving ? "Saving…" : "Create account"}
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
              <small>DELIVERY WORKSPACE</small>
              <h2>Start with the client relationship</h2>
              <p>
                Record the account and primary contact first. Provision an
                operational workspace only when delivery begins.
              </p>
            </div>
            <button onClick={() => setOpen(true)}>Add first account →</button>
          </section>
          <section className="metrics">
            <article>
              <small>ACTIVE ONBOARDINGS</small>
              <strong>{active}</strong>
              <span>Across your pipeline</span>
            </article>
            <article>
              <small>TOTAL ACCOUNTS</small>
              <strong>{clients.length}</strong>
              <span>With normalized contacts</span>
            </article>
            <article>
              <small>TASKS TO SET UP</small>
              <strong>{openTasks}</strong>
              <span>Across active onboarding checklists</span>
            </article>
            <article>
              <small>WORKSPACES LINKED</small>
              <strong className="status">{clients.filter((client) => client.workspaceStatus === "active").length}</strong>
              <span className="good">Console tenants stay explicit</span>
            </article>
          </section>
          <section className="panel" id="clients">
            <div className="panelhead">
              <div>
                <small>RELATIONSHIP PIPELINE</small>
                <h2>Accounts, contacts, and onboarding</h2>
              </div>
              <label>
                ⌕{" "}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search accounts or contacts"
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
                <span>ACCOUNT & CONTACT</span>
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
                        <small>{c.contactName} · {c.relationshipType}</small>
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
                      ? "No accounts match this view."
                      : "No accounts yet."}
                  </b>
                  <span>
                    {clients.length
                      ? "Try another stage or search."
                      : "Add your first account and contact to begin."}
                  </span>
                  <button onClick={() => setOpen(true)}>＋ Add account</button>
                </div>
              )}
            </div>
          </section>
          <section className="panel tasks" id="tasks">
            <div className="panelhead">
              <div>
                <small>ONBOARDING QUEUE</small>
                <h2>Open work by account</h2>
              </div>
            </div>
            {onboardingQueue.map((client) => (
              <a
                className="task queue"
                href={`/clients/${client.id}`}
                key={client.id}
              >
                <i aria-hidden="true">{client.openTasks}</i>
                <span>
                  <b>{client.companyName}</b>
                  <small>
                    {client.openTasks} open checklist {client.openTasks === 1 ? "item" : "items"} · {client.nextStep}
                  </small>
                </span>
                <b>›</b>
              </a>
            ))}
            {!loading && !onboardingQueue.length && (
              <div className="empty">
                <b>{clients.length ? "Onboarding is caught up." : "No onboarding work yet."}</b>
                <span>{clients.length ? "All current checklist items are complete." : "Add an account to create its onboarding checklist."}</span>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
