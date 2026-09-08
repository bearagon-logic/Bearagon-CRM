import { serviceCatalog } from './service-catalog';
export { serviceCatalog };
export const ecosystems = ['Google Workspace', 'Microsoft 365', 'Mixed systems', 'New setup'] as const;
export type ServiceId = (typeof serviceCatalog)[number]['id'];
export type ServiceChoice = 'Include' | 'Not needed' | 'Decide later';
export type ScopedServiceId = ServiceId | `custom_${string}`;
export type CustomService = {
  id: `custom_${string}`;
  included: boolean;
  name: string;
  outcome: string;
  systems: string;
  boundaries: string;
  acceptance: string;
};
export const customFields = [
  {
    key: 'name',
    label: 'Service name',
    hint: 'A clear name for this company’s custom service.',
  },
  {
    key: 'outcome',
    label: 'Outcome and deliverables',
    hint: 'What will be delivered, its cadence and expected volume.',
  },
  {
    key: 'systems',
    label: 'Systems and dependencies',
    hint: 'Providers, connections and client prerequisites.',
  },
  {
    key: 'boundaries',
    label: 'Scope and authority boundaries',
    hint: 'Included work, exclusions, human approvals and fallback.',
  },
  {
    key: 'acceptance',
    label: 'Acceptance criteria',
    hint: 'How the client and Bearagon will verify this works.',
  },
] as const;
export type SystemEntry = {
  purpose: string;
  provider: string;
  status: string;
  owner: string;
  notes: string;
};
export type ScopeDraft = {
  // Optional for compatibility with already saved/accepted concept revisions.
  quoteComments?: string;
  customServices?: CustomService[];
  setupDescription?: string;
  pricingMode?: 'package' | 'itemized';
  monthlyPrices?: Partial<Record<ScopedServiceId, string>>;
  ecosystem: string;
  systems: SystemEntry[];
  services: Record<
    ServiceId,
    { choice: ServiceChoice; config: Record<string, string> }
  >;
  setup: string;
  monthly: string;
  allowance: string;
  overage: string;
  eligible: string;
  exclusions: string;
  allocation: string;
  alertAt: string;
  fallback: string;
  overshoot: string;
};
export type ScopeRecord = {
  draft: ScopeDraft;
  revision: number;
  approval: null | { reviewer: string; at: string; revision: number };
};
export const standardSetupDescription =
  'In-person consultation to confirm your scope and priorities. Setup of your primary business AI harness—the platform that runs your agreed automations. Setup of Bearagon Console on your desktop and relevant employees’ cell phones, so your team can view automation status and updates.';

export function scopedServiceNames(d: ScopeDraft) {
  return [
    ...serviceCatalog
      .filter((s) => d.services[s.id].choice === 'Include')
      .map((s) => ({ id: s.id as ScopedServiceId, name: s.name })),
    ...(d.customServices ?? [])
      .filter((s) => s.included)
      .map((s) => ({
        id: s.id as ScopedServiceId,
        name: s.name || 'Custom service',
      })),
  ];
}
export function monthlyItemization(d: ScopeDraft) {
  const lines = scopedServiceNames(d).map((s) => ({
    ...s,
    amount: cents(d.monthlyPrices?.[s.id] ?? ''),
  }));
  const total =
    lines.length && lines.every((s) => s.amount !== null)
      ? lines.reduce((sum, s) => sum + s.amount!, 0)
      : null;
  return {
    lines,
    total,
    matches: total !== null && total === cents(d.monthly),
  };
}
export const budgetPolicyExamples = {
  fallback:
    'Notify the Bearagon owner and client contact as the budget runs low. Pause new paid automation work before the limit. For phone service, use an agreed, tested human or voicemail fallback with its costs covered. With no reply or no budget, remain paused. Resume only after available, authorized budget is confirmed.',
  overshoot:
    'Before launch, test provider limits and reserve budget for delayed usage reports and work already running. Reconcile actual costs. If the budget is exceeded, pause new paid work, notify the Bearagon owner and investigate. Bearagon covers unauthorized excess. Resume only after the cause is fixed and available, authorized budget is confirmed.',
} as const;

// Editor starting points only: never mutate a saved revision or imply controls exist.
export function withBudgetExamples(draft: ScopeDraft): ScopeDraft {
  return {
    ...draft,
    fallback: draft.fallback.trim()
      ? draft.fallback
      : budgetPolicyExamples.fallback,
    overshoot: draft.overshoot.trim()
      ? draft.overshoot
      : budgetPolicyExamples.overshoot,
  };
}

export function emptyScope(selected: readonly string[] = []): ScopeDraft {
  return {
    ecosystem: '',
    systems: [],
    services: Object.fromEntries(
      serviceCatalog.map((s) => [
        s.id,
        {
          choice: (
            selected.length ? selected.includes(s.id) : s.tier === 'base'
          )
            ? 'Include'
            : 'Not needed',
          config: {},
        },
      ]),
    ) as ScopeDraft['services'],
    setup: '',
    monthly: '',
    allowance: '',
    overage: '',
    eligible: '',
    exclusions: '',
    allocation: '',
    alertAt: '80',
    fallback: '',
    overshoot: '',
    quoteComments: '',
    customServices: [],
  };
}
// Null means unspecified/invalid, never silently a zero-dollar commitment.
export function cents(value: string): number | null {
  // Validate grouping before stripping commas; never interpret 2,00 as 200.
  if (!/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value))
    return null;
  const normalized = value.replaceAll(',', '');
  if (!/^(0|[1-9]\d{0,6})(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function budget(d: ScopeDraft) {
  const allowance = cents(d.allowance),
    overage = cents(d.overage);
  return {
    allowance,
    overage,
    total: allowance === null || overage === null ? null : allowance + overage,
  };
}
export function usageExample(d: ScopeDraft, usage: number) {
  const b = budget(d);
  if (
    b.allowance === null ||
    b.overage === null ||
    !Number.isSafeInteger(usage) ||
    usage < 0
  )
    return null;
  const additional = Math.max(0, usage - b.allowance);
  return {
    applied: Math.min(usage, b.allowance),
    billable: Math.min(additional, b.overage),
    absorbed: Math.max(0, additional - b.overage),
  };
}
export function includedServices(d: ScopeDraft): ScopedServiceId[] {
  return [
    ...serviceCatalog
      .filter((s) => d.services[s.id].choice === 'Include')
      .map((s) => s.id),
    ...(d.customServices ?? []).filter((s) => s.included).map((s) => s.id),
  ];
}
export function scopeIssues(d: ScopeDraft): string[] {
  const issues: string[] = [];
  if (!(ecosystems as readonly string[]).includes(d.ecosystem))
    issues.push('Choose the client ecosystem.');
  if (['Mixed systems', 'New setup'].includes(d.ecosystem) && !d.systems.length) issues.push('Describe at least one system for a mixed or new ecosystem.');
  if (
    d.systems.some(
      (s) =>
        !s.purpose.trim() ||
        !s.provider.trim() ||
        !s.owner.trim() ||
        !['Existing', 'To be created'].includes(s.status),
    )
  )
    issues.push(
      'Complete purpose, provider, status and responsible person for each system.',
    );
  if (!includedServices(d).length) issues.push('Include at least one service.');
  for (const s of serviceCatalog) {
    const entry = d.services[s.id];
    if (entry.choice === 'Include')
      for (const f of s.fields) {
        const value = entry.config[f.key] ?? '';
        if (
          !value.trim() ||
          ('options' in f && f.options && !f.options.includes(value))
        )
          issues.push(`${s.name}: complete ${f.label.toLowerCase()}.`);
      }
  }
  for (const s of d.customServices ?? [])
    if (s.included) {
      for (const f of customFields)
        if (!s[f.key].trim())
          issues.push(
            `${s.name.trim() || 'Custom service'}: complete ${f.label.toLowerCase()}.`,
          );
    }
  for (const [key, label] of [
    ['setup', 'setup fee'],
    ['monthly', 'monthly base fee'],
    ['allowance', 'included monthly usage'],
    ['overage', 'maximum additional usage spend'],
  ] as const)
    if (cents(d[key]) === null)
      issues.push(`Enter a valid ${label} in USD (zero is allowed).`);
  if (d.setupDescription !== undefined && !d.setupDescription.trim())
    issues.push('Describe what the one-time setup includes.');
  if (d.pricingMode === 'itemized') {
    const itemization = monthlyItemization(d);
    for (const line of itemization.lines)
      if (line.amount === null)
        issues.push(
          `Enter a monthly price for ${line.name} (zero is allowed).`,
        );
    if (itemization.total !== null && !itemization.matches)
      issues.push(
        'Monthly service line items must add up to the total monthly service fee.',
      );
  }
  for (const [key, label] of [
    ['eligible', 'eligible provider charges'],
    ['exclusions', 'excluded charges'],
    ['allocation', 'client cost attribution'],
    ['fallback', 'limit response and human fallback'],
    ['overshoot', 'overshoot prevention and recovery'],
  ] as const)
    if (!d[key].trim()) issues.push(`Describe ${label}.`);
  if (!/^\d{1,2}$/.test(d.alertAt) || +d.alertAt < 1 || +d.alertAt > 99)
    issues.push(
      'Set an early warning between 1% and 99% of the included allowance.',
    );
  return issues;
}
export function validScopeDraft(value: unknown): value is ScopeDraft {
  if (!value || typeof value !== 'object') return false;
  const d = value as ScopeDraft;
  if (
    d.setupDescription !== undefined &&
    (typeof d.setupDescription !== 'string' || d.setupDescription.length > 5000)
  )
    return false;
  if (
    d.pricingMode !== undefined &&
    !['package', 'itemized'].includes(d.pricingMode)
  )
    return false;
  if (
    d.monthlyPrices !== undefined &&
    (!d.monthlyPrices ||
      typeof d.monthlyPrices !== 'object' ||
      Array.isArray(d.monthlyPrices) ||
      Object.keys(d.monthlyPrices).length > 100 ||
      !Object.entries(d.monthlyPrices).every(
        ([id, amount]) =>
          (serviceCatalog.some((s) => s.id === id) ||
            /^custom_[a-zA-Z0-9-]{1,80}$/.test(id)) &&
          typeof amount === 'string' &&
          amount.length <= 50,
      ))
  )
    return false;
  if (
    d.quoteComments !== undefined &&
    (typeof d.quoteComments !== 'string' || d.quoteComments.length > 5000)
  )
    return false;
  if (
    d.customServices !== undefined &&
    (!Array.isArray(d.customServices) ||
      d.customServices.length > 30 ||
      !d.customServices.every(
        (s) =>
          s &&
          /^custom_[a-zA-Z0-9-]{1,80}$/.test(s.id) &&
          typeof s.included === 'boolean' &&
          customFields.every(
            (f) => typeof s[f.key] === 'string' && s[f.key].length <= 5000,
          ),
      ) ||
      new Set(d.customServices.map((s) => s.id)).size !==
        d.customServices.length)
  )
    return false;
  if (
    !Array.isArray(d.systems) ||
    d.systems.length > 30 ||
    !d.services ||
    typeof d.services !== 'object'
  )
    return false;
  for (const k of [
    'ecosystem',
    'setup',
    'monthly',
    'allowance',
    'overage',
    'eligible',
    'exclusions',
    'allocation',
    'alertAt',
    'fallback',
    'overshoot',
  ] as const)
    if (typeof d[k] !== 'string' || d[k].length > 5000) return false;
  if (
    !d.systems.every(
      (s) =>
        s &&
        ['purpose', 'provider', 'status', 'owner', 'notes'].every(
          (k) =>
            typeof s[k as keyof SystemEntry] === 'string' &&
            s[k as keyof SystemEntry].length <= 5000,
        ),
    )
  )
    return false;
  return serviceCatalog.every((s) => {
    const e = d.services[s.id];
    return (
      e &&
      ['Include', 'Not needed', 'Decide later'].includes(e.choice) &&
      e.config &&
      typeof e.config === 'object' &&
      !Array.isArray(e.config) &&
      Object.values(e.config).every(
        (v) => typeof v === 'string' && v.length <= 5000,
      )
    );
  });
}
