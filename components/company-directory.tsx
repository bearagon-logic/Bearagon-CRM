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
  organizationKind?: string;
  salesStage?: string;
  relationshipOwner?: string;
  stage: string;
  onboardingStatus: string;
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
  const sales = searchParams.get("sales") || "all";
  const [relationship,setRelationship]=useState("All relationships");
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setFilter(key: "stage" | "q" | "sales", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || (key === "stage" && value === "All clients")) params.delete(key);
    else params.set(key, value);
    const suffix = params.toString();
    router.replace(suffix ? `/companies?${suffix}` : "/companies", { scroll: false });
  }

  useEffect(() => {
    if (searchParams.get("newAccount") !== "1") return;
    setOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("newAccount");
    const suffix = params.toString();
    router.replace(suffix ? `/companies?${suffix}` : "/companies", { scroll: false });
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
      router.push(
        data.client.onboardingStatus === "active"
          ? `/clients/${data.client.id}?tab=onboarding`
          : `/clients/${data.client.id}`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add account.");
    } finally {
      setSaving(false);
    }
  }

  const external = clients.filter((client) => client.organizationKind !== "internal");
  const internal = clients.find((client) => client.organizationKind === "internal");
  async function openInternalProfile() {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/organization", { method: "POST" });
      const data = await response.json() as { accountId?: string; error?: string };
      if (!response.ok || !data.accountId) throw new Error(data.error || "Unable to create internal profile.");
      router.push(`/clients/${data.accountId}?tab=automations`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to open profile."); }
    finally { setSaving(false); }
  }
  const visible = useMemo(() => clients.filter((client) => (
    (relationship==="All relationships"||(relationship==="Internal"?client.organizationKind==="internal":client.organizationKind!=="internal"&&(relationship==="Clients"?client.relationshipType==="client":client.relationshipType!=="client")))
    && (sales === "all" || client.salesStage === sales)
    &&
    (stage === "All clients" || client.stage === stage)
    && [client.companyName, client.contactName, client.email].some((value) => value.toLowerCase().includes(query.toLowerCase()))
  )), [clients, stage, query, sales, relationship]);
  const active = external.filter((client) => ["planned", "active", "blocked"].includes(client.onboardingStatus)).length;
  const openTasks = external.reduce((sum, client) => sum + client.openTasks, 0);

  return (
    <AppShell activeSection="/companies">
      <section className="workspace ops-accounts-page concept-directory" id="accounts">
        <header className="ops-header ops-accounts-header">
          <div className="ops-header-copy">
            <small>RELATIONSHIPS</small>
            <h1>Companies</h1>
            <p>Keep the client relationship, delivery status, and next action in one operating record.</p>
          </div>
          <button className="ops-header-action" type="button" onClick={() => setOpen(true)}>Add company</button>
        </header>


        <div className="content ops-account-content">
          {error && !open && <p role="alert" className="form-error">{error}</p>}
          <section className="internal-organization"><div><small>OUR OWN OPERATIONS</small><b>Bearagon</b><span>Internal automation portfolio · separate from the customer pipeline</span></div>{internal ? <Link href={`/clients/${internal.id}?tab=automations`}>Open internal workspace <ArrowUpRight aria-hidden="true" /></Link> : <Button variant="outline" disabled={loading || saving} onClick={openInternalProfile}>{saving ? "Opening…" : "Set up internal profile"}</Button>}</section>
          <section className="panel account-directory" aria-labelledby="accounts-heading">
            <div className="panelhead account-directory-head">
              <div><small>RELATIONSHIPS</small><h2 id="accounts-heading">Company directory</h2></div>
              <label className="account-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setFilter("q", event.target.value)} placeholder="Search accounts or contacts" aria-label="Search accounts or contacts" /></label>
            </div>
            <div className="company-lane-toolbar"><div className="relationship-choices" aria-label="Filter companies">{["All relationships","Prospects","Clients","Internal"].map(v=><button key={v} type="button" aria-pressed={relationship===v} onClick={()=>setRelationship(v)}>{v}</button>)}</div></div><details className="directory-advanced"><summary>More filters</summary><div className="account-filter-row">
              <label className="stage-filter"><span>Relationship stage</span><select value={sales} onChange={(event) => setFilter("sales", event.target.value)}><option value="all">All relationships</option>{["new", "contacted", "qualified", "proposal", "won", "lost", "nurture"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></label>
              <label className="stage-filter"><span>Filter by delivery stage</span><select value={stage} onChange={(event) => setFilter("stage", event.target.value)} aria-label="Filter accounts by delivery stage">{stages.map((item) => <option key={item}>{item}</option>)}</select></label>
              <span className="account-count">{loading ? "" : `${visible.length} shown`}</span>
            </div>
            </details><div className="rows account-rows">
              <div className="row labels"><span>COMPANY & CONTACT</span><span>RELATIONSHIP</span><span>CURRENT WORK</span><span>NEXT ACTION</span><span>TARGET</span></div>
              {loading && <p className="empty">Loading accounts…</p>}
              {!loading && visible.map((client) => (
                <Link className="row client" href={`/clients/${client.id}`} key={client.id}>
                  <span className="name"><i>{initials(client.companyName)}</i><span><b>{client.companyName}</b><small>{client.contactName} · {client.email}</small></span></span>
                  <span className="relationship-cell">{client.relationshipType}<small>{client.salesStage || "new"}{client.relationshipOwner ? ` · ${client.relationshipOwner}` : ""}</small></span>
                  <span><em className={`pill ${client.stage.toLowerCase()}`}>{client.organizationKind==='internal'?'Internal operations':client.stage}</em></span>
                  <span className="next-action-cell">{client.organizationKind==='internal'?'Manage automation portfolio':client.nextStep || "Set next action"}</span>
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
              <article><small>WORKSPACES</small><strong className="status">{external.filter((client) => client.workspaceStatus === "active").length}</strong><span>Linked to Console</span></article>
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
