"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Button} from './ui/button';
import {Textarea} from './ui/textarea';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from './ui/dialog';
type Pending={id:string;reviewerEmail:string;kind:string;reason:string};
export function CompanyRemoval({accountId,companyName,disabled=false}:{accountId:string;companyName:string;disabled?:boolean}) {
 const [open,setOpen]=useState(false),[pending,setPending]=useState<Pending|null>(null),[reviewers,setReviewers]=useState<string[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [kind,setKind]=useState('test'),[reason,setReason]=useState(''),[reviewer,setReviewer]=useState(''),[requestKey,setRequestKey]=useState('');
 async function load(){setLoading(true);setError('');try{const r=await fetch(`/api/clients/${accountId}/removal`,{cache:'no-store'});const d=await r.json() as {error?:string;id:string;pending:Pending|null;reviewers:string[]};if(!r.ok)throw Error(d.error||'Unable to load removal requests.');setPending(d.pending);setReviewers(d.reviewers);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{void load();},[accountId]);
 async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const r=await fetch(`/api/clients/${accountId}/removal`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,reason,reviewerEmail:reviewer,requestKey})});const d=await r.json() as {error?:string;id:string;pending:Pending|null;reviewers:string[]};if(!r.ok){if(d.id)await load();throw Error(d.error||'Unable to save request.');}setPending({id:d.id,reviewerEmail:reviewer,kind,reason});setOpen(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div className="company-removal-action">{pending?<Link href={`/approvals?request=${encodeURIComponent(pending.id)}`}>Removal awaiting approval →</Link>:<Button variant="ghost" disabled={disabled||loading} onClick={()=>{setRequestKey(crypto.randomUUID());setOpen(true);}}>Mark test / spam</Button>}
 {!open&&error&&<span role="alert">{error} <button onClick={()=>void load()}>Retry</button></span>}
 <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent><DialogHeader><DialogTitle>Request removal of {companyName}</DialogTitle><DialogDescription>A different operator must approve this request. Until then, the company stays in its current workflow.</DialogDescription></DialogHeader><form className="company-removal-form" onSubmit={submit}>
 <label>Classification<select value={kind} disabled={busy} onChange={e=>{setKind(e.target.value);setRequestKey(crypto.randomUUID());}}><option value="test">Test data</option><option value="spam">Spam</option></select></label>
 <label>Reason<Textarea required maxLength={2000} value={reason} disabled={busy} onChange={e=>{setReason(e.target.value);setRequestKey(crypto.randomUUID());}} placeholder="Explain why this company should be removed."/></label>
 <label>Reviewer<select required value={reviewer} disabled={busy} onChange={e=>{setReviewer(e.target.value);setRequestKey(crypto.randomUUID());}}><option value="">Choose another operator</option>{reviewers.map(email=><option key={email} value={email}>{email}</option>)}</select></label>
 {!loading&&!reviewers.length&&<p>No other authorized operator is available. Another operator must have Ops access before this request can be submitted.</p>}
 <p className="company-help">Approval removes this company from active Ops listings. Contacts, scope, delivery evidence and history are retained. Running automations are not stopped by this action.</p>
 {error&&<p role="alert">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy||!reviewer||!reason.trim()}>{busy?'Submitting…':'Request approval'}</Button></DialogFooter>
 </form></DialogContent></Dialog></div>;
}
