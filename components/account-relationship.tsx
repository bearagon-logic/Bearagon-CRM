"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { OwnerSelect } from "@/components/owner-select";

type Relationship = { organizationKind: string; relationshipOwner: string; salesStage: string; followUpDate: string; relationshipNextAction: string };
type Contact = { displayName: string; marketingStatus: string; marketingEvidence: string };
type Inquiry = { id: string; source: string; summary: string; status: string; nextAction: string; followUpDate: string; owner: string; resolution?:string; updatedAt:string };
export function AccountRelationship({ accountId, ongoing=false, onRelationshipChange, onScope, onDirty }: { accountId: string; ongoing?:boolean; onRelationshipChange?: (type: string) => void; onScope?:()=>void; onDirty?:(dirty:boolean)=>void }) {
  const [account, setAccount] = useState<Relationship | null>(null), [contact, setContact] = useState<Contact | null>(null), [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [saving, setSaving] = useState(false);
  const [handoffId,setHandoffId]=useState('');
  async function handoff(inquiry:Inquiry) {
    const r=await fetch('/api/inquiries',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'handoff',id:inquiry.id,accountId,expectedUpdatedAt:inquiry.updatedAt})});
    const result=await r.json() as {error?:string};
    if(!r.ok)throw Error(result.error||'Relationship saved, but inquiry handoff failed. Retry the handoff below.');
    setInquiries(rows=>rows.map(i=>i.id===inquiry.id?{...i,status:'closed',resolution:'Handed off to scope and delivery'}:i));
  }
  useEffect(() => { Promise.all([
    fetch(`/api/clients/${accountId}/relationship`).then(async (r) => { const d = await r.json() as { account: Relationship; contact: Contact | null; error?: string }; if (!r.ok) throw Error(d.error); setAccount(d.account); setContact(d.contact); }),
    fetch(`/api/inquiries?accountId=${encodeURIComponent(accountId)}`).then(async (r) => { const d = await r.json() as { inquiries: Inquiry[]; error?: string }; if (!r.ok) throw Error(d.error); setInquiries(d.inquiries); }),
  ]).catch((e) => setError(e.message)); }, [accountId]);
  async function save(e: FormEvent) {
    e.preventDefault(); if (!account) return; setSaving(true); setError(""); setNotice("");
    const scope=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('name')==='qualify';
    try {
      const r = await fetch(`/api/clients/${accountId}/relationship`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...account, ...(scope&&!['won','proposal'].includes(account.salesStage)?{salesStage:'qualified'}:{}), marketingStatus: contact?.marketingStatus || "unknown", marketingEvidence: contact?.marketingEvidence || "" }) });
      const d = await r.json() as { error?: string; account: Relationship & { relationshipType: string }; contact: Contact | null };
      if (!r.ok) throw Error(d.error); setAccount(d.account); setContact(d.contact); onDirty?.(false); onRelationshipChange?.(d.account.relationshipType);
      setNotice(account.salesStage === "won" ? "Saved as a client. Choose Onboarding plan when you are ready to begin delivery; no services or automations were created." : "Relationship and contact preferences saved.");
      if(scope){const selected=inquiries.find(i=>i.id===handoffId&&i.status!=='closed');if(selected)await handoff(selected);onScope?.();}
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save relationship."); } finally { setSaving(false); }
  }
  return <section className="panel relationship-panel"><div className="panelhead"><div><small>{account?.organizationKind === "internal" ? "INTERNAL OPERATIONS" : "SALES & FOLLOW-UP"}</small><h2>{account?.organizationKind === "internal" ? "Bearagon’s own workspace" : "Review inquiry & follow-up"}</h2></div></div>
    <div className="relationship-body">{error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="intake-notice">{notice}</p>}
    {!account && !error && <p>Loading relationship…</p>}
    {account?.organizationKind === "internal" ? <p>Track Bearagon’s services and automations in the same workspace as client delivery. This organization is excluded from the external account directory and sales pipeline. There is no customer contract or marketing audience implied.</p> : account && <form onSubmit={save} onChange={()=>onDirty?.(true)}><div className="form-grid">
      <label>Relationship stage<select value={account.salesStage} onChange={(e) => setAccount({ ...account, salesStage: e.target.value })}>{["new", "contacted", "qualified", "proposal", "won", "lost", "nurture"].map((s) => <option value={s} key={s}>{s === "won" ? "Won · client" : s[0].toUpperCase() + s.slice(1)}</option>)}</select></label>
      <label>Bearagon owner<OwnerSelect value={account.relationshipOwner} onChange={(value) => setAccount({ ...account, relationshipOwner: value })}/></label><label>What do they need / next conversation<Input maxLength={500} value={account.relationshipNextAction} onChange={(e) => setAccount({ ...account, relationshipNextAction: e.target.value })}/></label><label>Follow-up due<Input type="date" value={account.followUpDate} onChange={(e) => setAccount({ ...account, followUpDate: e.target.value })}/></label>
      {contact && <><label className="intake-wide">Marketing preference · {contact.displayName}<select value={contact.marketingStatus} onChange={(e) => setContact({ ...contact, marketingStatus: e.target.value })}><option value="unknown">Unknown · do not enroll</option><option value="subscribed">Subscribed · permission recorded</option><option value="unsubscribed">Unsubscribed · suppress marketing</option></select></label><label className="intake-wide">Permission source and date / preference note<Textarea required={contact.marketingStatus === "subscribed"} maxLength={2000} value={contact.marketingEvidence} onChange={(e) => setContact({ ...contact, marketingEvidence: e.target.value })}/></label></>}
    </div><p className="relationship-help">Sales stage is separate from delivery. Marking won does not accept a quote or send a campaign. Contact marketing preferences apply across linked companies.</p>
    {!ongoing&&onScope&&inquiries.some(i=>i.status!=='closed')&&<label>Inquiry handoff<select value={handoffId} onChange={e=>setHandoffId(e.target.value)}><option value="">Keep open — a response or follow-up is still needed</option>{inquiries.filter(i=>i.status!=='closed').map(i=><option key={i.id} value={i.id}>Resolve this intake: {i.summary.slice(0,90)}</option>)}</select><small>Only the selected inquiry closes when you qualify. Other conversations stay open.</small></label>}
    <div className="company-actions"><Button disabled={saving}>{saving ? "Saving…" : "Save relationship"}</Button>{onScope&&!ongoing&&<Button name="qualify" type="submit" disabled={saving}>Qualify & scope services →</Button>}</div></form>}
    {inquiries.length > 0 && <div className="relationship-inquiries"><h3>Inquiry history</h3>{inquiries.map((i) => <article key={i.id}><span><b>{i.source}</b> · {i.status}</span><p>{i.summary}</p><small>{i.status==='closed'?i.resolution:i.owner || "Unassigned"} · {i.status==='closed'?'Intake resolved':i.nextAction || "No next action"}</small><div className="company-actions"><Link href={`/communications?inquiry=${encodeURIComponent(i.id)}`}>Review inquiry →</Link>{ongoing&&i.status!=='closed'&&<Button variant="outline" disabled={saving} onClick={async()=>{setSaving(true);setError('');try{await handoff(i);setNotice('Selected intake resolved. Other inquiries are unchanged.');}catch(e){setError((e as Error).message);}finally{setSaving(false);}}}>Resolve completed intake</Button>}</div>{ongoing&&i.status!=='closed'&&<p className="company-help">Onboarding is complete. Resolve this intake only if no response is still owed.</p>}</article>)}</div>}
    </div></section>;
}
