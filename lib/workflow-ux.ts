import type { ProposalState } from './proposal-model';
import { cents, serviceCatalog, type ScopeDraft } from './proposal-scope';

// Suggestions reuse saved facts; the operator must still verify and save the
// requirement through its normal dependency/authorization checks.
export function requirementEvidence(key: string, proposal: ProposalState | null) {
  if (!proposal?.acceptance) return null;
  const p = proposal as ProposalState & { acceptance: NonNullable<ProposalState['acceptance']> };
  if (key === 'agreement') return { evidenceRef: `Accepted scope revision ${p.scopeRevision}: ${p.acceptance.reference}`, completionNote: p.internal ? 'Internal delivery authorization recorded; no customer contract.' : `Acceptance recorded for this scope. Verify the linked acceptance evidence before completing this requirement.` };
  if (key === 'discovery' && p.setup.answers.every(a => a.trim())) return { evidenceRef: `Guided setup revision ${p.setup.revision}`, completionNote: p.setup.answers.map((a,i) => `${['Success criteria','Systems & handoff','Access & guardrails'][i]}: ${a}`).join('\n').slice(0,3000) };
  if (key === 'automation_build' && p.orders.length && p.orders.every(o => o.setupRevision === p.setup.revision && ['built','tested'].includes(o.status) && o.buildRef.trim())) return { evidenceRef: `Build references in saved version ${p.version}, setup revision ${p.setup.revision}`, completionNote: p.orders.map(o => `${o.name}: ${o.buildRef}`).join('\n').slice(0,3000) };
  // Harness tests are not necessarily client acceptance tests. Never auto-complete.
  if (key === 'client_test' && p.orders.length && p.orders.every(o => o.setupRevision === p.setup.revision && o.status === 'tested' && o.testRef.trim())) return { evidenceRef: `Test references in saved version ${p.version}, setup revision ${p.setup.revision}`, completionNote: `Verify these results include the required client review and accepted exceptions.\n${p.orders.map(o => `${o.name}: ${o.testRef}`).join('\n')}`.slice(0,3000) };
  return null;
}

export function scopeStepIssues(d: ScopeDraft, step: number, internal: boolean): string[] {
  if (step === 0) return !d.ecosystem ? ['Choose the existing ecosystem.'] : ['Mixed systems','New setup'].includes(d.ecosystem) && !d.systems.some(s => s.provider.trim()) ? ['Add the provider for at least one system.'] : [];
  if (step === 1) {
    const selected=serviceCatalog.filter(s=>d.services[s.id].choice==='Include');
    const custom=(d.customServices||[]).filter(s=>s.included);
    if (!selected.length&&!custom.length) return ['Include at least one service.'];
    return selected.flatMap(s=>s.fields.filter(f=>!d.services[s.id].config[f.key]?.trim()).map(f=>`${s.name}: complete ${f.label}.`));
  }
  if (step === 2 && !internal) return (['setup','monthly','allowance','overage'] as const).filter(k=>cents(d[k])===null).map(k=>`${({setup:'One-time setup',monthly:'Monthly service fee',allowance:'Usage allowance',overage:'Additional usage limit'})[k]}: enter a nonnegative USD amount, such as 2,000.00.`);
  return [];
}

export function managedService(proposal: ProposalState | null, serviceId: string) {
  if (!proposal?.acceptance) return null;
  const order=proposal.orders.find(o=>o.serviceId===serviceId);
  if (!order) return null;
  return { order, internal:proposal.internal, scopeRevision:proposal.scopeRevision, setup:cents(proposal.draft.setup), monthly:cents(proposal.draft.monthly), packagePricing:proposal.draft.pricingMode!=='itemized', current:order.setupRevision===proposal.setup.revision };
}
