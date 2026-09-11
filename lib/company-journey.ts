import type { ProposalState } from './proposal-model';

export const journeyLabels = ['Inquiry', 'Scope', 'Setup', 'Build & test', 'Operate'] as const;
export type CompanySection = 'overview' | 'services' | 'delivery' | 'activity' | 'complete';
export function companySection(tab: string | null): CompanySection {
  if (tab === 'automations') return 'services';
  if (tab === 'onboarding') return 'delivery';
  return ['overview','services','delivery','activity','complete'].includes(tab || '') ? tab as CompanySection : 'overview';
}
export function journeyPhase(client: {stage:string;onboardingStatus:string;salesStage?:string;organizationKind?:string}, proposal: ProposalState | null) {
  if (client.organizationKind === 'internal') return 4;
  if (client.stage === 'Live' && client.onboardingStatus === 'completed') return 4;
  if (proposal?.acceptance) return proposal.setup.answers.every(a=>a.trim()) ? 3 : 2;
  if (proposal?.version) return 1;
  // Keep pre-migration delivery visible without inventing accepted package data.
  if (client.onboardingStatus === 'active') return ['Building','Testing','Live'].includes(client.stage) ? 3 : 2;
  if (['qualified','proposal','won'].includes(client.salesStage||'')) return 1;
  return 0;
}
export function phaseSection(phase:number): CompanySection { return phase === 0 ? 'overview' : phase === 1 || phase === 4 ? 'services' : 'delivery'; }
