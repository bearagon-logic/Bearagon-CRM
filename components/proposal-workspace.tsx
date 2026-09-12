"use client";
import { scopeStepIssues } from '@/lib/workflow-ux';
import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from './app-shell';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { CustomerQuote } from './customer-quote';
import { WorkOrderEvidenceForm, evidenceChanged } from './work-order-evidence-form';
import {EmailWalkthroughLink} from './email-walkthrough-link';
import { serviceCatalog, ecosystems, customFields, scopedServiceNames, budget, type ScopeDraft, type ServiceId } from '@/lib/proposal-scope';
import { proposalIssues, type ProposalState, type ProposalCommand, type WorkOrder } from '@/lib/proposal-model';

type Payload={proposal:ProposalState;closed?:boolean;history?:{version:number;action:string;actor_email:string;created_at:string}[];actor?:{name:string;email:string};error?:string};
const steps=['Ecosystem','Services','Pricing & limits','Review & approval','Guided setup'];
const questions=[['Success criteria','What should success look like?','Define measurable outcomes and how the client will verify them.'],['Systems & handoff','Which systems, users and handoffs will this use?','List actual mailboxes/users, providers, environments and handoffs. No passwords or API keys.'],['Access & guardrails','Who authorizes access and handles exceptions?','Name the client authority, allowed actions, exclusions, escalation and tested human fallback.']];
const usd=(v:number|null)=>v===null?'Not established':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v/100);

export function ProposalWorkspace({accountId, mode, onSaved, onDirty, onBusy, onDelivery, onScope, children, setupOnly=false}:{accountId:string;mode?:'services'|'delivery';onSaved?:(p:ProposalState)=>void;onDirty?:(dirty:boolean)=>void;onBusy?:(busy:boolean)=>void;onDelivery?:()=>void;onScope?:()=>void;children?:React.ReactNode;setupOnly?:boolean}) {
  const query=useSearchParams();
  const [data,setData]=useState<Payload|null>(null),[draft,setDraft]=useState<ScopeDraft|null>(null),[answers,setAnswers]=useState<string[]>(['','','']);
  const [step,setStep]=useState(mode==='delivery'||query.get('step')==='setup'?4:query.get('step')==='review'?3:0),[setupStep,setSetupStep]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [reference,setReference]=useState(''),[contact,setContact]=useState(''),[date,setDate]=useState(''),[confirmed,setConfirmed]=useState(false),[order,setOrder]=useState<WorkOrder|null>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  const [editingSetup,setEditingSetup]=useState(false),[resetReview,setResetReview]=useState(false);
  const validationRef=useRef<HTMLDivElement>(null);
  const [stepErrors,setStepErrors]=useState<string[]>([]);
  async function saveSetup(){if(await act({action:'setup',answers,confirmReset:true})){setResetReview(false);if(setupStep<2)setSetupStep(setupStep+1);else setEditingSetup(false);}}
  function continueScope(){if(!draft||!proposal)return;const errors=scopeStepIssues(draft,step,proposal.internal);setStepErrors(errors);if(errors.length){requestAnimationFrame(()=>validationRef.current?.focus());return;}if(accepted)setStep(step===1&&proposal.internal?3:step+1);else void act({action:'save',draft},step===1&&proposal.internal?3:step+1);}
  const [archive,setArchive]=useState<ProposalState|null>(null);
  async function viewRevision(version:number){setBusy(true);setError('');try{const response=await fetch(`/api/clients/${accountId}/proposal?revision=${version}`,{cache:'no-store'});const payload=await response.json() as Payload;if(!response.ok)throw new Error(payload.error);setArchive(payload.proposal);}catch(e){setError(e instanceof Error?e.message:'Unable to load history.');}finally{setBusy(false);}}
  const proposal=data?.proposal;
  const scopeDirty=!!proposal&&!!draft&&JSON.stringify(draft)!==JSON.stringify(proposal.draft);
  const setupDirty=!!proposal&&JSON.stringify(answers)!==JSON.stringify(proposal.setup.answers);
  const savedOrder=proposal?.orders.find(o=>o.key===order?.key);
  const orderDirty=evidenceChanged(order,savedOrder);
  const dirty=scopeDirty||setupDirty||orderDirty;
  function closeEvidence(){if(!busy&&(!orderDirty||window.confirm('Discard unsaved evidence changes? Your previously saved evidence will stay unchanged.'))){setOrder(null);setError('');}}
  const accepted=!!proposal?.acceptance,locked=accepted||busy;
  function apply(payload:Payload){setData(prev=>({...prev,...payload}));setDraft(payload.proposal.draft);setAnswers(payload.proposal.setup.answers);setConfirmed(false);onSaved?.(payload.proposal);}
  async function load(){setBusy(true);setError('');try{const response=await fetch(`/api/clients/${accountId}/proposal`,{cache:'no-store'});const payload=await response.json() as Payload;if(!response.ok)throw new Error(payload.error);apply(payload);}catch(e){setError(e instanceof Error?e.message:'Unable to load proposal.');}finally{setBusy(false);}}
  useEffect(()=>{void load();},[accountId]);
  useEffect(()=>{if(mode==='services'&&query.get('step')==='review')setStep(3);},[query.get('step'),mode]);
  useEffect(()=>{onBusy?.(busy);return()=>onBusy?.(false);},[busy,onBusy]);
  useEffect(()=>{onDirty?.(dirty);},[dirty,onDirty]);
  useEffect(()=>{setNotice('');setStepErrors([]);heading.current?.focus();window.scrollTo({top:0,behavior:'instant'});},[step]);
  useEffect(()=>{
    const unload=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};
    const leave=(event:MouseEvent)=>{const anchor=(event.target as Element)?.closest('a[href]');if(dirty&&anchor&&!window.confirm('Leave this page and discard unsaved changes?')){event.preventDefault();event.stopPropagation();}};
    window.addEventListener('beforeunload',unload);document.addEventListener('click',leave,true);
    return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',leave,true);};
  },[dirty]);
  async function act(command:Omit<ProposalCommand,'expectedVersion'>,nextStep?:number){
    if(!proposal||busy)return;setBusy(true);setError('');setNotice('');
    try{const response=await fetch(`/api/clients/${accountId}/proposal`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...command,expectedVersion:proposal.version})});const payload=await response.json() as Payload;if(!response.ok)throw new Error(payload.error||'Save failed.');apply(payload);setOrder(null);setNotice(command.action==='save'?'Draft saved.':command.action==='setup'?'Setup saved. Work orders reference this revision.':command.action==='approve'?'Saved revision approved for quoting. Nothing was sent.':command.action==='order'?'External evidence recorded. No automation was executed.':'Acceptance recorded. Services and delivery work are ready.');if(nextStep!==undefined){if(mode==='services'&&nextStep===4)onDelivery?.();else setStep(nextStep);}return true;}
    catch(e){setError(e instanceof Error?e.message:'Unable to save.');}finally{setBusy(false);}return false;
  }
  function change<K extends keyof ScopeDraft>(key:K,value:ScopeDraft[K]){if(draft)setDraft({...draft,[key]:value});}
  function config(id:ServiceId,key:string,value:string){if(draft)change('services',{...draft.services,[id]:{...draft.services[id],config:{...draft.services[id].config,[key]:value}}});}
  const issues=draft&&proposal?proposalIssues(draft,proposal.internal):[];
  const b=draft?budget(draft):null;
  const Wrapper=mode?Fragment:AppShell;
  const setupComplete=!!proposal?.setup.answers.every(a=>a.trim());
  return <Wrapper><section className="lane-page proposal-page">
    {!mode&&<header className="lane-header"><div><small>{proposal?.internal?'INTERNAL DELIVERY PLAN':'SCOPE TO DELIVERY'}</small><h1 ref={heading} tabIndex={-1}>{proposal?.company||'Company proposal'}</h1><p>{accepted?'Accepted scope preserved · setup and evidence stay connected.':'Establish the package, review the quote, then prepare delivery.'}</p></div><Link className="ops-header-action" href={`/clients/${accountId}`}>Company overview</Link></header>}
    <div className="lane-body">{stepErrors.length>0&&<div ref={validationRef} tabIndex={-1} className="lane-error" role="alert"><b>Complete this step before continuing</b><ul>{stepErrors.map(e=><li key={e}>{e}</li>)}</ul></div>}
      {error&&<div className="lane-error" role="alert">{error} <Button variant="outline" type="button" onClick={()=>{if(!dirty||window.confirm('Discard unsaved changes and reload the saved version?'))void load();}}>Reload saved record</Button></div>}
      {!data||!draft?<p role="status">{error?'The record has not loaded.':'Loading saved proposal…'}</p>:<>
        <div className="proposal-status"><span>Scope revision {proposal!.scopeRevision||'not saved'} · {accepted?'Accepted':proposal!.approval?'Approved for quote':'Draft'}</span><span>{scopeDirty||setupDirty?'Unsaved changes':`Saved version ${proposal!.version}`}</span></div>
        {mode!=='delivery'&&<nav className="proposal-steps" aria-label="Scope and delivery steps">{steps.slice(0,mode?4:5).map((label,i)=><button type="button" key={label} className={i===step?'selected':''} aria-current={i===step?'step':undefined} disabled={busy||i===4&&!accepted||proposal!.internal&&i===2} onClick={()=>setStep(i)}><span>{i+1}</span>{label}</button>)}</nav>}
        {notice&&<p role="status" className="proposal-notice">{notice}</p>}
        {step===0&&<section className="lane-panel proposal-card"><h2>Start with their ecosystem</h2><p>A Google or Microsoft selection is enough for initial scope. Detail actual mailboxes, access and handoffs during setup. Mixed or new systems need an inventory here.</p><fieldset disabled={locked}><label>Existing ecosystem<select value={draft.ecosystem} onChange={e=>change('ecosystem',e.target.value)}><option value="">Choose ecosystem</option>{ecosystems.map(e=><option key={e}>{e}</option>)}</select></label>
          {draft.systems.map((system,i)=><div className="proposal-system" key={i}>{(['purpose','provider','status','owner','notes'] as const).map(key=><label key={key}>{key==='owner'?'Responsible person':key[0].toUpperCase()+key.slice(1)}{key==='status'?<select value={system.status} onChange={e=>change('systems',draft.systems.map((s,j)=>j===i?{...s,status:e.target.value}:s))}>{['Existing','To be created'].map(s=><option key={s}>{s}</option>)}</select>:<Input maxLength={5000} value={system[key]} onChange={e=>change('systems',draft.systems.map((s,j)=>j===i?{...s,[key]:e.target.value}:s))}/>}</label>)}<Button type="button" variant="outline" onClick={()=>change('systems',draft.systems.filter((_,j)=>j!==i))}>Remove system</Button></div>)}<Button variant="outline" disabled={draft.systems.length>=30} onClick={()=>change('systems',[...draft.systems,{purpose:'',provider:'',owner:'',notes:'',status:'Existing'}])}>Add system details</Button></fieldset></section>}
{step===1&&(() => {
  const includedCatalog = serviceCatalog.filter(s => draft.services[s.id]?.choice === 'Include');
  const baseIncludedCount = includedCatalog.filter(s => s.tier === 'base').length;
  const addonIncludedCount = includedCatalog.filter(s => s.tier === 'addon').length;
  const customIncludedCount = (draft.customServices || []).filter(s => s.included).length;
  const totalIncluded = includedCatalog.length + customIncludedCount;
  return (
    <div className="proposal-workspace-grid">
      <div className="proposal-main-column">
        <section className="lane-panel proposal-card">
          <h2>Establish the service package</h2>
          <p>Highlighted services enter the quote. Off means excluded—not TBD. Prices are established in the next step.</p>
          <fieldset disabled={locked}>
            <div className="proposal-toggles">
              {serviceCatalog.map(s => (
                <button
                  type="button"
                  key={s.id}
                  aria-pressed={draft.services[s.id].choice === 'Include'}
                  onClick={() => change('services', {
                    ...draft.services,
                    [s.id]: {
                      ...draft.services[s.id],
                      choice: draft.services[s.id].choice === 'Include' ? 'Not needed' : 'Include'
                    }
                  })}
                >
                  <small>{s.tier === 'base' ? 'BASE' : 'ADD-ON'}</small>
                  <strong>{s.name}</strong>
                  <span>{draft.services[s.id].choice === 'Include' ? 'Included ✓' : 'Not included +'}</span>
                </button>
              ))}
            </div>
            {includedCatalog.map(s => (
              <article className="proposal-service" key={s.id} id={`service-${s.id}`}>
                <h3>{s.name}</h3>
                <p>{s.summary}</p>
                <details>
                  <summary>Cipher’s field guide</summary>
                  <p>{s.guidance}</p>
                </details>
                <div className="proposal-fields">
                  {s.fields.map(f => (
                    <label key={f.key}>
                      {f.label}
                      {f.options ? (
                        <select value={draft.services[s.id].config[f.key] || ''} onChange={e => config(s.id, f.key, e.target.value)}>
                          <option value="">Choose</option>
                          {f.options.map(o => <option key={o}>{o}</option>)}
                        </select>
                      ) : (
                        <Textarea maxLength={5000} value={draft.services[s.id].config[f.key] || ''} onChange={e => config(s.id, f.key, e.target.value)} />
                      )}
                      <small>{f.hint}</small>
                    </label>
                  ))}
                </div>
              </article>
            ))}
            {(draft.customServices || []).map((s, i) => (
              <article className="proposal-service" key={s.id} id={`service-${s.id}`}>
                <Button className="service-inclusion-toggle" aria-pressed={s.included} variant={s.included ? 'default' : 'outline'} onClick={() => change('customServices', draft.customServices!.map((v, j) => j === i ? { ...v, included: !v.included } : v))}>
                  {s.included ? 'Included ✓' : 'Not included +'} · {s.name || 'Custom service'}
                </Button>
                {s.included && (
                  <div className="proposal-fields">
                    {customFields.map(f => (
                      <label key={f.key}>
                        {f.label}
                        <Textarea maxLength={5000} value={s[f.key]} onChange={e => change('customServices', draft.customServices!.map((v, j) => j === i ? { ...v, [f.key]: e.target.value } : v))} />
                        <small>{f.hint}</small>
                      </label>
                    ))}
                  </div>
                )}
              </article>
            ))}
            <Button variant="outline" disabled={(draft.customServices?.length || 0) >= 30} onClick={() => change('customServices', [...(draft.customServices || []), { id: `custom_${crypto.randomUUID()}`, included: true, name: '', outcome: '', systems: '', boundaries: '', acceptance: '' }])}>
              Add a custom service
            </Button>
            <label>
              Quote comments & future opportunities
              <Textarea maxLength={5000} value={draft.quoteComments || ''} onChange={e => change('quoteComments', e.target.value)} />
              <small>For example: “Revisit social marketing in one month.” Comments do not order services or schedule reminders.</small>
            </label>
          </fieldset>
        </section>
      </div>
      <aside className="company-panel proposal-summary-sidebar">
        <div className="panel-heading">
          <div>
            <small className="eyebrow">PACKAGE SUMMARY</small>
            <h2>Scope & services</h2>
          </div>
          <span className="company-status">{totalIncluded} of {serviceCatalog.length} included</span>
        </div>
        <div className="proposal-summary-stats">
          <div className="proposal-stat-row">
            <span>Base services</span>
            <strong>{baseIncludedCount} of 5</strong>
          </div>
          <div className="proposal-stat-row">
            <span>Optional add-ons</span>
            <strong>{addonIncludedCount} of 5</strong>
          </div>
          {customIncludedCount > 0 && (
            <div className="proposal-stat-row">
              <span>Custom services</span>
              <strong>{customIncludedCount}</strong>
            </div>
          )}
        </div>
        {includedCatalog.length > 0 && (
          <div className="proposal-jump-list">
            <small className="eyebrow">CONFIGURED SERVICES</small>
            <nav aria-label="Configured services quick jump">
              {includedCatalog.map(s => (
                <a key={s.id} href={`#service-${s.id}`} className="proposal-jump-item">
                  <span className="proposal-jump-bullet">✓</span>
                  <span>{s.name}</span>
                </a>
              ))}
            </nav>
          </div>
        )}
        <div className="proposal-sidebar-guidance">
          <small className="eyebrow">CIPHER’S FIELD GUIDE</small>
          <p>Highlighted services enter the quote scope. Off means excluded. Prices and allowance are established in step 3.</p>
        </div>
        <div className="proposal-sidebar-actions">
          {!accepted && (
            <Button variant="outline" disabled={busy || setupDirty} onClick={() => void act({ action: 'save', draft })}>
              {busy ? 'Saving…' : 'Save draft'}
            </Button>
          )}
          <Button disabled={busy} onClick={continueScope}>
            {accepted ? 'Continue →' : 'Save & continue →'}
          </Button>
        </div>
      </aside>
    </div>
  );
})()}
        {step===2&&!proposal!.internal&&<section className="lane-panel proposal-card"><h2>Pricing & limits</h2><p>The monthly service fee is prepaid. Actual eligible usage above the included allowance is reconciled in arrears, within the client’s accepted additional limit.</p><fieldset disabled={locked}><div className="proposal-fields">{([['setup','One-time setup'],['monthly','Total monthly service fee'],['allowance','Included monthly usage allowance'],['overage','Maximum additional usage spend']] as const).map(([key,label])=><label key={key}>{label}<span className="proposal-money"><span aria-hidden="true">$</span><Input inputMode="decimal" aria-label={`${label} in USD`} maxLength={50} value={draft[key]} onChange={e=>change(key,e.target.value)}/></span><small>USD · commas accepted; enter 0 if none.</small></label>)}</div><label>One-time setup includes<Textarea maxLength={5000} value={draft.setupDescription||''} onChange={e=>change('setupDescription',e.target.value)}/></label>
          <label>Monthly pricing presentation<select value={draft.pricingMode||'package'} onChange={e=>change('pricingMode',e.target.value as 'package'|'itemized')}><option value="package">One monthly package total</option><option value="itemized">Allocate monthly total across services</option></select></label>
          {draft.pricingMode==='itemized'&&<div className="proposal-fields">{scopedServiceNames(draft).map(s=><label key={s.id}>{s.name}<span className="proposal-money"><span aria-hidden="true">$</span><Input aria-label={`${s.name} monthly USD`} inputMode="decimal" value={draft.monthlyPrices?.[s.id]||''} onChange={e=>change('monthlyPrices',{...draft.monthlyPrices,[s.id]:e.target.value})}/></span></label>)}</div>}
          <p className="proposal-notice">Total usage budget: {usd(b!.total)} = allowance + maximum additional spend. The service fee is separate. This is not proof that a provider hard stop exists.</p>
          <div className="proposal-fields">{([['eligible','Eligible provider costs','Only attributable costs billed to Bearagon.'],['exclusions','Excluded charges','Exclude client-paid subscriptions and unapproved work.'],['allocation','Internal cost attribution','Explain client/project identifiers and reconciliation. Not shown in customer preview.'],['fallback','Limit response and human fallback','Client-visible continuity plan; review the starting example.'],['overshoot','Overshoot prevention and recovery','Internal controls, delayed usage, in-flight work and Bearagon-funded unauthorized excess.']] as const).map(([key,label,hint])=><label key={key}>{label}<Textarea maxLength={5000} value={draft[key]} onChange={e=>change(key,e.target.value)}/><small>{hint}</small></label>)}<label>Early warning (% of allowance)<Input inputMode="numeric" value={draft.alertAt} onChange={e=>change('alertAt',e.target.value)}/><small>1–99%. Also warn at exhaustion and before the total budget; zero allowance needs immediate zero-budget handling.</small></label></div></fieldset></section>}
        {step===3&&<>
          {!proposal!.internal?<CustomerQuote company={proposal!.company} draft={draft} reference={`OPS-${accountId.slice(-8).toUpperCase()}`} revision={proposal!.scopeRevision} status={scopeDirty?'UNSAVED DRAFT':accepted?'Acceptance recorded':proposal!.approval?'Approved for quote':'Draft · not approved'}/>:<section className="lane-panel proposal-card"><h2>Internal delivery authorization</h2><p>No customer quote, fees or revenue are created for Bearagon’s own organization.</p>{scopedServiceNames(draft).map(s=><p key={s.id}>{s.name}</p>)}</section>}
          <section className="lane-panel proposal-card"><h2>Internal review & acceptance</h2>{issues.length>0&&!accepted&&<div className="proposal-issues"><h3>Before approval</h3><ul>{issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></div>}
          <p>{proposal!.approval?`Approved by ${proposal!.approval.name} (${proposal!.approval.email}) for revision ${proposal!.approval.revision}.`:`Approval will be attributed to your signed-in identity${data.actor?`: ${data.actor.name} (${data.actor.email})`:''}. It does not send the quote or authorize execution.`}</p>
          {!accepted&&!proposal!.approval&&<Button disabled={busy||scopeDirty||!proposal!.version||issues.length>0} onClick={()=>void act({action:'approve'})}>Approve saved revision for {proposal!.internal?'internal delivery':'quoting'}</Button>}
          {proposal!.approval&&!accepted&&<fieldset disabled={busy||scopeDirty}><p>{proposal!.internal?'Authorize this internal delivery plan. No customer contract is recorded.':'Record acceptance only after the client has accepted this exact revision outside Ops. Do not substitute internal approval for client agreement.'}</p>{!proposal!.internal&&<div className="proposal-fields"><label>Accepted by (client name)<Input value={contact} onChange={e=>setContact(e.target.value)}/></label><label>Actual acceptance date<Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Signed quote / acceptance evidence reference<Textarea value={reference} maxLength={2000} onChange={e=>setReference(e.target.value)}/></label></div>}<label className="proposal-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{proposal!.internal?'I authorize this internal plan.':'I confirm the client accepted the services, fees and usage ceiling in this saved revision.'}</label><Button disabled={!confirmed||busy||scopeDirty} onClick={()=>void act({action:proposal!.internal?'authorizeInternal':'accept',contact,date,reference},4)}>{proposal!.internal?'Authorize & open setup':'Record acceptance & open setup'}</Button></fieldset>}
          {accepted&&<p>Revision {proposal!.acceptance!.revision} accepted by {proposal!.acceptance!.contact} on {proposal!.acceptance!.date}. Evidence: {proposal!.acceptance!.reference}. Recorded by {proposal!.acceptance!.email}. Accepted commercial terms are read-only; amendments are not yet supported.</p>}
          </section>
        </>}
        {step===4&&!accepted&&<section className="lane-panel proposal-card"><h2>Establish the accepted scope first</h2><p>Guided setup opens after the saved service package is approved and client acceptance is recorded. For Bearagon’s own organization, record internal authorization instead.</p><Button onClick={()=>mode?onScope?.():setStep(0)}>Open service package</Button></section>}
        {step===4&&accepted&&<>
          {setupComplete&&!editingSetup?<section className="lane-panel proposal-card"><div className="panel-heading"><div><small className="eyebrow">SETUP COMPLETE</small><h2>{data.closed?'Completed setup':'Ready for build & test'}</h2></div><Button variant="outline" disabled={data.closed} onClick={()=>setEditingSetup(true)}>Edit setup answers</Button></div><div className="setup-saved-grid">{questions.map((q,i)=><article key={q[0]}><b>✓ {q[0]}</b><details><summary>View saved answer</summary><p>{answers[i]}</p></details></article>)}</div><small>Setup revision {proposal!.setup.revision} · {proposal!.setup.recorded?.email}</small></section>:<div className="company-record-grid"><section className="lane-panel proposal-card"><div className="panel-heading"><small className="eyebrow">GUIDED SETUP</small><span>{proposal!.setup.answers.filter(a=>a.trim()).length} of 3 saved</span></div><div className="proposal-setup-tabs">{questions.map((q,i)=><Button key={q[0]} variant={setupStep===i?'default':'outline'} onClick={()=>setSetupStep(i)}>{proposal!.setup.answers[i]?.trim()?'✓ ':i+1+'. '}{q[0]}</Button>)}</div><div className="setup-question-heading"><span>0{setupStep+1}</span><div><h2>{questions[setupStep][1]}</h2><p>{questions[setupStep][2]}</p></div></div><fieldset disabled={busy||data.closed}><label className="sr-only" htmlFor="setup-answer">{questions[setupStep][1]}</label><Textarea id="setup-answer" rows={7} maxLength={2000} value={answers[setupStep]} onChange={e=>setAnswers(answers.map((a,i)=>i===setupStep?e.target.value:a))}/><div className="company-actions"><Button disabled={!answers[setupStep].trim()} onClick={()=>{if(setupDirty&&proposal!.orders.some(o=>o.status!=='to_build'))setResetReview(true);else void saveSetup();}}>{busy?'Saving…':setupStep<2?'Save & continue':'Save setup & view work orders'}</Button>{editingSetup&&<Button variant="outline" onClick={()=>{if(!setupDirty||window.confirm('Discard unsaved setup edits?')){setAnswers(proposal!.setup.answers);setEditingSetup(false);}}}>Cancel edit</Button>}</div></fieldset></section><aside className="company-panel"><small className="eyebrow">CIPHER’S FIELD GUIDE</small><h2>Make the handoff clear</h2><p>Use these answers to give the builder enough context to act safely.</p><ul><li>Describe an outcome the client can verify.</li><li>Name the actual systems and responsible people.</li><li>Explain when a human should take over.</li></ul><p className="company-help">No passwords or API keys. Changes retain accepted scope and require revalidation of build evidence.</p></aside></div>}
          {setupComplete&&!setupOnly&&<>          <section className="lane-panel proposal-card"><small className="eyebrow">IMPLEMENTATION</small><h2>{data.closed?'Recorded implementation':'Build & test'}</h2><p>Build in the delivery harness. Record actual build and test references here; Ops does not run tests or deploy automations.</p>{proposal!.orders.map(o=><article className="proposal-order" key={o.key}><div><h3>{o.name}</h3><p>{o.status.replaceAll('_',' ')} · setup revision {o.setupRevision}</p>{o.buildRef&&<p className="evidence-reference"><strong>Build:</strong> {o.buildRef}</p>}{o.testRef&&<p className="evidence-reference"><strong>Test evidence:</strong> {o.testRef}</p>}{o.recorded&&<small>Recorded by {o.recorded.email} · {o.recorded.at}</small>}<details><summary>Build brief & playbook</summary><p>{proposal!.draft.services[o.key as ServiceId]?.config?Object.entries(proposal!.draft.services[o.key as ServiceId].config).map(([key,value])=>`${serviceCatalog.find(s=>s.id===o.key)?.fields.find(f=>f.key===key)?.label||key}: ${value}`).join('\n'):proposal!.draft.customServices?.find(s=>s.id===o.key)?.outcome||o.brief}</p><ol>{(serviceCatalog.find(s=>s.id===o.key)?.steps||['Implement the accepted custom scope.','Test its acceptance criteria and human fallback.']).map(s=><li key={s}>{s}</li>)}</ol>{proposal!.setup.answers.map((a,i)=><p key={i}><strong>{questions[i][0]}:</strong> {a||'Not completed'}</p>)}</details><EmailWalkthroughLink accountId={accountId} order={o} readOnly={data.closed}/></div><Button variant="outline" disabled={busy||setupDirty||!proposal!.setup.answers.every(a=>a.trim())||data.closed} aria-label={`${o.recorded?'Edit':'Record'} evidence for ${o.name}`} onClick={()=>{setError('');setOrder({...o});}}>{o.recorded?'Edit evidence':'Record build / test evidence'}</Button></article>)}{data.closed&&<p className="company-help">Onboarding is complete. Implementation evidence is read-only; previous entries remain in saved revision history.</p>}{!data.closed&&<p className="company-help">{proposal!.internal?'Internal work is reviewed per automation. There is no company-wide onboarding completion gate.':'Complete the delivery requirements and launch review below after recording the external evidence.'}</p>}</section></>}{children}
        </>}
        {step<4&&<div className="proposal-actions">{!accepted&&<Button variant="outline" disabled={busy||setupDirty} onClick={()=>void act({action:'save',draft})}>{busy?'Saving…':'Save draft'}</Button>}<div className="proposal-action-next">{step>0&&<Button variant="outline" disabled={busy} onClick={()=>setStep(proposal!.internal&&step===3?1:step-1)}>Back</Button>}{step<3&&<Button disabled={busy} onClick={continueScope}>{accepted?'Continue →':'Save & continue →'}</Button>}{accepted&&<Button variant="outline" onClick={()=>mode?onDelivery?.():setStep(4)}>Continue to delivery →</Button>}</div></div>}
        <details className="lane-panel proposal-card"><summary>Saved revision history</summary><p>Changes and evidence are retained as read-only snapshots. New saves appear here immediately.</p>{data.history?.map(h=><p key={h.version}>Version {h.version} · {h.action} · {h.actor_email} · {h.created_at} <Button variant="outline" disabled={busy} onClick={()=>void viewRevision(h.version)}>View saved version</Button></p>)}</details>
      </>}
    </div>
    <Dialog open={resetReview} onOpenChange={open=>{if(!busy)setResetReview(open);}}><DialogContent><DialogHeader><DialogTitle>Save changes and require retesting?</DialogTitle><DialogDescription>These modules will return to To build. Previous evidence stays in history; accepted commercial scope is unchanged.</DialogDescription></DialogHeader><ul>{proposal?.orders.map(o=><li key={o.key}>{o.name}</li>)}</ul><DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setResetReview(false)}>Keep editing</Button><Button disabled={busy} onClick={()=>void saveSetup()}>Save & require retesting</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!order} onOpenChange={open=>{if(!open)closeEvidence();}}><DialogContent className="crm-dialog evidence-dialog" showCloseButton={!busy}><DialogHeader><DialogTitle>{savedOrder?.recorded?'Edit evidence':'Record evidence'} · {order?.name}</DialogTitle><DialogDescription>{savedOrder?.recorded?'Your saved details are prefilled. Correct only what needs changing; earlier evidence stays in revision history.':'Record verifiable references from the external harness.'} Nothing executes from this dialog.</DialogDescription></DialogHeader>{order&&<WorkOrderEvidenceForm order={order} saved={savedOrder} busy={busy} error={error} onChange={setOrder} onCancel={closeEvidence} onSave={()=>void act({action:'order',key:order.key,status:order.status,buildRef:order.buildRef,testRef:order.testRef})}/>}</DialogContent></Dialog>
    <Dialog open={!!archive} onOpenChange={open=>{if(!open)setArchive(null);}}><DialogContent className="proposal-history-dialog"><DialogHeader><DialogTitle>Historical version {archive?.version} · read-only</DialogTitle><DialogDescription>This snapshot is retained for reference. It does not replace or approve the current record.</DialogDescription></DialogHeader>{archive&&<>{!archive.internal&&<details><summary>Historical quote & commercial terms</summary><CustomerQuote company={archive.company} draft={archive.draft} reference={`OPS-${accountId.slice(-8).toUpperCase()}`} revision={archive.scopeRevision} status="HISTORICAL SNAPSHOT"/></details>}<section><h3>Saved setup · revision {archive.setup.revision}</h3>{archive.setup.answers.map((a,i)=><p key={i}>{questions[i][0]}: {a||'Not completed'}</p>)}{archive.orders.map(o=><p key={o.key}>{o.name} · {o.status} · Build: {o.buildRef||'None'} · Test: {o.testRef||'None'} · {o.recorded?.email}</p>)}</section></>}</DialogContent></Dialog>
  </section></Wrapper>;
}
