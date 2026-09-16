type RequirementDraft={id:string;status:string;evidenceRef:string;completionNote:string;blockedReason:string};
type CompanyDraft={baseline:{client:{website:string;notes:string;relationshipOwner:string;dueDate:string;nextStep:string};tasks:RequirementDraft[]};website:string;notes:string;savedNotes:string;operationsOwner:string;target:string;next:string;task:RequirementDraft|null;requirements:[string,RequirementDraft][]};
export type CompanySavedChange=
  | {kind:'requirement';saved:RequirementDraft;submitted:Omit<RequirementDraft,'id'>}
  | {kind:'context';saved:{website:string;notes:string};submitted:{website:string;notes:string}}
  | {kind:'owner';saved:string;submitted:string}
  | {kind:'coordination';saved:{target:string;next:string};submitted:{target:string;next:string}}
  | {kind:'other'};
const evidence=(task:Omit<RequirementDraft,'id'>)=>JSON.stringify([task.status,task.evidenceRef,task.completionNote,task.status==='blocked'?task.blockedReason:'']);

// Reconcile only fields this successful action saved. Other draft values and
// their original baselines remain intact, including conflicts with later edits.
export function reconcileCompanyHistoryDraft<T extends CompanyDraft>(draft:T,change:CompanySavedChange):T|undefined{
  const remaining=structuredClone(draft);
  if(change.kind==='requirement'){
    const sameSave=(task:RequirementDraft)=>task.id===change.saved.id&&evidence(task)===evidence(change.submitted);
    if(remaining.task&&sameSave(remaining.task))remaining.task=null;
    remaining.requirements=remaining.requirements.filter(([,task])=>!sameSave(task));
    remaining.baseline.tasks=remaining.baseline.tasks.map(task=>task.id===change.saved.id?structuredClone(change.saved):task);
  }else if(change.kind==='context'){
    if(remaining.website===change.submitted.website)remaining.website=change.saved.website;
    if(remaining.notes===change.submitted.notes)remaining.notes=change.saved.notes;
    remaining.savedNotes=change.saved.notes;
    remaining.baseline.client.website=change.saved.website;remaining.baseline.client.notes=change.saved.notes;
  }else if(change.kind==='owner'){
    if(remaining.operationsOwner===change.submitted)remaining.operationsOwner=change.saved;
    remaining.baseline.client.relationshipOwner=change.saved;
  }else if(change.kind==='coordination'){
    if(remaining.target===change.submitted.target)remaining.target=change.saved.target;
    if(remaining.next===change.submitted.next)remaining.next=change.saved.next;
    remaining.baseline.client.dueDate=change.saved.target;remaining.baseline.client.nextStep=change.saved.next;
  }
  const savedTask=remaining.task&&remaining.baseline.tasks.find(task=>task.id===remaining.task!.id);
  const taskDirty=remaining.task&&(!savedTask||evidence(remaining.task)!==evidence(savedTask));
  const client=remaining.baseline.client;
  return remaining.requirements.length||taskDirty||remaining.website!==client.website||remaining.notes!==remaining.savedNotes||remaining.operationsOwner!==client.relationshipOwner||remaining.target!==client.dueDate||remaining.next!==client.nextStep?remaining:undefined;
}
