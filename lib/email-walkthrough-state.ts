import { emailConfigIssues, supportedEmailGuide, type EmailConfig, type EmailRun, type StepProgress } from './email-playbook';

export type WalkthroughEntry = Pick<StepProgress, 'status' | 'notes' | 'evidence' | 'blocker'>;
export const entryFrom = (progress?: StepProgress): WalkthroughEntry => progress
  ? { status: progress.status, notes: progress.notes, evidence: progress.evidence, blocker: progress.blocker }
  : { status: 'in_progress', notes: '', evidence: '', blocker: '' };

export function emailResumeStep(run?: EmailRun, readOnly = false): string {
  if (!run) return 'configuration';
  if (readOnly || !supportedEmailGuide(run.version)) return 'summary';
  if (emailConfigIssues(run.config).length) return 'configuration';
  return run.steps.find(step => run.progress[step.id]?.status !== 'completed')?.id || 'summary';
}
export function emailResumeLabel(run?: EmailRun, readOnly = false): string {
  if (!run) return readOnly ? 'View saved walkthrough' : 'Start guided email setup';
  const step = emailResumeStep(run, readOnly);
  return readOnly || !supportedEmailGuide(run.version) ? 'View saved walkthrough'
    : step === 'summary' ? 'Review recorded walkthrough'
    : `Continue: ${step === 'configuration' ? 'Configuration' : run.steps.find(item => item.id === step)?.title}`;
}

type Draft<T> = { value: T; base: string };
export type WalkthroughDrafts = { configuration?: Draft<EmailConfig>; entries: Record<string, Draft<WalkthroughEntry>> };
export function rememberDraft<T>(value: T, base: string): Draft<T> | undefined {
  return JSON.stringify(value) === base ? undefined : { value: { ...value }, base };
}
// A successful save clears only its own draft. Other steps survive navigation,
// failed saves, fresh server reads and provider-route changes.
export function withoutSavedDraft(drafts: WalkthroughDrafts, id: string): WalkthroughDrafts {
  const next = { ...drafts, entries: { ...drafts.entries } };
  if (id === 'configuration') delete next.configuration;
  else delete next.entries[id];
  return next;
}
