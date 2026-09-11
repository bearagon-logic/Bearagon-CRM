import { emptyScope, scopeIssues, standardSetupDescription, withBudgetExamples, validScopeDraft, type ScopeDraft, scopedServiceNames } from './proposal-scope';

export type Stamp = { id: string; name: string; email: string; at: string };
export type WorkOrder = { key: string; serviceId: string; taskId: string; name: string; status: 'to_build' | 'building' | 'built' | 'tested'; buildRef: string; testRef: string; recorded: Stamp | null; setupRevision: number; brief?:string; internalRelease?:{review:string;recorded:Stamp;setupRevision:number}|null };
export type ProposalState = {
  version: number; scopeRevision: number; company: string; internal: boolean; draft: ScopeDraft;
  approval: (Stamp & { revision: number }) | null;
  acceptance: (Stamp & { revision: number; reference: string; date: string; contact: string; internal: boolean }) | null;
  engagementId: string; setup: { answers: string[]; revision: number; recorded: Stamp | null }; orders: WorkOrder[];
};
export type ProposalCommand = { action: 'save' | 'approve' | 'accept' | 'authorizeInternal' | 'setup' | 'order' | 'addInternalOrder' | 'releaseInternal' | 'withdrawInternal'; expectedVersion: number; draft?: unknown; reference?: string; date?: string; contact?: string; answers?: unknown; confirmReset?: boolean; key?: string; status?: string; buildRef?: string; testRef?: string; name?:string; brief?:string; review?:string; confirmed?:boolean };
export class ProposalError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function newProposal(company: string, internal: boolean): ProposalState {
  return { version: 0, scopeRevision: 0, company, internal, draft: { ...withBudgetExamples(emptyScope()), setupDescription: standardSetupDescription, pricingMode: 'package' }, approval: null, acceptance: null, engagementId: '', setup: { answers: ['', '', ''], revision: 0, recorded: null }, orders: [] };
}
export function proposalIssues(draft: ScopeDraft, internal: boolean) {
  return scopeIssues(internal ? { ...draft, setup: '0', monthly: '0', allowance: '0', overage: '0', pricingMode: 'package', setupDescription: 'Internal delivery', eligible: 'Internal', exclusions: 'Internal', allocation: 'Internal', alertAt: '80', fallback: 'Internal', overshoot: 'Internal' } : draft);
}
const text = (v: unknown, max = 2000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export function transitionProposal(current: ProposalState, command: ProposalCommand, actor: Stamp, newId: () => string): ProposalState {
  if (command.expectedVersion !== current.version) throw new ProposalError('This record changed in another session. Reload before continuing; your draft has not been overwritten.', 409);
  const s: ProposalState = structuredClone(current);
  if (command.action === 'save') {
    if (s.acceptance) throw new ProposalError('Accepted scope is read-only. A separately agreed amendment is required.', 409);
    if (!validScopeDraft(command.draft)) throw new ProposalError('The scope draft contains invalid or oversized fields.');
    if (s.version && JSON.stringify(s.draft) === JSON.stringify(command.draft)) return current;
    s.draft = command.draft; s.scopeRevision++; s.approval = null;
  } else if (command.action === 'approve') {
    if (s.acceptance || s.approval) throw new ProposalError('This revision is already reviewed.');
    const issues = proposalIssues(s.draft, s.internal);
    if (!s.scopeRevision || issues.length) throw new ProposalError(issues[0] || 'Save the scope before review.');
    s.approval = { ...actor, revision: s.scopeRevision };
  } else if (command.action === 'accept' || command.action === 'authorizeInternal') {
    if (s.acceptance) throw new ProposalError('Acceptance has already been recorded.', 409);
    if (!s.approval || s.approval.revision !== s.scopeRevision || proposalIssues(s.draft, s.internal).length) throw new ProposalError('Approve the complete saved revision first.');
    if (s.internal !== (command.action === 'authorizeInternal')) throw new ProposalError('Use the correct client acceptance or internal authorization action.');
    if (!s.internal && (!text(command.reference) || !text(command.contact, 200) || !/^\d{4}-\d{2}-\d{2}$/.test(command.date || '') || !Number.isFinite(Date.parse(command.date!)) || new Date(command.date!).toISOString().slice(0,10) !== command.date || command.date! > actor.at.slice(0,10))) throw new ProposalError('Record who accepted, the actual acceptance date, and a signed quote/email evidence reference.');
    s.acceptance = { ...actor, revision: s.scopeRevision, internal: s.internal, reference: s.internal ? 'Internal delivery authorization' : command.reference!.trim(), contact: s.internal ? actor.name : command.contact!.trim(), date: s.internal ? actor.at.slice(0,10) : command.date! };
    s.orders = scopedServiceNames(s.draft).map(service => ({ key: service.id, name: service.name, serviceId: `service_${newId()}`, taskId: `task_${newId()}`, status: 'to_build', buildRef: '', testRef: '', recorded: null, setupRevision: 0 }));
  } else if (command.action === 'setup') {
    if (!s.acceptance) throw new ProposalError('Record client acceptance or internal authorization before setup.');
    if (!Array.isArray(command.answers) || command.answers.length !== 3 || !command.answers.every(v => typeof v === 'string' && v.length <= 2000)) throw new ProposalError('Provide three setup answers, each no longer than 2,000 characters.');
    const answers = command.answers.map(v => v.trim());
    if (JSON.stringify(answers) === JSON.stringify(s.setup.answers)) return current;
    if (s.orders.some(o => o.status !== 'to_build') && command.confirmReset !== true) throw new ProposalError('Confirm that changing setup returns this package’s work orders to To build for revalidation.', 409);
    s.setup = { answers, revision: s.setup.revision + 1, recorded: actor };
    s.orders = s.orders.map(o => ({ ...o, status: 'to_build', buildRef: '', testRef: '', recorded: null, setupRevision: s.setup.revision, ...(s.internal?{internalRelease:null}:{}) }));
  } else if (['addInternalOrder','releaseInternal','withdrawInternal'].includes(command.action)) {
    if(!s.internal||!s.acceptance?.internal)throw new ProposalError('This action requires an authorized internal organization.',403);
    if(command.action==='addInternalOrder') {
      if(!text(command.name,160)||!text(command.brief,2000))throw new ProposalError('Name the automation and describe its outcome, systems and human fallback.');
      if(s.orders.length>=50)throw new ProposalError('This internal portfolio is limited to 50 work orders.');
      s.orders.push({key:`internal_${newId()}`,serviceId:`service_${newId()}`,taskId:`task_${newId()}`,name:command.name!.trim(),brief:command.brief!.trim(),status:'to_build',buildRef:'',testRef:'',recorded:null,setupRevision:s.setup.revision});
    } else {
      const order=s.orders.find(o=>o.key===command.key);
      if(!order)throw new ProposalError('Choose an existing internal automation.');
      if(command.action==='withdrawInternal') { order.internalRelease=null; }
      else {
        if(order.status!=='tested'||order.setupRevision!==s.setup.revision||!text(order.buildRef)||!text(order.testRef))throw new ProposalError('Record current build and test evidence for this automation first.');
        if(!s.setup.answers.every(a=>text(a))||!text(command.review,2000)||command.confirmed!==true)throw new ProposalError('Review approved actions, access boundaries and human fallback, then confirm your authority.');
        order.internalRelease={review:command.review!.trim(),recorded:actor,setupRevision:s.setup.revision};
      }
    }
  } else if (command.action === 'order') {
    if (!s.acceptance || !s.setup.answers.every(a => text(a))) throw new ProposalError('Complete and save all three setup answers first.');
    const order = s.orders.find(o => o.key === command.key);
    if (!order || !(s.internal?['to_build','building','built','tested']:['to_build','built','tested']).includes(command.status || '')) throw new ProposalError('Choose an existing work order and a valid state.');
    if (['built','tested'].includes(command.status||'') && !text(command.buildRef)) throw new ProposalError('Provide the actual build reference.');
    if(command.status==='building'&&typeof command.buildRef==='string'&&command.buildRef.length>2000)throw new ProposalError('Build notes must be no longer than 2,000 characters.');
    if (command.status === 'tested' && !text(command.testRef)) throw new ProposalError('Provide external test evidence; a click does not run a test.');
    order.status = command.status as WorkOrder['status']; order.buildRef = command.status === 'to_build' ? '' : (command.buildRef||'').trim(); order.testRef = command.status === 'tested' ? command.testRef!.trim() : ''; order.recorded = actor; order.setupRevision = s.setup.revision;
    if(s.internal)order.internalRelease=null;
  } else throw new ProposalError('Unknown proposal action.');
  s.version++;
  return s;
}
