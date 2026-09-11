import type { ProposalState } from './proposal-model';

export type DeliveryRequirement = { id: string; templateKey: string; title: string; status: string };
export type DeliveryReadiness = {
  kind: 'scope' | 'setup' | 'requirements' | 'work' | 'review' | 'complete';
  label: string; description: string; stageLabel: string; ready: boolean; legacy: boolean;
  total: number; complete: number; open: number; blocked: number;
};
const resolved = (task: DeliveryRequirement) => ['completed', 'skipped'].includes(task.status);

// Presentation only. Saving evidence and approving launch still use the server gates.
export function deliveryReadiness(status: string, tasks: DeliveryRequirement[], proposal: ProposalState | null): DeliveryReadiness {
  const requirements = tasks.filter(task => !task.templateKey.startsWith('scope:'));
  const complete = requirements.filter(resolved).length;
  const blocked = tasks.filter(task => task.status === 'blocked').length;
  const legacy = !proposal?.acceptance && requirements.length > 0;
  const buildRequirement = requirements.find(task => !resolved(task) && ['automation_build', 'client_test', 'launch'].includes(task.templateKey));
  const setupOutstanding = requirements.some(task => !resolved(task) && !['automation_build', 'client_test', 'launch'].includes(task.templateKey));
  const result = (kind: DeliveryReadiness['kind'], label: string, description: string): DeliveryReadiness => ({
    kind, label, description, legacy, ready: kind === 'review', total: requirements.length,
    complete, open: requirements.length - complete, blocked,
    stageLabel: kind === 'complete' ? 'Ongoing service' : blocked || status === 'blocked' ? 'Blocked'
      : kind === 'scope' ? 'Scope' : kind === 'review' ? 'Handoff review'
      : kind === 'work' || kind === 'requirements' && buildRequirement && !setupOutstanding ? 'Build & test' : 'Setup',
  });
  if (status === 'completed') return result('complete', 'Check ongoing services & monitoring', 'The saved delivery history remains available.');
  if (!proposal?.acceptance && !legacy) return result('scope', 'Establish the accepted scope first', 'Review the saved service package and record client acceptance before guided setup.');
  if (proposal?.acceptance && !proposal.setup.answers.every(answer => answer.trim())) return result('setup', 'Complete guided setup', 'Save the outcomes, systems and approval owners needed for the build.');
  const blocker = tasks.find(task => task.status === 'blocked');
  if (blocker) return result('requirements', `Resolve blocker: ${blocker.title}`, 'Open the saved requirement to review its blocker and prerequisites.');
  const next = requirements.find(task => !resolved(task));
  if (next) return result('requirements', `Complete requirement: ${next.title}`, 'Review the saved requirement and record its evidence or an approved exception.');
  const untested = proposal?.acceptance && proposal.orders.find(order => order.status !== 'tested' || order.setupRevision !== proposal.setup.revision || !order.testRef.trim());
  if (untested) return result('work', `Record current build & test evidence: ${untested.name}`, 'The work order needs external test evidence against the current setup revision.');
  if (!requirements.length || proposal?.acceptance && !proposal.orders.length || tasks.some(task => !resolved(task))) return result('requirements', 'Review saved delivery requirements', 'Required delivery records or implementation evidence are still outstanding.');
  if (status === 'blocked') return result('requirements', 'Review the delivery blocker', 'The engagement is still marked blocked. Review its coordination and resolve the blocker before final handoff.');
  return result('review', 'Ready for final handoff review', 'Review the saved evidence and confirm the handoff to ongoing service.');
}
