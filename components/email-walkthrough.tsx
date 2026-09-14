"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AppShell } from './app-shell';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { emailDefaults, emailConfigIssues, emailGuideVersion, supportedEmailGuide, usesCodex, buildEmailBrief, roster, type EmailConfig, type EmailUpdate } from '@/lib/email-playbook';
import { emailResumeStep, entryFrom, rememberDraft, withoutSavedDraft, type WalkthroughDrafts, type WalkthroughEntry as Entry } from '@/lib/email-walkthrough-state';
import type { ProposalState } from '@/lib/proposal-model';

// Presentation copy applies to existing saved guides without resetting their progress.
const stepObjectives:Record<string,string>={
  authority:'Confirm the mailboxes, permitted actions, responsible reviewer and test arrangement so setup can begin.',
  'connect-microsoft':'Connect the agreed Microsoft 365 mailbox and verify that the required read and draft actions work.',
  'connect-google':'Connect the agreed Google Workspace mailbox and verify that the required read and draft actions work.',
  build:'Prepare a repeatable email triage and draft workflow with clear routing, duplicate handling and an error path.',
  'send-review':'Define and test the approved automatic-reply cases, review fallback and stop controls before activation.',
  'draft-review':'Confirm that generated replies reach the named reviewer and are sent only after human review.',
  test:'Verify normal, excluded and failure cases against expected results, and record the evidence.',
  handoff:'Hand over the verified build, test results, maintenance ownership and monitoring follow-up.'
};

type Payload = { proposal: ProposalState; closed?: boolean; archived?: boolean; error?: string };
const statusLabel = (s?: string) => s === 'completed' ? 'Completed' : s === 'blocked' ? 'Blocked' : s === 'in_progress' ? 'In progress' : 'Not started';

export function EmailWalkthroughWorkspace({accountId}:{accountId:string}) {
  const [internal,setInternal]=useState<boolean|null>(null);
  return <AppShell activeSection={internal===null?'/playbooks':internal?'/operations':'/onboarding'}><EmailWalkthrough accountId={accountId} onContext={setInternal}/></AppShell>;
}

export function EmailWalkthrough({accountId,initialData,initialStep,onContext}:{accountId:string;initialData?:Payload;initialStep?:string;onContext?:(internal:boolean)=>void}) {
  const initialRun=initialData?.proposal.orders.find(o=>o.key==='email')?.emailRun;
  const start=initialStep||emailResumeStep(initialRun,!!initialData?.closed||!!initialData?.archived);
  const initialConfig=initialRun?.config||(initialData?emailDefaults(initialData.proposal.draft):null);
  const initialEntry=entryFrom(initialRun?.progress[start]);
  const [data,setData]=useState<Payload|null>(initialData||null),[config,setConfig]=useState<EmailConfig|null>(initialConfig);
  const [active,setActive]=useState(start),[entry,setEntry]=useState<Entry>(initialEntry);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[conflict,setConflict]=useState(false);
  const [draftBase,setDraftBase]=useState(JSON.stringify(initialConfig)),[entryBase,setEntryBase]=useState(JSON.stringify(initialEntry));
  const [revalidate,setRevalidate]=useState(false),[compare,setCompare]=useState(false);
  const heading=useRef<HTMLHeadingElement>(null);
  const drafts=useRef<WalkthroughDrafts>({entries:{}});
  const proposal=data?.proposal, order=proposal?.orders.find(o=>o.key==='email'), run=order?.emailRun;
  const currentDirty=active==='configuration'?!!config&&JSON.stringify(config)!==draftBase:active!=='summary'&&JSON.stringify(entry)!==entryBase;
  const unsaved=new Set(Object.keys(drafts.current.entries));
  if(drafts.current.configuration)unsaved.add('configuration');
  if(currentDirty)unsaved.add(active);else unsaved.delete(active);
  const dirty=unsaved.size>0;
  const readOnly=!!data?.closed||!!data?.archived||!!run&&!supportedEmailGuide(run.version);
  const steps=run?.steps||[],current=steps.find(s=>s.id===active),index=steps.findIndex(s=>s.id===active);
  const prerequisites=steps.slice(0,index).filter(s=>run?.progress[s.id]?.status!=='completed');
  const configIssues=run?emailConfigIssues(run.config):[];
  const completed=steps.filter(s=>run?.progress[s.id]?.status==='completed').length;
  const changedFields=config&&run?(Object.keys(config) as (keyof EmailConfig)[]).filter(k=>config[k]!==run.config[k]):[];
  const orderContext=proposal?{scopeRevision:proposal.scopeRevision,requirements:proposal.draft.services.email?.config||{},sharedSetup:proposal.setup.answers}:undefined;
  const guideUpgrade=!!run&&run.version!==emailGuideVersion&&supportedEmailGuide(run.version);
  const technicalChange=changedFields.some(k=>k!=='owner')||guideUpgrade;
  const needsReset=!!run&&technicalChange&&(Object.keys(run.progress).length>0||order?.status!=='to_build');

  useEffect(()=>{if(proposal)onContext?.(proposal.internal);},[proposal?.internal,onContext]);

  function rememberCurrent() {
    if(active==='configuration'&&config)drafts.current.configuration=rememberDraft(config,draftBase);
    else if(active!=='summary'){
      const draft=rememberDraft(entry,entryBase);
      if(draft)drafts.current.entries[active]=draft;else delete drafts.current.entries[active];
    }
  }
  function show(p:Payload, target:string) {
    const r=p.proposal.orders.find(o=>o.key==='email')?.emailRun;
    const c=r?.config||emailDefaults(p.proposal.draft),cd=drafts.current.configuration;
    setConfig({...cd?.value||c});setDraftBase(cd?.base||JSON.stringify(c));
    const e=entryFrom(r?.progress[target]),ed=drafts.current.entries[target];
    setEntry({...ed?.value||e});setEntryBase(ed?.base||JSON.stringify(e));setActive(target);setRevalidate(false);
    setCompare(target==='configuration'?!!cd&&cd.base!==JSON.stringify(c):!!ed&&ed.base!==JSON.stringify(e));
  }
  async function load(preserve=false) {
    if(busy)return;setBusy(true);setError('');
    if(preserve)rememberCurrent();
    try {const res=await fetch(`/api/clients/${accountId}/proposal`,{cache:'no-store'});const p=await res.json() as Payload;if(!res.ok)throw Error(p.error||'Unable to load walkthrough.');setData(p);
      show(p,preserve?active:initialStep||emailResumeStep(p.proposal.orders.find(o=>o.key==='email')?.emailRun,!!p.closed||!!p.archived));
      if(preserve){setCompare(true);setNotice('Latest saved record loaded. All unsaved drafts are retained. Compare the saved values below before saving.');}
      setConflict(false);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  useEffect(()=>{void load();},[accountId]);
  useEffect(()=>{
    const unload=(e:BeforeUnloadEvent)=>{if(dirty||busy){e.preventDefault();e.returnValue='';}};
    const leave=(e:MouseEvent)=>{const a=(e.target as Element)?.closest('a[href]');if(a&&!a.getAttribute('target')&&(busy||dirty&&!window.confirm(`Leave without saving ${unsaved.size} walkthrough draft(s)? Unsaved configuration and step notes will be discarded. Previously saved progress will remain.`))){e.preventDefault();e.stopPropagation();}};
    window.addEventListener('beforeunload',unload);document.addEventListener('click',leave,true);
    return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',leave,true);};
  },[dirty,busy,unsaved.size]);
  useEffect(()=>{heading.current?.focus();},[active,!!data]);
  function go(id:string){if(busy||!data)return;rememberCurrent();show(data,id);if(!conflict)setError('');setNotice('');}
  function discardCurrent(){if(busy||!data||!currentDirty||!window.confirm('Discard only this unsaved draft? Other drafts and saved progress will remain.'))return;drafts.current=withoutSavedDraft(drafts.current,active);show(data,active);}
  function discardRetained(id:string){if(busy||!data||!window.confirm('Discard this earlier-route draft? Saved history and other drafts remain.'))return;drafts.current=withoutSavedDraft(drafts.current,id);show(data,active);setNotice('Earlier-route draft discarded.');}
  async function save(update:EmailUpdate,advance=false) {
    if(!proposal||busy||readOnly||conflict)return;rememberCurrent();setBusy(true);setError('');setNotice('');
    try{const res=await fetch(`/api/clients/${accountId}/proposal`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'emailPlaybook',key:'email',expectedVersion:proposal.version,emailUpdate:update})});const p=await res.json() as Payload;if(!res.ok){if(res.status===409)setConflict(true);throw Error(p.error||'Unable to save.');}
      const next={...data,...p};setData(next);drafts.current=withoutSavedDraft(drafts.current,update.kind==='configure'?'configuration':update.stepId);
      const target=advance?emailResumeStep(p.proposal.orders.find(o=>o.key==='email')?.emailRun,!!next.closed||!!next.archived):active;
      show(next,target);setNotice(update.kind==='configure'?'Configuration saved. Nothing was connected or deployed.':'Progress saved. Build evidence, launch approval and runtime health remain separate.');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const update=(status=entry.status):EmailUpdate=>({kind:'step',stepId:active,...entry,status});
  async function copyBrief(){if(!proposal||!run)return;try{await navigator.clipboard.writeText(buildEmailBrief(proposal.company,run.config,orderContext));setNotice('Prompt copied with the saved order and setup details.');}catch{setNotice('Clipboard unavailable. Select and copy the prompt text below.');}}
  if(!data||!config)return <main className="lane-page"><div className="lane-body"><h1>Email setup walkthrough</h1>{error?<div role="alert">{error}<Button onClick={()=>void load()}>Retry loading</Button></div>:<p role="status">Loading saved scope and progress…</p>}</div></main>;
  if(!proposal?.acceptance||!order)return <main className="lane-page"><div className="lane-body"><h1>Email assistance is not ordered yet</h1><p>Establish and accept an Email assistance scope, or authorize Bearagon’s internal plan, before starting this walkthrough.</p><Link className="walkthrough-back" href={`/clients/${accountId}?tab=services`}>Return to service package</Link></div></main>;
  return <main className="email-walkthrough">
    <header className="walkthrough-heading">
      <Link href={`/clients/${accountId}?tab=delivery`}>← {proposal.company} · {proposal.internal?'Automation work':'Build & test'}</Link>
      <div>
        <div>
          <small className="eyebrow">GUIDED IMPLEMENTATION</small>
          <h1>Email assistance</h1>
        </div>
        <span className="walkthrough-count">{completed} / {steps.length||3} steps recorded</span>
      </div>

      <progress aria-label="Recorded walkthrough progress" value={completed} max={steps.length||3}/>
    </header>

    {readOnly&&<div className="company-notice">{data.archived?'This company is archived. Its walkthrough is retained as read-only history.':data.closed?'This delivery is closed. Its walkthrough is retained as read-only history.':'This walkthrough uses a previous guide version and is read-only. Its instructions and evidence have been preserved.'}</div>}
    {guideUpgrade&&!readOnly&&active!=='configuration'&&<div className="walkthrough-notice">
      <b>A shorter email guide is available.</b> Use the order → create and briefly test → schedule and verify. Your saved notes stay available.
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={()=>go('configuration')}>Review guide update</Button>
    </div>}
    {notice&&<p className="walkthrough-notice" role="status">{notice}</p>}
    {dirty&&<p className="walkthrough-notice" role="status">{unsaved.size} unsaved draft(s). You can open other steps and return to these notes. Save before leaving this walkthrough.</p>}
    {error&&<div role="alert" className="company-error">{error} Your fields are still here. <Button variant="outline" disabled={busy} onClick={()=>void load(true)}>Load latest without clearing my fields</Button></div>}

    <label className="walkthrough-step-picker">Walkthrough step
      <select value={active} disabled={busy} onChange={e=>go(e.target.value)}>
        <option value="configuration">Setup details{unsaved.has('configuration')?' · Unsaved draft':''}</option>
        {steps.map((s,i)=><option key={s.id} value={s.id}>{i+1}. {s.title} · {unsaved.has(s.id)?'Unsaved draft':statusLabel(run?.progress[s.id]?.status)}</option>)}
        {run&&<option value="summary">Walkthrough review</option>}
      </select>
    </label>
    <div className="walkthrough-layout">
      <aside className="walkthrough-rail" aria-label="Email walkthrough steps">
        <Button
          variant={active==='configuration'?'default':'outline'}
          className={`walkthrough-rail-btn ${active==='configuration'?'is-active':''} ${unsaved.has('configuration')?'has-draft is-dirty':''}`}
          aria-current={active==='configuration'?'step':undefined}
          disabled={busy}
          onClick={()=>go('configuration')}
        >
          <span className="rail-btn-icon" aria-hidden="true">{run ? '✓' : '⚙'}</span>
          <span className="rail-btn-content">
            <span className="rail-btn-title">Setup details</span>
            <small className="rail-btn-sub">{unsaved.has('configuration')?'Unsaved draft':run?'Saved':'Start here'}</small>
          </span>
        </Button>

        {steps.map((s,i)=>(
          <Button
            key={s.id}
            variant={active===s.id?'default':'outline'}
            className={`walkthrough-rail-btn ${active===s.id?'is-active':''} ${unsaved.has(s.id)?'has-draft is-dirty':''} ${run?.progress[s.id]?.status==='completed'?'is-completed':''} ${run?.progress[s.id]?.status==='blocked'?'is-blocked':''}`}
            aria-current={active===s.id?'step':undefined}
            disabled={busy}
            onClick={()=>go(s.id)}
          >
            <span className="rail-btn-icon" aria-hidden="true">{run?.progress[s.id]?.status==='completed' ? '✓' : run?.progress[s.id]?.status==='blocked' ? '!' : (i+1)}</span>
            <span className="rail-btn-content">
              <span className="rail-btn-title">{s.title}</span>
              <small className="rail-btn-sub">{unsaved.has(s.id)?'Unsaved draft':statusLabel(run?.progress[s.id]?.status)}</small>
            </span>
          </Button>
        ))}

        {run&&<Button
          variant={active==='summary'?'default':'outline'}
          className={`walkthrough-rail-btn ${active==='summary'?'is-active':''}`}
          aria-current={active==='summary'?'step':undefined}
          disabled={busy}
          onClick={()=>go('summary')}
        >
          <span className="rail-btn-icon" aria-hidden="true">📋</span>
          <span className="rail-btn-content">
            <span className="rail-btn-title">Walkthrough review</span>
            <small className="rail-btn-sub">{completed} / {steps.length} recorded</small>
          </span>
        </Button>}


      </aside>

      <section className="walkthrough-main">
        <div className="walkthrough-section-title">
          <h2 ref={heading} tabIndex={-1}>{active==='configuration'?'Setup details for this order':active==='summary'?'Review recorded walkthrough':current?.title}</h2>
          <div className="walkthrough-record-status">
            <span>{currentDirty?'Unsaved edits':`Saved record v${proposal.version}`}</span>
            {currentDirty&&<Button variant="outline" size="sm" disabled={busy} onClick={discardCurrent}>Discard this draft</Button>}
          </div>
        </div>

        {active==='configuration'?<form onSubmit={e=>{e.preventDefault();void save({kind:'configure',config,confirmReset:revalidate},true);}}>
          <p className="walkthrough-intro-text">The order supplies the agreed requirements. Fill in any missing delivery details here; Ops uses the saved values in your copyable prompt.</p>
          {guideUpgrade&&<p className="walkthrough-prerequisites">Saving switches to the three-step guide: use the order, create and briefly test, then schedule and verify. Earlier notes and evidence stay available; completed work needs revalidation against the new steps.</p>}
          <fieldset disabled={busy||readOnly}>
            <div className="walkthrough-fields">
              <label>Email provider
                <select value={config.provider} onChange={e=>setConfig({...config,provider:e.target.value as EmailConfig['provider']})}>
                  <option value="">Choose provider</option>
                  <option value="google">Google Workspace / Gmail</option>
                  <option value="microsoft">Microsoft 365 / Outlook</option>
                </select>
              </label>
              <label>Mailbox arrangement
                <select value={config.mailboxType} onChange={e=>setConfig({...config,mailboxType:e.target.value as EmailConfig['mailboxType']})}>
                  <option value="">Choose arrangement</option>
                  <option value="individual">Individual mailbox(es)</option>
                  <option value="shared">Shared / delegated mailbox</option>
                </select>
              </label>
              <label>Bearagon delivery owner
                <select value={config.owner} onChange={e=>setConfig({...config,owner:e.target.value})}>
                  <option value="">Assign an owner</option>
                  {roster.map(n=><option key={n}>{n}</option>)}
                </select>
              </label>
              <label>Reply authority
                <select value={config.mode} onChange={e=>setConfig({...config,mode:e.target.value as EmailConfig['mode']})}>
                  <option value="draft">Draft for human review</option>
                  <option value="auto" disabled={proposal.draft.services.email?.config.mode!=='Approved narrow auto-replies'}>Approved narrow auto-replies</option>
                </select>
              </label>
              <label className="walkthrough-wide">Mailbox names / users / expected volume
                <Textarea value={config.mailboxes} maxLength={2000} onChange={e=>setConfig({...config,mailboxes:e.target.value})}/>
              </label>
              <label className="walkthrough-wide">AI tool and mailbox connection
                <Input value={config.harness} maxLength={2000} placeholder="Codex — Gmail, for example" onChange={e=>setConfig({...config,harness:e.target.value})}/>
                <small>Use the tool selected for this company. Saved choices are preserved.</small>
              </label>
              <label className="walkthrough-wide">Human reply reviewer & fallback contact
                <Input value={config.reviewer} maxLength={2000} onChange={e=>setConfig({...config,reviewer:e.target.value})}/>
              </label>
              <label className="walkthrough-wide">Routing, reply tone, exclusions & fallback
                <Textarea rows={5} value={config.rules} maxLength={2000} onChange={e=>setConfig({...config,rules:e.target.value})}/>
              </label>
            </div>
            <details className="walkthrough-reference"><summary>Connection help</summary><p>This guide tracks one email provider per order. For a mixed-provider setup or an unsupported shared mailbox, ask the delivery owner for the appropriate connection. Keep credentials in the connection settings, not these fields.</p></details>
            {needsReset&&<div className="walkthrough-prerequisites">
              <b>Review this configuration change</b>
              <p>Affected walkthrough steps return to In progress; their notes remain. If build evidence is already recorded, this email work order returns to To build and its use approval is withdrawn. Previous build/test references remain in revision history. Other automations are unchanged. No running harness is stopped.</p>
              <label><input type="checkbox" checked={revalidate} onChange={e=>setRevalidate(e.target.checked)}/> I understand this requires revalidation.</label>
            </div>}
            <div className="walkthrough-actions">
              <div className="walkthrough-actions-left">
                <Button type="button" variant="outline" className="walkthrough-btn-secondary" disabled={conflict||needsReset&&!revalidate} onClick={()=>void save({kind:'configure',config,confirmReset:revalidate})}>
                  {busy?'Saving…':'Save configuration'}
                </Button>
              </div>
              <div className="walkthrough-actions-right">
                <Button type="submit" variant="default" className="walkthrough-btn-primary" disabled={conflict||emailConfigIssues(config).length>0||needsReset&&!revalidate}>
                  Save & open walkthrough →
                </Button>
              </div>
            </div>
            {emailConfigIssues(config).length>0&&<p className="company-help">Before completing steps: {emailConfigIssues(config).join(' ')}</p>}
          </fieldset>
        </form>:current&&<>
          {(prerequisites.length>0||configIssues.length>0)&&<div className="walkthrough-prerequisites">
            <b>You can save notes now. Completion is waiting on:</b>
            {configIssues.length>0&&<p><Button variant="outline" size="sm" onClick={()=>go('configuration')}>Complete setup details</Button> {configIssues.join(' ')}</p>}
            {prerequisites.map(s=><Button key={s.id} variant="outline" size="sm" onClick={()=>go(s.id)}>{s.title}</Button>)}
          </div>}

          <div className="walkthrough-step-context">
            <div className="walkthrough-step-why">
              <span className="context-label">OBJECTIVE</span>
              <p>{(run?.version===emailGuideVersion?current.why:stepObjectives[current.id]) || current.why}</p>
            </div>
            <div className="walkthrough-step-instructions">
              <span className="context-label">WHAT TO DO</span>
              <ol className="walkthrough-instructions">
                {current.instructions.map((line,i)=><li key={i}>{line}</li>)}
              </ol>
              {current.links?.map(l=><p key={l.url}><a className="walkthrough-ext-link" href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a></p>)}
            </div>
            {current.id==='authority'&&run?.version===emailGuideVersion&&<div className="walkthrough-order-reference">
              <b>Your saved order</b>
              <p>{proposal.company} · Order revision {proposal.scopeRevision}</p>
              <p><b>Mailbox:</b> {run.config.mailboxes||'Add in Setup details'}<br/><b>Reviewer:</b> {run.config.reviewer||'Add in Setup details'}<br/><b>AI tool:</b> {run.config.harness}</p>
              <details><summary>Email requirements and shared setup</summary>
                {Object.entries(orderContext?.requirements||{}).map(([key,value])=><p key={key}><b>{key}:</b> {value}</p>)}
                {orderContext?.sharedSetup.filter(Boolean).map((answer,i)=><p key={i}>{answer}</p>)}
              </details>
            </div>}
            {current.id==='build'&&run&&<div className="walkthrough-prompt">
              <div className="walkthrough-prompt-heading"><b>Your build prompt</b><Button type="button" variant="outline" size="sm" onClick={()=>void copyBrief()}>Copy prompt</Button></div>
              <p>Includes the saved order and setup details. Paste into the company’s {run.config.harness||'AI'} task.</p>
              <pre tabIndex={0} aria-label="Email automation prompt" className="walkthrough-code-block">{buildEmailBrief(proposal.company,run.config,orderContext)}</pre>
            </div>}
            {!!current.help?.length&&<details className="walkthrough-reference"><summary>If you need help</summary><ul>{current.help.map((line,i)=><li key={i}>{line}</li>)}</ul></details>}
            <div className="walkthrough-success">
              <span className="context-label">WHAT TO RECORD</span>
              <p>{current.success}</p>
            </div>
          </div>

          <form onSubmit={e=>{e.preventDefault();void save(update());}}>
            <fieldset disabled={busy||readOnly}>
              <label>Progress
                <select value={entry.status} onChange={e=>setEntry({...entry,status:e.target.value as Entry['status']})}>
                  <option value="pending">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="completed" disabled={prerequisites.length>0||configIssues.length>0}>Completed — evidence recorded</option>
                </select>
              </label>
              <label>Work notes
                <Textarea rows={2} maxLength={4000} value={entry.notes} placeholder="A short note on what you did or what needs attention..." onChange={e=>setEntry({...entry,notes:e.target.value})}/>
              </label>
              <label>Observed result / evidence reference
                <Textarea rows={2} maxLength={4000} value={entry.evidence} placeholder="e.g. Test message ID, run log reference, or document link..." onChange={e=>setEntry({...entry,evidence:e.target.value})}/>
                <small>Use a restricted document, workflow ID or test result reference. Do not paste secrets or customer messages.</small>
              </label>
              {entry.status==='blocked'&&<label>Blocker & next action
                <Textarea maxLength={4000} value={entry.blocker} placeholder="Explain what is blocking progress, who owns resolving it, and the next action..." onChange={e=>setEntry({...entry,blocker:e.target.value})}/>
              </label>}
              {entry.status!=='blocked'&&entry.blocker&&<details><summary>Retained blocker note</summary><p>{entry.blocker}</p></details>}
              {run?.progress[active]?.recorded&&<p className="company-help">Last saved by {run.progress[active].recorded.name} · {run.progress[active].recorded.at}</p>}
              {entry.status!=='completed'&&steps.slice(index+1).some(s=>run?.progress[s.id]?.status==='completed')&&<p className="walkthrough-prerequisites">Saving this step as unfinished also returns later completed steps to In progress. Their notes and evidence remain available.</p>}
              <div className="walkthrough-actions">
                <div className="walkthrough-actions-left">
                  <Button type="submit" variant="outline" className="walkthrough-btn-secondary" disabled={conflict||entry.status==='blocked'&&!entry.blocker.trim()||entry.status==='completed'&&(!entry.evidence.trim()||prerequisites.length>0||configIssues.length>0)}>
                    Save progress
                  </Button>
                  {error&&<Button type="button" variant="outline" disabled={conflict} onClick={()=>void save(update('in_progress'))}>Save as in progress</Button>}
                </div>
                <div className="walkthrough-actions-right">
                  <Button type="button" variant="outline" className="walkthrough-btn-secondary" onClick={()=>go(index>0?steps[index-1].id:'configuration')}>Back</Button>
                  <Button type="button" variant="default" className="walkthrough-btn-primary" disabled={conflict||!entry.evidence.trim()||prerequisites.length>0||configIssues.length>0} onClick={()=>void save(update('completed'),true)}>
                    {index===steps.length-1?'Complete walkthrough step':'Complete step & continue →'}
                  </Button>
                </div>
              </div>
              {entry.status==='blocked'&&!entry.blocker.trim()&&<p className="company-help">Add the blocker and next action, or choose In progress to save your notes.</p>}
              {prerequisites.length===0&&configIssues.length===0&&!entry.evidence.trim()&&<p className="company-help">Add an observed result or evidence reference to complete this step. Partial notes can be saved at any time.</p>}
            </fieldset>
          </form>
        </>}

        {Object.entries(drafts.current.entries).filter(([id])=>!steps.some(s=>s.id===id)).map(([id,draft])=><details className="walkthrough-reference walkthrough-retained-card" key={id} open>
          <summary>Unsaved draft from an earlier route: {id}</summary>
          <div className="retained-fields">
            <p>This step is outside the saved route. Keep a copy of these notes or return to its configuration before saving.</p>
            <pre className="walkthrough-code-block">{JSON.stringify(draft.value,null,2)}</pre>
            <Button variant="outline" size="sm" disabled={busy} onClick={()=>discardRetained(id)}>Discard this earlier-route draft</Button>
          </div>
        </details>)}

        {compare&&<details open className="walkthrough-comparison">
          <summary>Latest saved values — compare with your unsaved fields above</summary>
          <pre className="walkthrough-code-block">{JSON.stringify(active==='configuration'?run?.config:run?.progress[active],null,2)||'No saved values yet.'}</pre>
        </details>}

        {active==='summary'&&<section className="walkthrough-success">
          <h3>{completed===steps.length&&steps.length>0?'Walkthrough recorded. Ready for the delivery review.':'Saved walkthrough progress'}</h3>
          <p>{completed} of {steps.length} steps have completed evidence. Walkthrough progress does not approve launch or verify runtime health.</p>
          <ul>{steps.map(s=><li key={s.id}>{s.title}: {statusLabel(run?.progress[s.id]?.status)}</li>)}</ul>
          <Link href={`/clients/${accountId}?tab=delivery`}>Return to {proposal.internal?'automation work':'build & test'} →</Link>
        </section>}

        {active!=='summary'&&steps.length>0&&completed===steps.length&&<div className="walkthrough-success">
          <h3>Walkthrough recorded. Ready for the delivery review.</h3>
          <p>Your team’s instructions and evidence are saved. This does not mark the automation tested, approve launch or verify runtime health.</p>
          <Link href={`/clients/${accountId}?tab=delivery`}>Return to build & test →</Link>
        </div>}

        <details className="walkthrough-reference"><summary>Owner & guide details</summary>
          <p>Owner: {run?.config.owner||'Not assigned'}<br/>Guide: {run?.version||emailGuideVersion}</p>
          <small>Guide steward: Bearagon delivery team<br/>The guide records your work; the connected AI tool runs the automation.</small>
        </details>

        <details className="walkthrough-reference">
          <summary>Accepted scope & shared setup reference</summary>
          <p><b>Scope revision:</b> {proposal.scopeRevision} · <b>Setup revision:</b> {proposal.setup.revision}</p>
          {Object.entries(proposal.draft.services.email?.config||{}).map(([k,v])=><p key={k}><b>{k}:</b> {v}</p>)}
          {proposal.setup.answers.map((a,i)=><p key={i}>{a||'Shared setup answer not yet recorded'}</p>)}
        </details>

        {run&&current?.id!=='build'&&<details className="walkthrough-reference">
          <summary>{usesCodex(run.config)?'Copyable Codex task prompt':'Copyable build brief'}</summary>
          <p>Includes the saved order and setup details. Paste into the company’s AI task.</p>
          <Button variant="outline" size="sm" onClick={()=>void copyBrief()}>{usesCodex(run.config)?'Copy Codex task prompt':'Copy build brief'}</Button>
          <pre className="walkthrough-code-block">{buildEmailBrief(proposal.company,run.config,orderContext)}</pre>
        </details>}

        {run&&Object.keys(run.progress).some(id=>!steps.some(s=>s.id===id))&&<details className="walkthrough-reference">
          <summary>Retained notes from earlier routes</summary>
          <p>These entries are not counted toward the current route. Configuration changes require revalidation before prior work can be reused.</p>
          {Object.entries(run.progress).filter(([id])=>!steps.some(s=>s.id===id)).map(([id,p])=><article key={id}><h3>{id.replaceAll('-',' ')}</h3><p>{p.notes}</p><p>{p.evidence}</p>{p.blocker&&<p>{p.blocker}</p>}</article>)}
        </details>}
      </section>
    </div>
  </main>;
}
