"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { OwnerSelect } from "@/components/owner-select";

type Relationship = { organizationKind: string; relationshipOwner: string; salesStage: string; followUpDate: string; relationshipNextAction: string };
type Contact = { displayName: string; marketingStatus: string; marketingEvidence: string };
type Inquiry = { id: string; source: string; summary: string; status: string; nextAction: string; followUpDate: string; owner: string };
export function AccountRelationship({ accountId, onRelationshipChange }: { accountId: string; onRelationshipChange?: (type: string) => void }) {
  const [account, setAccount] = useState<Relationship | null>(null), [contact, setContact] = useState<Contact | null>(null), [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [saving, setSaving] = useState(false);
  useEffect(() => { Promise.all([
    fetch(`/api/clients/${accountId}/relationship`).then(async (r) => { const d = await r.json() as { account: Relationship; contact: Contact | null; error?: string }; if (!r.ok) throw Error(d.error); setAccount(d.account); setContact(d.contact); }),
    fetch(`/api/inquiries?accountId=${encodeURIComponent(accountId)}`).then(async (r) => { const d = await r.json() as { inquiries: Inquiry[]; error?: string }; if (!r.ok) throw Error(d.error); setInquiries(d.inquiries); }),
  ]).catch((e) => setError(e.message)); }, [accountId]);
  async function save(e: FormEvent) {
    e.preventDefault(); if (!account) return; setSaving(true); setError(""); setNotice("");
    try {
      const r = await fetch(`/api/clients/${accountId}/relationship`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...account, marketingStatus: contact?.marketingStatus || "unknown", marketingEvidence: contact?.marketingEvidence || "" }) });
      const d = await r.json() as { error?: string; account: Relationship & { relationshipType: string }; contact: Contact | null };
      if (!r.ok) throw Error(d.error); setAccount(d.account); setContact(d.contact); onRelationshipChange?.(d.account.relationshipType);
      setNotice(account.salesStage === "won" ? "Saved as a client. Choose Onboarding plan when you are ready to begin delivery; no services or automations were created." : "Relationship and contact preferences saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save relationship."); } finally { setSaving(false); }
  }
  return <section className="panel relationship-panel"><div className="panelhead"><div><small>{account?.organizationKind === "internal" ? "INTERNAL OPERATIONS" : "SALES & FOLLOW-UP"}</small><h2>{account?.organizationKind === "internal" ? "Bearagon’s own workspace" : "Relationship"}</h2></div></div>
    <div className="relationship-body">{error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="intake-notice">{notice}</p>}
    {!account && !error && <p>Loading relationship…</p>}
    {account?.organizationKind === "internal" ? <p>Track Bearagon’s services and automations in the same workspace as client delivery. This organization is excluded from the external account directory and sales pipeline. There is no customer contract or marketing audience implied.</p> : account && <form onSubmit={save}><div className="form-grid">
      <label>Relationship stage<select value={account.salesStage} onChange={(e) => setAccount({ ...account, salesStage: e.target.value })}>{["new", "contacted", "qualified", "proposal", "won", "lost", "nurture"].map((s) => <option value={s} key={s}>{s === "won" ? "Won · client" : s[0].toUpperCase() + s.slice(1)}</option>)}</select></label>
      <label>Bearagon owner<OwnerSelect value={account.relationshipOwner} onChange={(value) => setAccount({ ...account, relationshipOwner: value })}/></label><label>Next relationship action<Input maxLength={500} value={account.relationshipNextAction} onChange={(e) => setAccount({ ...account, relationshipNextAction: e.target.value })}/></label><label>Follow-up date<Input type="date" value={account.followUpDate} onChange={(e) => setAccount({ ...account, followUpDate: e.target.value })}/></label>
      {contact && <><label className="intake-wide">Marketing preference · {contact.displayName}<select value={contact.marketingStatus} onChange={(e) => setContact({ ...contact, marketingStatus: e.target.value })}><option value="unknown">Unknown · do not enroll</option><option value="subscribed">Subscribed · permission recorded</option><option value="unsubscribed">Unsubscribed · suppress marketing</option></select></label><label className="intake-wide">Permission source and date / preference note<Textarea required={contact.marketingStatus === "subscribed"} maxLength={2000} value={contact.marketingEvidence} onChange={(e) => setContact({ ...contact, marketingEvidence: e.target.value })}/></label></>}
    </div><p className="relationship-help">Sales stage is separate from delivery. Marking won records the client relationship, not quote acceptance. Marketing preferences apply to this contact across linked companies; no campaigns are sent from here.</p><Button disabled={saving}>{saving ? "Saving…" : "Save relationship"}</Button></form>}
    {inquiries.length > 0 && <div className="relationship-inquiries"><h3>Inquiry history</h3>{inquiries.map((i) => <article key={i.id}><span><b>{i.source}</b> · {i.status}</span><p>{i.summary}</p><small>{i.owner || "Unassigned"} · {i.nextAction || "No next action"} · {i.followUpDate || "No follow-up date"}</small></article>)}<Link href="/communications">Manage inquiry follow-up →</Link></div>}
    </div></section>;
}
