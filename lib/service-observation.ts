import type { WorkspaceAutomationOverview } from "./contracts/platform";
export function serviceObservation(installation: { consoleAutomationId: string | null; desiredState: string }, overview?: WorkspaceAutomationOverview) {
  if (!overview) return { label: "No Console data", mismatch: false };
  if (!installation.consoleAutomationId) return { label: "Not matched to Console", mismatch: false };
  const automation = overview.automations.find(a => a.slug === installation.consoleAutomationId || a.id === installation.consoleAutomationId);
  if (!automation) return { label: "Missing from Console", mismatch: true };
  const run = overview.runs.filter(r => r.automation_slug === automation.slug).sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0];
  return { label: automation.health.label, automation, run, mismatch: installation.desiredState !== automation.lifecycle };
}
