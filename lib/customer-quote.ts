import {
  budget,
  cents,
  serviceCatalog,
  monthlyItemization,
  type ScopeDraft,
  type ServiceId,
  type ScopedServiceId,
} from './proposal-scope';

const benefits: Record<ServiceId, string> = {
  email:
    'Spend less time sorting email. We organize the agreed inboxes and prepare replies in your preferred tone, with sending authority defined by your scope.',
  brief:
    'Start the day with a clearer picture. Your daily brief brings agreed priorities, updates and exceptions together in Bearagon Console.',
  calls:
    'Give incoming callers a helpful first response. AI reception answers approved questions, captures inquiries and follows your agreed human handoff rules.',
  followup:
    'Keep new opportunities from getting lost. Bring agreed website and phone inquiries into your designated CRM with clear follow-up ownership.',
  intel:
    'Keep a regular pulse on your market. Receive a weekly, source-linked digest of the competitors and topics selected for your business.',
  marketing:
    'Keep your approved outreach moving. Prepare and publish social and email campaigns within the channels, cadence and review rules you choose.',
  research:
    'Get focused insight for important decisions. Investigate the agreed business questions and deliver findings with supporting sources and clear limitations.',
  finance:
    'Make month-end preparation easier. Bring together agreed QuickBooks reports and exceptions for review by your team or accountant.',
  website:
    'Make your website work with your business. Create or integrate the agreed pages, AI features and inquiry flows within a bespoke scope.',
  chief:
    'Bring more structure to a busy day. Coordinate agreed priorities, meeting preparation and follow-up, with people retaining decision authority.',
};

export function customerQuote(d: ScopeDraft) {
  const prices = monthlyItemization(d);
  const priceFor = (id: ScopedServiceId) =>
    d.pricingMode === 'itemized'
      ? (prices.lines.find((l) => l.id === id)?.amount ?? null)
      : null;
  const services = [
    ...serviceCatalog
      .filter((s) => d.services[s.id].choice === 'Include')
      .map((s) => ({
        id: s.id as ScopedServiceId,
        name: s.name,
        description: benefits[s.id],
        amount: priceFor(s.id),
        details: s.fields.map((f) => ({
          label: f.label,
          value: d.services[s.id].config[f.key] || 'To be agreed',
        })),
      })),
    ...(d.customServices ?? [])
      .filter((s) => s.included)
      .map((s) => ({
        id: s.id as ScopedServiceId,
        name: s.name || 'Custom service',
        description: s.outcome || 'Deliverables to be agreed.',
        amount: priceFor(s.id),
        details: [
          { label: 'Systems', value: s.systems },
          { label: 'Scope boundaries', value: s.boundaries },
          { label: 'Acceptance criteria', value: s.acceptance },
        ],
      })),
  ];
  // Deliberately omit provider-control implementation, internal cost allocation,
  // review identities and system-inventory notes from the customer document.
  return {
    setup: cents(d.setup),
    monthly: cents(d.monthly),
    setupDescription:
      d.setupDescription ??
      'Setup of the services in your previously agreed scope. Refer to the original proposal for setup inclusions.',
    services,
    itemized: d.pricingMode === 'itemized',
    itemizationMatches: prices.matches,
    usage: budget(d),
    ecosystem: d.ecosystem || 'To be confirmed',
    eligible: d.eligible,
    exclusions: d.exclusions,
    fallback: d.fallback,
    alertAt: d.alertAt,
    comments: d.quoteComments?.trim() || '',
  };
}
