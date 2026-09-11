"use client";
import {useState} from 'react';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Textarea} from './ui/textarea';
import {DialogFooter} from './ui/dialog';
import {editableStatus,requirementIssue,unmetRequirements,type Requirement} from '@/lib/requirement-readiness';
import {requirementEvidence} from '@/lib/workflow-ux';
import type {ProposalState} from '@/lib/proposal-model';

export function RequirementEditor({task,tasks,proposal,closed,busy,error,onChange,onSave,onClose,onOpen}:{task:Requirement;tasks:Requirement[];proposal:ProposalState|null;closed:boolean;busy:boolean;error:string;onChange:(t:Requirement)=>void;onSave:(t:Requirement)=>Promise<void>;onClose:()=>void;onOpen:(t:Requirement)=>void}) {
  const unmet=unmetRequirements(task,tasks);
  const [editing,setEditing]=useState(closed||unmet.length===0);
  const issue=requirementIssue(task,tasks),evidence=requirementEvidence(task.templateKey,proposal),blocker=(task.blockedReason||'').trim();
  return <form className="requirement-editor" onSubmit={e=>{e.preventDefault();if(!busy&&!closed&&!issue)void onSave(task);}}>
    {!closed&&unmet.length>0&&<section className="requirement-prerequisites" aria-label="Unfinished prerequisites"><h3>Finish these requirements first</h3><p>This requirement cannot be marked complete yet. Open the unfinished work below, or save progress without approving completion.</p><ul>{unmet.map(item=><li key={item.key}>{item.task?<Button type="button" variant="outline" disabled={busy} onClick={()=>onOpen(item.task!)}>Open {item.title} →</Button>:<span>{item.title} — missing from this checklist; contact an administrator.</span>}</li>)}</ul></section>}
    {!editing&&!closed&&task.status==='blocked'&&blocker&&<section className="requirement-recorded-blocker" aria-label="Recorded blocker"><h3>Recorded blocker</h3><p>{blocker}</p></section>}
    {!editing&&!closed?<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Close</Button><Button type="button" onClick={()=>{onChange({...task,status:editableStatus(task.status)});setEditing(true);}}>{task.status==='pending'?'Record progress instead':'Update this requirement'}</Button></DialogFooter>:<>
      {!closed&&evidence&&<div className="requirement-evidence"><p>Use the saved record as a starting point, then verify it.</p><Button type="button" variant="outline" disabled={busy} onClick={()=>onChange({...task,evidenceRef:task.evidenceRef||evidence.evidenceRef,completionNote:task.completionNote||evidence.completionNote})}>Use recorded evidence</Button></div>}
      <fieldset disabled={busy||closed}>
        <label>Status<select value={task.status} onChange={e=>onChange({...task,status:e.target.value})}>{['pending','in_progress','blocked','completed','skipped'].map(s=><option key={s} value={s} disabled={s==='completed'&&unmet.length>0}>{({pending:'Not started',in_progress:'In progress',blocked:'Blocked',completed:'Completed',skipped:'Approved exception'})[s]}{s==='completed'&&unmet.length?' — prerequisites unfinished':''}</option>)}</select></label>
        <label>{task.status==='skipped'?'Approved exception (required)':task.status==='completed'?'Verification note':'Progress note'}<Textarea maxLength={3000} rows={5} value={task.completionNote||''} onChange={e=>onChange({...task,completionNote:e.target.value})}/></label>
        <label>Evidence reference <small>{task.status==='completed'?'Provide a note above or a reference here.':'Optional — link or reference to supporting work.'}</small><Input maxLength={1000} value={task.evidenceRef||''} onChange={e=>onChange({...task,evidenceRef:e.target.value})}/></label>
        {task.status==='blocked'?<label>Blocker reason (required)<Textarea maxLength={3000} rows={3} value={task.blockedReason||''} onChange={e=>onChange({...task,blockedReason:e.target.value})}/></label>:blocker&&<p className="company-help">Saving with this status clears the recorded blocker: {blocker}</p>}
      </fieldset>
      {!closed&&issue&&<p id="requirement-issue" className="company-help" role="status">{issue}</p>}
      {error&&<div className="company-error" role="alert">{error}<p>Your entries are still here. Retry, or save them as progress without marking this complete.</p></div>}
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{closed?'Close review':'Cancel'}</Button>{!closed&&<>{(error||task.status==='completed'&&unmet.length>0)&&<Button type="button" variant="outline" disabled={busy} onClick={()=>void onSave({...task,status:'in_progress'})}>Save as in progress</Button>}<Button type="submit" disabled={busy||!!issue} aria-describedby={issue?'requirement-issue':undefined}>{busy?'Saving…':task.status==='completed'?'Save completion':task.status==='skipped'?'Save approved exception':'Save progress'}</Button></>}</DialogFooter>
    </>}
  </form>;
}
