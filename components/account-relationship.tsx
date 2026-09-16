"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {useDirtyHistory} from "./use-dirty-history";
import {RecoveredDraft} from "./recovered-draft";
import {retainHistoryDraft,takeHistoryDraft,clearHistoryDraft,beginHistorySave,waitForHistorySave,recoveryText} from "@/lib/dirty-history";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { OwnerSelect } from "@/components/owner-select";

type Relationship = { organizationKind: string; relationshipOwner: string; salesStage: string; followUpDate: string; relationshipNextAction: string };
type Contact = { displayName: string; marketingStatus: string; marketingEvidence: string };
type Inquiry = { id: string; source: string; summary: string; status: string; nextAction: string; followUpDate: string; owner: string; resolution?:string; updatedAt:string };
type RelationshipHistoryDraft={account:Relationship;contact:Contact|null;handoffId:string;baseline:{account:Relationship;contact:Contact|null}};
export function AccountRelationship({ accountId, ongoing=false, onRelationshipChange, onScope, onDirty }: { accountId: string; ongoing?:boolean; onRelationshipChange?: (type: string) => void; onScope?:()=>void; onDirty?:(dirty:boolean)=>void }) {
  const dirtyNotifier=useRef(onDirty);dirtyNotifier.current=onDirty;
  useEffect(()=>()=>dirtyNotifier.current?.(false),[]);
  const [account, setAccount] = useState<Relationship | null>(null), [contact, setContact] = useState<Contact | null>(null), [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [saving, setSaving] = useState(false);
  const [handoffId,setHandoffId]=useState('');
  const historyKey=`relationship:${accountId}`;
  const baseline=useRef<{account:Relationship;contact:Contact|null}|null>(null),currentSaved=useRef<{account:Relationship;contact:Contact|null}|null>(null),loadedAccount=useRef('');
  const [recoveryBlocked,setRecoveryBlocked]=useState(false);
  const dirty=!!account&&!!baseline.current&&(JSON.stringify({account,contact})!==JSON.stringify(baseline.current)||!!handoffId);
  useDirtyHistory({dirty:()=>dirty,retain:()=>{if(account&&baseline.current)retainHistoryDraft<RelationshipHistoryDraft>(historyKey,{account,contact,handoffId,baseline:baseline.current});},discard:()=>{clearHistoryDraft(historyKey);if(currentSaved.current){baseline.current=currentSaved.current;setAccount(currentSaved.current.account);setContact(currentSaved.current.contact);}setHandoffId('');setRecoveryBlocked(false);}});
  useEffect(()=>{onDirty?.(dirty);if(loadedAccount.current===accountId&&!dirty)clearHistoryDraft(historyKey);},[dirty,accountId,historyKey,onDirty]);
  async function handoff(inquiry:Inquiry) {
    const r=await fetch('/api/inquiries',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'handoff',id:inquiry.id,accountId,expectedUpdatedAt:inquiry.updatedAt})});
    const result=await r.json() as {error?:string};
    if(!r.ok)throw Error(result.error||'Relationship saved, but inquiry handoff failed. Retry the handoff below.');
    setInquiries(rows=>rows.map(i=>i.id===inquiry.id?{...i,status:'closed',resolution:'Handed off to scope and delivery'}:i));
  }
  useEffect(() => { let active=true;Promise.all([
    waitForHistorySave(historyKey).then(()=>fetch(`/api/clients/${accountId}/relationship`)).then(async (r) => { const d = await r.json() as { account: Relationship; contact: Contact | null; error?: string }; if(!active)return;if (!r.ok) throw Error(d.error);loadedAccount.current=accountId;currentSaved.current={account:d.account,contact:d.contact};const recovered=takeHistoryDraft<RelationshipHistoryDraft>(historyKey);baseline.current=recovered?.baseline||{account:d.account,contact:d.contact};setAccount(recovered?.account||d.account);setContact(recovered?recovered.contact:d.contact);if(recovered){setHandoffId(recovered.handoffId);const changed=JSON.stringify(recovered.baseline)!==JSON.stringify({account:d.account,contact:d.contact});setRecoveryBlocked(changed);setNotice(changed?'Recovered relationship entries. The saved record changed; copy your entries before reopening this company.':'Recovered your unsaved relationship entries after browser navigation.');} }),
    fetch(`/api/inquiries?accountId=${encodeURIComponent(accountId)}`).then(async (r) => { const d = await r.json() as { inquiries: Inquiry[]; error?: string }; if(!active)return;if (!r.ok) throw Error(d.error); setInquiries(d.inquiries); }),
  ]).catch((e) => {if(active)setError(e.message);});return()=>{active=false;}; }, [accountId]);
  async function save(e: FormEvent) {
    e.preventDefault(); if (!account||recoveryBlocked) return; const finishHistorySave=beginHistorySave(historyKey);setSaving(true); setError(""); setNotice("");
    const scope=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('name')==='qualify';
    try {
      const r = await fetch(`/api/clients/${accountId}/relationship`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...account, ...(scope&&!['won','proposal'].includes(account.salesStage)?{salesStage:'qualified'}:{}), marketingStatus: contact?.marketingStatus || "unknown", marketingEvidence: contact?.marketingEvidence || "" }) });
      const d = await r.json() as { error?: string; account: Relationship & { relationshipType: string }; contact: Contact | null };
      if (!r.ok) throw Error(d.error);baseline.current={account:d.account,contact:d.contact};currentSaved.current=baseline.current;setAccount(d.account);setContact(d.contact);finishHistorySave(true);onDirty?.(false); onRelationshipChange?.(d.account.relationshipType);
      setNotice(account.salesStage === "won" ? "Saved as a client. Choose Onboarding plan when you are ready to begin delivery; no services or automations were created." : "Relationship and contact preferences saved.");
      if(scope){const selected=inquiries.find(i=>i.id===handoffId&&i.status!=='closed');if(selected)await handoff(selected);onScope?.();}
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save relationship."); } finally { finishHistorySave(false);setSaving(false); }
  }
  return <section className="panel relationship-panel"><div className="panelhead"><div><small>{(currentSaved.current?.account.organizationKind||account?.organizationKind) === "internal" ? "INTERNAL OPERATIONS" : "SALES & FOLLOW-UP"}</small><h2>{(currentSaved.current?.account.organizationKind||account?.organizationKind) === "internal" ? "Bearagon’s own workspace" : "Review inquiry & follow-up"}</h2></div></div>
    <div className="relationship-body">{error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="intake-notice">{notice}</p>}{recoveryBlocked&&<><RecoveredDraft text={recoveryText({account,contact,handoffId})}/><Button variant="outline" onClick={()=>{if(currentSaved.current&&window.confirm('Discard recovered relationship entries and use the latest loaded record?')){clearHistoryDraft(historyKey);baseline.current=currentSaved.current;setAccount(currentSaved.current.account);setContact(currentSaved.current.contact);setHandoffId('');setRecoveryBlocked(false);setNotice('Loaded saved relationship.');}}}>Discard recovered entries</Button></>}
    {!account && !error && <p>Loading relationship…</p>}
    {(currentSaved.current?.account.organizationKind||account?.organizationKind) === "internal" ? <p>Track Bearagon’s services and automations in the same workspace as client delivery. This organization is excluded from the external account directory and sales pipeline. There is no customer contract or marketing audience implied.</p> : account && <form onSubmit={save}><fieldset disabled={saving||recoveryBlocked} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="form-grid">
      <label>Relationship stage<select value={account.salesStage} onChange={(e) => setAccount({ ...account, salesStage: e.target.value })}>{["new", "contacted", "qualified", "proposal", "won", "lost", "nurture"].map((s) => <option value={s} key={s}>{s === "won" ? "Won · client" : s[0].toUpperCase() + s.slice(1)}</option>)}</select></label>
      <label>Bearagon owner<OwnerSelect value={account.relationshipOwner} onChange={(value) => setAccount({ ...account, relationshipOwner: value })}/></label><label>What do they need / next conversation<Input maxLength={500} value={account.relationshipNextAction} onChange={(e) => setAccount({ ...account, relationshipNextAction: e.target.value })}/></label><label>Follow-up due<Input type="date" value={account.followUpDate} onChange={(e) => setAccount({ ...account, followUpDate: e.target.value })}/></label>
      {contact && <><label className="intake-wide">Marketing preference · {contact.displayName}<select value={contact.marketingStatus} onChange={(e) => setContact({ ...contact, marketingStatus: e.target.value })}><option value="unknown">Unknown · do not enroll</option><option value="subscribed">Subscribed · permission recorded</option><option value="unsubscribed">Unsubscribed · suppress marketing</option></select></label><label className="intake-wide">Permission source and date / preference note<Textarea required={contact.marketingStatus === "subscribed"} maxLength={2000} value={contact.marketingEvidence} onChange={(e) => setContact({ ...contact, marketingEvidence: e.target.value })}/></label></>}
    </div><p className="relationship-help">Sales stage is separate from delivery. Marking won does not accept a quote or send a campaign. Contact marketing preferences apply across linked companies.</p>
    {!ongoing&&onScope&&inquiries.some(i=>i.status!=='closed')&&<label>Inquiry handoff<select value={handoffId} onChange={e=>setHandoffId(e.target.value)}><option value="">Keep open — a response or follow-up is still needed</option>{inquiries.filter(i=>i.status!=='closed').map(i=><option key={i.id} value={i.id}>Resolve this intake: {i.summary.slice(0,90)}</option>)}</select><small>Only the selected inquiry closes when you qualify. Other conversations stay open.</small></label>}
    <div className="company-actions"><Button disabled={saving}>{saving ? "Saving…" : "Save relationship"}</Button>{onScope&&!ongoing&&<Button name="qualify" type="submit" disabled={saving}>Qualify & scope services →</Button>}</div></fieldset></form>}
    {inquiries.length > 0 && <div className="relationship-inquiries"><h3>Inquiry history</h3>{inquiries.map((i) => <article key={i.id}><span><b>{i.source}</b> · {i.status}</span><p>{i.summary}</p><small>{i.status==='closed'?i.resolution:i.owner || "Unassigned"} · {i.status==='closed'?'Intake resolved':i.nextAction || "No next action"}</small><div className="company-actions"><Link href={`/communications?inquiry=${encodeURIComponent(i.id)}`}>Review inquiry →</Link>{ongoing&&i.status!=='closed'&&<Button variant="outline" disabled={saving} onClick={async()=>{setSaving(true);setError('');try{await handoff(i);setNotice('Selected intake resolved. Other inquiries are unchanged.');}catch(e){setError((e as Error).message);}finally{setSaving(false);}}}>Resolve completed intake</Button>}</div>{ongoing&&i.status!=='closed'&&<p className="company-help">Onboarding is complete. Resolve this intake only if no response is still owed.</p>}</article>)}</div>}
    </div></section>;
}
