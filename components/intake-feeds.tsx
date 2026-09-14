"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Info, Radio } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
type Review={id:string;reason:string;event:{companyName:string;contactName:string;email:string;phone:string;summary:string;source:string;sourceRef:string}};
type State={configured:boolean;lastSyncedAt:string;lastError:string;reviews:Review[];health:{retellConfigured?:boolean;sources?:{source:string;last_received_at:string;total:number;notification_pending:number}[]}};
export function IntakeFeeds({onReview,onImported}:{onReview:(review:Review)=>void;onImported:()=>void}) {
  const [state,setState]=useState<State|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [showHelp,setShowHelp]=useState(false);
  const syncing=useRef(false),imported=useRef(onImported); imported.current=onImported;
  async function load(){const r=await fetch("/api/intake");const d=await r.json() as State & {error?:string};if(!r.ok)throw Error(d.error||"Unable to read intake status.");setState(d);return d;}
  async function sync(){if(syncing.current)return;syncing.current=true;setBusy(true);setError("");try{const r=await fetch("/api/intake",{method:"POST"});const d=await r.json() as {error?:string;imported?:number};if(!r.ok)throw Error(d.error||"Unable to synchronize.");await load();if(d.imported)imported.current();}catch(e){setError(e instanceof Error?e.message:"Unable to sync intake.");await load().catch(()=>{});}finally{syncing.current=false;setBusy(false);}}
  useEffect(()=>{let stopped=false;load().then((s)=>{if(!stopped&&s.configured)void sync();}).catch((e)=>setError(e.message));const timer=setInterval(()=>{if(document.visibilityState==="visible")void sync();},60000);return()=>{stopped=true;clearInterval(timer);};},[]);
  async function dismiss(review:Review){const reason=window.prompt("Why should this message be dismissed? It will remain in the audit history.");if(!reason?.trim())return;setError("");try{const r=await fetch("/api/intake/review",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:review.id,action:"dismiss",reason})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error);await load();}catch(e){setError(e instanceof Error?e.message:"Unable to dismiss.");}}
  return <><section className="intake-feed-panel inbox-source-panel" aria-label="Inbox source status">
    <div className="intake-feed-heading"><div className="inbox-source-title"><Radio size={20} aria-hidden="true"/><div><small>INBOX STATUS</small><h2>Inbox sources</h2></div>
      <TooltipProvider><Tooltip open={showHelp} onOpenChange={setShowHelp}><TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="How inbox imports work" onClick={()=>setShowHelp(true)}><Info size={17} aria-hidden="true"/></Button>
      </TooltipTrigger><TooltipContent side="bottom" className="inbox-source-help">Imports run when you open this inbox and every minute while it is visible. Messages remain saved at the source while Ops is closed. Sync now checks for new messages immediately.</TooltipContent></Tooltip></TooltipProvider>
    </div><Button type="button" variant="outline" disabled={busy||!state?.configured} onClick={()=>void sync()}>{busy?"Syncing…":"Sync now"}</Button></div>
    {!state&&!error&&<p>Checking saved intake connections…</p>}
    {state&&!state.configured&&<p>Website feed setup is incomplete. You can still record inquiries manually.</p>}
  {(error||state?.lastError)&&<p role="alert" className="form-error">{error||state?.lastError}</p>}
  <div className="intake-feed-status"><span><b>Website</b> {!state?(error?"Status unavailable":"Checking…"):state.configured?(state.lastSyncedAt?"Feed checked":"Awaiting first sync"):"Not connected"}</span><span><b>Retell</b> {!state?(error?"Status unavailable":"Checking…"):state.health.retellConfigured===undefined?"Status unavailable":state.health.retellConfigured?"Receiver configured":"Awaiting agent ID & verification key"}</span><span>Last sync: {!state?"Checking…":state.lastSyncedAt?new Date(state.lastSyncedAt).toLocaleString():"Never"}</span></div>
  {!!state?.health.sources?.length&&<details className="inbox-source-details"><summary>Source details</summary>{state.health.sources.map((s)=><p className="intake-feed-meta" key={s.source}>{s.source}: {s.total} captured · last received {s.last_received_at}{s.notification_pending?` · ${s.notification_pending} email notifications need attention`:""}</p>)}</details>}
  {!!state?.health.sources?.some(s=>s.notification_pending>0)&&<p className="form-error" role="status">Some source notifications need attention. Open Source details to review.</p>}
  </section>
  {!!state?.reviews.length&&<section className="intake-review-list inbox-identity-review" aria-label="Inquiries needing identity review"><h2>Needs identity review <span>{state.reviews.length}</span></h2>{state.reviews.map((r)=><article key={r.id}><div><b>{r.event.companyName||r.event.contactName||"Unidentified caller"}</b><small>{r.event.source} · {r.event.email||r.event.phone||"Contact details missing"}</small><p>{r.event.summary}</p><small>{r.reason}</small></div><div><Button onClick={()=>onReview(r)}>Review & link</Button><Button variant="ghost" onClick={()=>void dismiss(r)}>Dismiss</Button></div></article>)}</section>}
  </>;
}
