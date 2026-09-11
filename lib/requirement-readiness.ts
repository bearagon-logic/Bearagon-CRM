import { taskTemplate, isTerminalTaskStatus } from './server/onboarding-template';

export type Requirement = {id:string;templateKey:string;title:string;description:string;status:string;evidenceRef:string;completionNote:string;blockedReason:string};
export function unmetRequirements(task:Requirement,tasks:Requirement[]) {
  return (taskTemplate(task.templateKey)?.dependsOn ?? []).filter(key=>!isTerminalTaskStatus(tasks.find(t=>t.templateKey===key)?.status ?? 'pending')).map(key=>({key,title:taskTemplate(key)?.title ?? key,task:tasks.find(t=>t.templateKey===key)}));
}
export function requirementIssue(task:Requirement,tasks:Requirement[]) {
  if(task.status==='completed') {
    const unmet=unmetRequirements(task,tasks);
    if(unmet.length)return `Finish ${unmet.map(t=>t.title).join(' and ')} before marking this complete.`;
    if(!task.evidenceRef.trim()&&!task.completionNote.trim())return 'Add a verification note or evidence reference.';
  }
  if(task.status==='blocked'&&!task.blockedReason.trim())return 'Explain what is blocking this requirement.';
  if(task.status==='skipped'&&!task.completionNote.trim())return 'Document the approved exception.';
  return '';
}
