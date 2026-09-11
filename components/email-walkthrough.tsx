"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { emailDefaults, emailConfigIssues, emailGuideVersion, supportedEmailGuide, usesCodex, buildEmailBrief, roster, type EmailConfig, type EmailUpdate, type StepProgress } from '@/lib/email-playbook';
import type { ProposalState } from '@/lib/proposal-model';

type Payload = { proposal: ProposalState; closed?: boolean; archived?: boolean; error?: string };
type Entry = Pick<StepProgress, 'status' | 'notes' | 'evidence' | 'blocker'>;
const blank: Entry = { status: 'in_progress', notes: '', evidence: '', blocker: '' };
const statusLabel = (s?: string) => s === 'completed' ? 'Completed' : s === 'blocked' ? 'Blocked' : s === 'in_progress' ? 'In progress' : 'Not started';
const entryFrom = (p?: StepProgress): Entry => p ? { status:p.status, notes:p.notes, evidence:p.evidence, blocker:p.blocker } : { ...blank };

export function EmailWalkthrough({accountId,initialData,initialStep='configuration'}:{accountId:string;initialData?:Payload;initialStep?:string}) {
  const initialRun=initialData?.proposal.orders.find(o=>o.key==='email')?.emailRun;
  const initialConfig=initialRun?.config||(initialData?emailDefaults(initialData.proposal.draft):null);
  const initialEntry=entryFrom(initialRun?.progress[initialStep]);
  const [data,setData]=useState<Payload|null>(initialData||null),[config,setConfig]=useState<EmailConfig|null>(initialConfig);
  const [active,setActive]=useState(initialStep),[entry,setEntry]=useState<Entry>(initialEntry);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[conflict,setConflict]=useState(false);
  const [draftBase,setDraftBase]=useState(JSON.stringify(initialConfig)),[entryBase,setEntryBase]=useState(JSON.stringify(initialEntry));
  const [revalidate,setRevalidate]=useState(false),[compare,setCompare]=useState(false);
  const heading=useRef<HTMLHeadingElement>(null);
  const proposal=data?.proposal, order=proposal?.orders.find(o=>o.key==='email'), run=order?.emailRun;
  const dirty=active==='configuration'?!!config&&JSON.stringify(config)!==draftBase:JSON.stringify(entry)!==entryBase;
  const readOnly=!!data?.closed||!!data?.archived||!!run&&!supportedEmailGuide(run.version);
  const steps=run?.steps||[],current=steps.find(s=>s.id===active),index=steps.findIndex(s=>s.id===active);
  const prerequisites=steps.slice(0,index).filter(s=>run?.progress[s.id]?.status!=='completed');
  const configIssues=run?emailConfigIssues(run.config):[];
  const completed=steps.filter(s=>run?.progress[s.id]?.status==='completed').length;
  const changedFields=config&&run?(Object.keys(config) as (keyof EmailConfig)[]).filter(k=>config[k]!==run.config[k]):[];
  const guideUpgrade=!!run&&run.version!==emailGuideVersion&&supportedEmailGuide(run.version);
  const technicalChange=changedFields.some(k=>k!=='owner')||guideUpgrade;
  const needsReset=!!run&&technicalChange&&(Object.keys(run.progress).length>0||order?.status!=='to_build');

  function show(p:Payload, target:string) {
    const r=p.proposal.orders.find(o=>o.key==='email')?.emailRun;
    const c=r?.config||emailDefaults(p.proposal.draft);setConfig({...c});setDraftBase(JSON.stringify(c));
    const e=entryFrom(r?.progress[target]);setEntry(e);setEntryBase(JSON.stringify(e));setActive(target);setRevalidate(false);
  }
  async function load(preserve=false) {
    if(busy)return;setBusy(true);setError('');
    try {const res=await fetch(`/api/clients/${accountId}/proposal`,{cache:'no-store'});const p=await res.json() as Payload;if(!res.ok)throw Error(p.error||'Unable to load walkthrough.');setData(p);
      if(!preserve)show(p,active);else{setCompare(true);setRevalidate(false);setNotice('Latest saved record loaded. Your unsaved fields are retained. Compare the saved values below before saving.');}
      setConflict(false);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  useEffect(()=>{void load();},[accountId]);
  useEffect(()=>{
    const unload=(e:BeforeUnloadEvent)=>{if(dirty||busy){e.preventDefault();e.returnValue='';}};
    const leave=(e:MouseEvent)=>{const a=(e.target as Element)?.closest('a[href]');if(a&&!a.getAttribute('target')&&(busy||dirty&&!window.confirm('Leave without saving these walkthrough edits? Previously saved progress will remain.'))){e.preventDefault();e.stopPropagation();}};
    window.addEventListener('beforeunload',unload);document.addEventListener('click',leave,true);
    return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',leave,true);};
  },[dirty,busy]);
  useEffect(()=>{heading.current?.focus();},[active]);
  function go(id:string){if(busy||!data)return;if(dirty&&!window.confirm('Discard unsaved edits to this step? Saved progress remains available.'))return;show(data,id);setError('');setNotice('');setCompare(false);setConflict(false);}
  async function save(update:EmailUpdate,advance=false) {
    if(!proposal||busy||readOnly||conflict)return;setBusy(true);setError('');setNotice('');
    try{const res=await fetch(`/api/clients/${accountId}/proposal`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'emailPlaybook',key:'email',expectedVersion:proposal.version,emailUpdate:update})});const p=await res.json() as Payload;if(!res.ok){if(res.status===409)setConflict(true);throw Error(p.error||'Unable to save.');}
      const next={...data,...p};setData(next);const target=advance?(update.kind==='configure'?p.proposal.orders.find(o=>o.key==='email')?.emailRun?.steps[0]?.id:steps[index+1]?.id)||active:active;
      show(next,target);setCompare(false);setNotice(update.kind==='configure'?'Configuration saved. Nothing was connected or deployed.':'Progress saved. Build evidence, launch approval and runtime health remain separate.');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const update=(status=entry.status):EmailUpdate=>({kind:'step',stepId:active,...entry,status});
  async function copyBrief(){if(!proposal||!run)return;try{await navigator.clipboard.writeText(buildEmailBrief(proposal.company,run.config));setNotice('Build brief copied. Review it in the selected harness before use.');}catch{setNotice('Clipboard unavailable. Expand the build brief below and copy the text.');}}
  if(!data||!config)return <main className="lane-page"><div className="lane-body"><h1>Email setup walkthrough</h1>{error?<div role="alert">{error}<Button onClick={()=>void load()}>Retry loading</Button></div>:<p role="status">Loading saved scope and progress…</p>}</div></main>;
  if(!proposal?.acceptance||!order)return <main className="lane-page"><div className="lane-body"><h1>Email assistance is not ordered yet</h1><p>Establish and accept an Email assistance scope, or authorize Bearagon’s internal plan, before starting this walkthrough.</p><Link className="walkthrough-back" href={`/clients/${accountId}?tab=services`}>Return to service package</Link></div></main>;
  return <main className="email-walkthrough">
    <header className="walkthrough-heading"><Link href={`/clients/${accountId}?tab=delivery`}>← {proposal.company} · {proposal.internal?'Automation work':'Build & test'}</Link><div><div><small className="eyebrow">GUIDED IMPLEMENTATION</small><h1>Email assistance</h1></div><span className="walkthrough-count">{completed} / {steps.length||6} steps recorded</span></div><p>Follow the saved route. Build in the harness. Keep evidence for the next person.</p><progress aria-label="Recorded walkthrough progress" value={completed} max={steps.length||6}/></header>
    {readOnly&&<div className="company-notice">{data.archived?'This company is archived. Its walkthrough is retained as read-only history.':data.closed?'This delivery is closed. Its walkthrough is retained as read-only history.':'This walkthrough uses a previous guide version and is read-only. Its instructions and evidence have been preserved.'}</div>}
    {notice&&<p className="walkthrough-notice" role="status">{notice}</p>}
    {error&&<div role="alert" className="company-error">{error} Your fields are still here. <Button variant="outline" disabled={busy} onClick={()=>void load(true)}>Load latest without clearing my fields</Button></div>}
    <div className="walkthrough-layout"><aside className="walkthrough-rail" aria-label="Email walkthrough steps"><Button variant={active==='configuration'?'default':'outline'} disabled={busy} onClick={()=>go('configuration')}>Configuration <small>{run?'Saved':'Start here'}</small></Button>{steps.map((s,i)=><Button key={s.id} variant={active===s.id?'default':'outline'} aria-current={active===s.id?'step':undefined} disabled={busy} onClick={()=>go(s.id)}><span>{i+1}. {s.title}</span><small>{statusLabel(run?.progress[s.id]?.status)}</small></Button>)}<p>Owner: {run?.config.owner||'Not assigned'}<br/>Guide: {run?.version||emailGuideVersion}</p><p>Guide steward: Bearagon delivery team<br/>Provider references checked September 11, 2026. Field validation by the team is still needed.</p></aside>
      <section className="walkthrough-main"><div className="walkthrough-section-title"><h2 ref={heading} tabIndex={-1}>{active==='configuration'?'Confirm the implementation route':current?.title}</h2><span>{dirty?'Unsaved edits':`Saved record v${proposal.version}`}</span></div>
        {active==='configuration'?<form onSubmit={e=>{e.preventDefault();void save({kind:'configure',config,confirmReset:revalidate},true);}}>
          <p>Scope information is prefilled where available. Complete the remaining details, or save and come back. These answers do not change accepted commercial scope.</p>
          {guideUpgrade&&<p className="walkthrough-prerequisites">A newer guide includes the Codex delivery route. Your saved instructions remain unchanged until you save configuration; that save upgrades the guide and requires revalidation of recorded work.</p>}
          <fieldset disabled={busy||readOnly}><div className="walkthrough-fields">
            <label>Email provider<select value={config.provider} onChange={e=>setConfig({...config,provider:e.target.value as EmailConfig['provider']})}><option value="">Choose provider</option><option value="google">Google Workspace / Gmail</option><option value="microsoft">Microsoft 365 / Outlook</option></select></label>
            <label>Mailbox arrangement<select value={config.mailboxType} onChange={e=>setConfig({...config,mailboxType:e.target.value as EmailConfig['mailboxType']})}><option value="">Choose arrangement</option><option value="individual">Individual mailbox(es)</option><option value="shared">Shared / delegated mailbox</option></select></label>
            <label>Bearagon delivery owner<select value={config.owner} onChange={e=>setConfig({...config,owner:e.target.value})}><option value="">Assign an owner</option>{roster.map(n=><option key={n}>{n}</option>)}</select></label>
            <label>Reply authority<select value={config.mode} onChange={e=>setConfig({...config,mode:e.target.value as EmailConfig['mode']})}><option value="draft">Draft for human review</option><option value="auto" disabled={proposal.draft.services.email?.config.mode!=='Approved narrow auto-replies'}>Approved narrow auto-replies</option></select></label>
            <label className="walkthrough-wide">Mailbox names / users / expected volume<Textarea value={config.mailboxes} maxLength={2000} onChange={e=>setConfig({...config,mailboxes:e.target.value})}/></label>
            <label className="walkthrough-wide">Harness, connector and setup approach<Input value={config.harness} maxLength={2000} placeholder="Codex — add the approved mailbox connection details" onChange={e=>setConfig({...config,harness:e.target.value})}/><small>Codex is Bearagon’s preferred harness. Keep the name at the start (for example, Codex — Gmail) to use its guided route. Saved alternatives are preserved.</small></label>
            {usesCodex(config)&&<div className="walkthrough-success walkthrough-wide"><b>Codex-led delivery</b><p>The guide covers the company project, mailbox identity and plugin checks, a copyable Codex task prompt, synthetic tests, and a separately verified recurring runtime. It does not assume a shared mailbox or unattended schedule works merely because a plugin is installed.</p></div>}
            <label className="walkthrough-wide">Human reply reviewer & fallback contact<Input value={config.reviewer} maxLength={2000} onChange={e=>setConfig({...config,reviewer:e.target.value})}/></label>
            <label className="walkthrough-wide">Routing, reply tone, exclusions & fallback<Textarea rows={5} value={config.rules} maxLength={2000} onChange={e=>setConfig({...config,rules:e.target.value})}/></label>
          </div><p className="company-help">Mixed ecosystems: this pilot tracks one provider route per email work order. Use a reviewed custom build for mixed-provider installations. No credentials or private message bodies.</p>
          {needsReset&&<div className="walkthrough-prerequisites"><b>Review this configuration change</b><p>Affected walkthrough steps return to In progress; their notes remain. If build evidence is already recorded, this email work order returns to To build and its use approval is withdrawn. Previous build/test references remain in revision history. Other automations are unchanged. No running harness is stopped.</p><label><input type="checkbox" checked={revalidate} onChange={e=>setRevalidate(e.target.checked)}/> I understand this requires revalidation.</label></div>}
          <div className="walkthrough-actions"><Button type="button" variant="outline" disabled={conflict||needsReset&&!revalidate} onClick={()=>void save({kind:'configure',config,confirmReset:revalidate})}>{busy?'Saving…':'Save configuration'}</Button><Button type="submit" disabled={conflict||emailConfigIssues(config).length>0||needsReset&&!revalidate}>Save & open walkthrough</Button></div>
          {emailConfigIssues(config).length>0&&<p className="company-help">Before completing steps: {emailConfigIssues(config).join(' ')}</p>}</fieldset>
        </form>:current&&<>
          {(prerequisites.length>0||configIssues.length>0)&&<div className="walkthrough-prerequisites"><b>You can save notes now. Completion is waiting on:</b>{configIssues.length>0&&<p><Button variant="outline" onClick={()=>go('configuration')}>Complete configuration</Button> {configIssues.join(' ')}</p>}{prerequisites.map(s=><Button key={s.id} variant="outline" onClick={()=>go(s.id)}>{s.title}</Button>)}</div>}
          <p>{current.why}</p><ol className="walkthrough-instructions">{current.instructions.map((line,i)=><li key={i}>{line}</li>)}</ol>{current.links?.map(l=><p key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a></p>)}
          <div className="walkthrough-success"><b>What to record</b><p>{current.success}</p></div>
          <form onSubmit={e=>{e.preventDefault();void save(update());}}><fieldset disabled={busy||readOnly}>
            <label>Progress<select value={entry.status} onChange={e=>setEntry({...entry,status:e.target.value as Entry['status']})}><option value="pending">Not started</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="completed" disabled={prerequisites.length>0||configIssues.length>0}>Completed — evidence recorded</option></select></label>
            <label>Work notes<Textarea rows={5} maxLength={4000} value={entry.notes} onChange={e=>setEntry({...entry,notes:e.target.value})}/></label>
            <label>Observed result / evidence reference<Textarea rows={4} maxLength={4000} value={entry.evidence} onChange={e=>setEntry({...entry,evidence:e.target.value})}/><small>Use a restricted document, workflow ID or test result reference. Do not paste secrets or customer messages.</small></label>
            {entry.status==='blocked'&&<label>Blocker & next action<Textarea maxLength={4000} value={entry.blocker} onChange={e=>setEntry({...entry,blocker:e.target.value})}/></label>}
            {entry.status!=='blocked'&&entry.blocker&&<details><summary>Retained blocker note</summary><p>{entry.blocker}</p></details>}
            {run?.progress[active]?.recorded&&<p className="company-help">Last saved by {run.progress[active].recorded.name} · {run.progress[active].recorded.at}</p>}
            {entry.status!=='completed'&&steps.slice(index+1).some(s=>run?.progress[s.id]?.status==='completed')&&<p className="walkthrough-prerequisites">Saving this step as unfinished also returns later completed steps to In progress. Their notes and evidence remain available.</p>}
            <div className="walkthrough-actions"><Button type="submit" variant="outline" disabled={conflict||entry.status==='blocked'&&!entry.blocker.trim()||entry.status==='completed'&&(!entry.evidence.trim()||prerequisites.length>0||configIssues.length>0)}>Save progress</Button><Button type="button" disabled={conflict||!entry.evidence.trim()||prerequisites.length>0||configIssues.length>0} onClick={()=>void save(update('completed'),true)}>{index===steps.length-1?'Complete walkthrough step':'Complete step & continue'}</Button></div>
            {error&&<Button type="button" variant="outline" disabled={conflict} onClick={()=>void save(update('in_progress'))}>Save as in progress</Button>}
            {entry.status==='blocked'&&!entry.blocker.trim()&&<p className="company-help">Add the blocker and next action, or choose In progress to save your notes.</p>}
            {prerequisites.length===0&&configIssues.length===0&&!entry.evidence.trim()&&<p className="company-help">Add an observed result or evidence reference to complete this step. Partial notes can be saved at any time.</p>}
          </fieldset></form>
        </>}
        {compare&&<details open className="walkthrough-comparison"><summary>Latest saved values — compare with your unsaved fields above</summary><pre>{JSON.stringify(active==='configuration'?run?.config:run?.progress[active],null,2)||'No saved values yet.'}</pre></details>}
        {steps.length>0&&completed===steps.length&&<div className="walkthrough-success"><h3>Walkthrough recorded. Ready for the delivery review.</h3><p>Your team’s instructions and evidence are saved. This does not mark the automation tested, approve launch or verify runtime health.</p><Link href={`/clients/${accountId}?tab=delivery`}>Return to build & test →</Link></div>}
        <details className="walkthrough-reference"><summary>Accepted scope & shared setup reference</summary><p><b>Scope revision:</b> {proposal.scopeRevision} · <b>Setup revision:</b> {proposal.setup.revision}</p>{Object.entries(proposal.draft.services.email?.config||{}).map(([k,v])=><p key={k}><b>{k}:</b> {v}</p>)}{proposal.setup.answers.map((a,i)=><p key={i}>{a||'Shared setup answer not yet recorded'}</p>)}</details>
        {run&&<details className="walkthrough-reference"><summary>{usesCodex(run.config)?'Copyable Codex task prompt':'Copyable build brief'}</summary><p>Generated from saved configuration. Instructions for a builder—not executable code. Paste into the authorized company project; copying does not start a task.</p><Button variant="outline" onClick={()=>void copyBrief()}>{usesCodex(run.config)?'Copy Codex task prompt':'Copy build brief'}</Button><pre>{buildEmailBrief(proposal.company,run.config)}</pre></details>}
        {run&&Object.keys(run.progress).some(id=>!steps.some(s=>s.id===id))&&<details className="walkthrough-reference"><summary>Retained notes from earlier routes</summary><p>These entries are not counted toward the current route. Configuration changes require revalidation before prior work can be reused.</p>{Object.entries(run.progress).filter(([id])=>!steps.some(s=>s.id===id)).map(([id,p])=><article key={id}><h3>{id.replaceAll('-',' ')}</h3><p>{p.notes}</p><p>{p.evidence}</p>{p.blocker&&<p>{p.blocker}</p>}</article>)}</details>}
      </section>
    </div>
  </main>;
}
