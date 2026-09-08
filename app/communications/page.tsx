"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OwnerSelect } from "@/components/owner-select";
import { Inbox, Plus, Search, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { IntakeFeeds } from "@/components/intake-feeds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type Account = { id: string; companyName: string; organizationKind: string };
type Inquiry = { id: string; accountId: string; companyName: string; contactName: string; email: string; phone: string; source: string; summary: string; status: string; owner: string; nextAction: string; followUpDate: string; resolution: string; createdAt: string; recordedBy: string };
const empty = { accountId: "", companyName: "", contactName: "", email: "", phone: "", source: "phone", summary: "", owner: "", nextAction: "", followUpDate: "" };
const states = ["new", "working", "qualified", "closed"];
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
async function read(response: Response) { const data = await response.json() as { inquiries?: Inquiry[]; clients?: Account[]; error?: string; inquiry?: Inquiry; contactReused?: boolean }; if (!response.ok) throw new Error(data.error || "Unable to load records."); return data; }

export default function Communications() {
  const searchParams = useSearchParams();
  const requestedInquiry = searchParams.get("inquiry");
  const [items, setItems] = useState<Inquiry[]>([]), [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Inquiry | null>(null), [filter, setFilter] = useState("open"), [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false), [form, setForm] = useState(empty), [requestKey, setRequestKey] = useState("");
  const [reviewId,setReviewId]=useState(""),[feedRevision,setFeedRevision]=useState(0);
  async function refresh(selectId?: string) {
    const [inbox, directory] = await Promise.all([fetch("/api/inquiries").then(read), fetch("/api/clients").then(read)]);
    const next = inbox.inquiries || [];
    setItems(next); setAccounts((directory.clients || []).filter((a) => a.organizationKind !== "internal"));
    if (selectId) setSelected(next.find((i) => i.id === selectId) || null);
  }
  useEffect(() => { refresh(requestedInquiry || undefined).catch((e) => setError(e.message)).finally(() => setLoading(false)); if (requestedInquiry) setFilter("all"); }, [requestedInquiry]);
  const visible = useMemo(() => items.filter((i) =>
    (filter === "all" || (filter === "open" ? i.status !== "closed" : filter === "overdue" ? i.status !== "closed" && !!i.followUpDate && i.followUpDate < today() : i.status === filter))
    && [i.companyName, i.contactName, i.summary, i.owner].some((v) => v.toLowerCase().includes(query.toLowerCase()))), [items, filter, query]);
  async function create(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const data = await fetch(reviewId?"/api/intake/review":"/api/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(reviewId?{id:reviewId,action:"import",data:form}:{ ...form, requestKey }) }).then(read);
      if(reviewId){setReviewId("");setFeedRevision((v)=>v+1);}
      setOpen(false); setForm(empty); setFilter("all"); setQuery("");
      setNotice(data.contactReused ? "Inquiry saved. The existing contact was linked; their details and marketing preference were preserved." : "Inquiry saved. No onboarding or marketing subscription was started.");
      await refresh(data.inquiry?.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save inquiry."); }
    finally { setSaving(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!selected) return; setSaving(true); setError(""); setNotice("");
    try {
      await fetch("/api/inquiries", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(selected) }).then(read);
      setNotice("Follow-up saved. Qualifying an inquiry does not change the company to a client."); await refresh(selected.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save follow-up."); }
    finally { setSaving(false); }
  }
  return <AppShell><main className="ops-intake-page">
    <header className="ops-intake-header"><div><small>RELATIONSHIPS · INBOX</small><h1>Inquiries</h1><p>From first contact to a clear next step.</p></div><Button onClick={() => { setReviewId(""); setForm(empty); setError(""); setRequestKey(crypto.randomUUID()); setOpen(true); }}><Plus aria-hidden="true" />Record inquiry</Button></header>
    <div className="ops-intake-body">
      <IntakeFeeds key={feedRevision} onImported={()=>{void refresh().catch((e)=>setError(e.message));}} onReview={(r)=>{setReviewId(r.id);setForm({...empty,...r.event,source:r.event.source==="retell"?"phone":"website"});setError("");setOpen(true);}}/>
      {error && !open && <p role="alert" className="form-error">{error} <button onClick={() => { setError(""); refresh().catch((e) => setError(e.message)); }}>Retry</button></p>}
      {notice && <p role="status" className="intake-notice">{notice}</p>}
      <div className="intake-toolbar"><label className="intake-search"><Search aria-hidden="true"/><Input aria-label="Search inquiries" placeholder="Search company, contact, or message" value={query} onChange={(e) => setQuery(e.target.value)} /></label><label>Show<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="open">Open inquiries</option><option value="new">New</option><option value="working">Working</option><option value="qualified">Qualified</option><option value="overdue">Overdue follow-up</option><option value="closed">Closed</option><option value="all">All inquiries</option></select></label><span>{visible.length} shown</span></div>
      <div className="intake-workspace">
        <section className="intake-list" aria-label="Inquiry list">
          {loading && <p className="intake-empty">Loading inquiries…</p>}
          {!loading && !visible.length && <div className="intake-empty"><Inbox aria-hidden="true"/><h2>{items.length ? "No matching inquiries" : "A real inbox starts here"}</h2><p>{items.length ? "Change the filter or search to see more records." : "Record the next call or website message. We’ll link it to a company and keep its follow-up here."}</p></div>}
          {visible.map((item) => <button key={item.id} className={`intake-row ${selected?.id === item.id ? "selected" : ""}`} aria-pressed={selected?.id === item.id} disabled={saving} onClick={() => { if (selected && JSON.stringify(selected) !== JSON.stringify(items.find((i) => i.id === selected.id)) && !window.confirm("Discard unsaved follow-up changes?")) return; setSelected({ ...item }); setNotice(""); }}><span className="intake-row-heading"><b>{item.companyName}</b><em className={`intake-status ${item.status}`}>{item.status}</em></span><span>{item.contactName} · {item.source}</span><p>{item.summary}</p><span className="intake-row-footer"><span>{item.owner || "Unassigned"}</span><span className={item.status !== "closed" && item.followUpDate && item.followUpDate < today() ? "intake-overdue" : ""}>{item.followUpDate || "No follow-up date"}</span></span></button>)}
        </section>
        <section className="intake-detail" aria-label="Inquiry details">{selected ? <form onSubmit={save}>
          <div className="intake-detail-heading"><small>{selected.source} · {selected.createdAt.slice(0, 10)}</small><h2>{selected.companyName}</h2><Link href={`/clients/${selected.accountId}`}>Open account <ArrowUpRight aria-hidden="true"/></Link></div>
          <p><b>{selected.contactName}</b><br/>{selected.email || "No email recorded"}<br/>{selected.phone || "No phone recorded"}</p><blockquote className="intake-message">{selected.summary}</blockquote>
          <div className="form-grid"><label>Status<select value={selected.status} onChange={(e) => setSelected({ ...selected, status: e.target.value })}>{states.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></label><label>Owner<OwnerSelect value={selected.owner} onChange={(value) => setSelected({ ...selected, owner: value })}/></label><label>Next action<Input maxLength={500} value={selected.nextAction} onChange={(e) => setSelected({ ...selected, nextAction: e.target.value })}/></label><label>Follow-up date<Input type="date" value={selected.followUpDate} onChange={(e) => setSelected({ ...selected, followUpDate: e.target.value })}/></label><label className="intake-wide">Resolution / handoff note<Textarea required={selected.status === "closed"} value={selected.resolution} maxLength={2000} placeholder="Record the outcome or handoff. Required to close." onChange={(e) => setSelected({ ...selected, resolution: e.target.value })}/></label></div>
          <div className="intake-save"><span>Recorded by {selected.recordedBy}</span><Button disabled={saving} type="submit">{saving ? "Saving…" : "Save follow-up"}</Button></div>
        </form> : <div className="intake-empty"><h2>Select an inquiry</h2><p>Review the message, assign an owner, and plan the next conversation.</p></div>}</section>
      </div>
    </div>
    <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}><DialogContent className="crm-dialog intake-dialog"><form onSubmit={create}><DialogHeader><DialogTitle>Record an inquiry</DialogTitle><DialogDescription>Choose an existing company or create a prospect. Nothing is sent to the contact.</DialogDescription></DialogHeader><div className="form-grid">
      <label className="intake-wide">Company<select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}><option value="">Create a new prospect company</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.companyName}</option>)}</select></label>
      {!form.accountId && <label className="intake-wide">New company name<Input required maxLength={200} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}/></label>}
      <label>Contact name<Input required maxLength={200} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}/></label><label>Source<select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>{["phone", "website", "email", "referral", "other"].map((s) => <option key={s}>{s}</option>)}</select></label>
      <label>Email<Input type="email" required={!form.phone} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/></label><label>Callback number<Input type="tel" required={!form.email} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}/></label>
      <label className="intake-wide">What do they need?<Textarea required maxLength={5000} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })}/></label><label>Owner<Input value={form.owner} placeholder="Employee name or email" onChange={(e) => setForm({ ...form, owner: e.target.value })}/></label><label>Follow-up date<Input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}/></label><label className="intake-wide">Next action<Input maxLength={500} value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })}/></label>
    </div>{error && <p role="alert" className="form-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving}>{saving ? "Saving…" : "Save inquiry"}</Button></DialogFooter></form></DialogContent></Dialog>
  </main></AppShell>;
}
