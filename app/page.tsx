"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AppShell } from "@/components/app-shell";

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

const stages = ["All clients", "Intake", "Connections", "Building", "Testing", "Live"];
const deliveryStages = stages.slice(1);
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

function initials(value: string) {
  return value.split(" ").filter(Boolean).map((word) => word[0]).join("").slice(0, 3);
}

export default function AccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStage = searchParams.get("stage") || "All clients";
  const stage = stages.includes(requestedStage) ? requestedStage : "All clients";
  const query = searchParams.get("q") || "";
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setFilter(key: "stage" | "q", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || (key === "stage" && value === "All clients")) params.delete(key);
    else params.set(key, value);
    const suffix = params.toString();
    router.replace(suffix ? `/?${suffix}` : "/", { scroll: false });
  }

  useEffect(() => {
    if (searchParams.get("newAccount") !== "1") return;
    setOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("newAccount");
    const suffix = params.toString();
    router.replace(suffix ? `/?${suffix}` : "/", { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    fetch("/api/clients")
      .then(async (response) => {
        const data = await response.json() as { clients?: Client[]; error?: string };
        if (!response.ok) throw new Error(data.error);
        setClients(data.clients || []);
      })
      .catch(() => setError("Client records are temporarily unavailable."))
      .finally(() => setLoading(false));
  }, []);

  async function addClient(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json() as { client?: Client; error?: string };
      if (!response.ok) throw new Error(data.error);
      if (!data.client) throw new Error("The saved account was not returned.");
      setClients((current) => [data.client as Client, ...current]);
      setForm(blank);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add account.");
    } finally {
      setSaving(false);
    }
  }

  const visible = useMemo(() => clients.filter((client) => (
    (stage === "All clients" || client.stage === stage)
    && [client.companyName, client.contactName, client.email].some((value) => value.toLowerCase().includes(query.toLowerCase()))
  )), [clients, stage, query]);
  const active = clients.filter((client) => deliveryStages.includes(client.stage)).length;
  const openTasks = clients.reduce((sum, client) => sum + client.openTasks, 0);

  return (
    <AppShell>
      <section className="workspace ops-accounts-page" id="accounts">
        <header className="ops-header ops-accounts-header">
          <div className="ops-header-copy">
            <small>ACCOUNT DIRECTORY</small>
            <h1>Accounts</h1>
            <p>Keep the client relationship, delivery status, and next action in one operating record.</p>
          </div>
          <button className="ops-header-action" type="button" onClick={() => setOpen(true)}>Add account</button>
        </header>

        <nav className="account-section-nav" aria-label="Account workspace">
          <Link href="/" className="active">Directory</Link>
          <Link href="/accounts/onboarding">Delivery queue</Link>
        </nav>

        <div className="content ops-account-content">
          <section className="panel account-directory" aria-labelledby="accounts-heading">
            <div className="panelhead account-directory-head">
              <div><small>RELATIONSHIPS</small><h2 id="accounts-heading">All accounts</h2></div>
              <label className="account-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setFilter("q", event.target.value)} placeholder="Search accounts or contacts" aria-label="Search accounts or contacts" /></label>
            </div>
            <div className="account-filter-row">
              <label className="stage-filter"><span>Filter by delivery stage</span><select value={stage} onChange={(event) => setFilter("stage", event.target.value)} aria-label="Filter accounts by delivery stage">{stages.map((item) => <option key={item}>{item}</option>)}</select></label>
              <span className="account-count">{loading ? "" : `${visible.length} shown`}</span>
            </div>
            <div className="rows account-rows">
              <div className="row labels"><span>ACCOUNT & PRIMARY CONTACT</span><span>RELATIONSHIP</span><span>DELIVERY STATUS</span><span>NEXT ACTION</span><span>TARGET</span></div>
              {loading && <p className="empty">Loading accounts…</p>}
              {!loading && visible.map((client) => (
                <Link className="row client" href={`/clients/${client.id}`} key={client.id}>
                  <span className="name"><i>{initials(client.companyName)}</i><span><b>{client.companyName}</b><small>{client.contactName} · {client.email}</small></span></span>
                  <span className="relationship-cell">{client.relationshipType}</span>
                  <span><em className={`pill ${client.stage.toLowerCase()}`}>{client.stage}</em></span>
                  <span className="next-action-cell">{client.nextStep || "Set next action"}</span>
                  <span className="target-cell">{client.dueDate || "Not set"}<ArrowUpRight aria-hidden="true" /></span>
                </Link>
              ))}
              {!loading && !visible.length && <div className="empty account-empty"><b>{clients.length ? "No accounts match this view." : "Add your first account."}</b><span>{clients.length ? "Try a different delivery stage or search term." : "Create the relationship first; start onboarding only when delivery is ready."}</span><button type="button" onClick={() => setOpen(true)}>Add account</button></div>}
            </div>
          </section>

          <div className="ops-account-lower-grid">
            <section className="metrics ops-metrics account-summary-metrics" aria-label="Account operating summary">
              <article><small>ACTIVE DELIVERY</small><strong>{active}</strong><span>Accounts in progress</span></article>
              <article><small>OPEN TASKS</small><strong>{openTasks}</strong><span>Across checklists</span></article>
              <article><small>WORKSPACES</small><strong className="status">{clients.filter((client) => client.workspaceStatus === "active").length}</strong><span>Linked to Console</span></article>
            </section>
          </div>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="crm-dialog">
          <form onSubmit={addClient}>
            <DialogHeader><DialogTitle>Add an account</DialogTitle><DialogDescription>Record the business relationship and primary contact. Create delivery work only when the account is ready for onboarding.</DialogDescription></DialogHeader>
            <div className="form-grid">
              <label>Company name<Input required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></label>
              <label>Primary contact<Input required value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></label>
              <label>Email<Input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label>Phone<Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
              <label>Relationship<select value={form.relationshipType} onChange={(event) => setForm({ ...form, relationshipType: event.target.value })}><option value="prospect">Prospect</option><option value="client">Client</option><option value="partner">Partner</option><option value="vendor">Vendor</option><option value="other">Other</option></select></label>
              <div className="form-choice"><Checkbox id="start-onboarding" checked={form.startOnboarding} onCheckedChange={(checked) => setForm({ ...form, startOnboarding: checked === true, ...(checked === true ? { relationshipType: "client" } : {}) })} /><label htmlFor="start-onboarding"><b>Start onboarding now</b><small>Create the delivery engagement and standard checklist. Leave this off for a lead, partner, or relationship that is not ready for delivery.</small></label></div>
              {form.startOnboarding && <><label>Starting stage<select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>{deliveryStages.map((item) => <option key={item}>{item}</option>)}</select></label><label>Target date<Input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label></>}
            </div>
            {error && <p className="form-error">{error}</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create account"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
