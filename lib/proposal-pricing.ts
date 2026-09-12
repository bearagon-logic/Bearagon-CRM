import { serviceCatalog, type ScopeDraft } from './proposal-scope';

type PricingContext = { internal: boolean; acceptance: unknown };

// Editable quote starting points; the five base capabilities share one flat fee.
export function defaultServicePrices(draft: ScopeDraft) {
  const additional = serviceCatalog.filter(service => service.tier === 'addon' && draft.services[service.id]?.choice === 'Include').length
    + (draft.customServices ?? []).filter(service => service.included).length;
  return { setup: String(2000 + additional * 500), monthly: String(400 + additional * 100) };
}

export function withDefaultPrices(draft: ScopeDraft, context: PricingContext): ScopeDraft {
  if (context.internal || context.acceptance) return draft;
  const prices = defaultServicePrices(draft);
  let next = draft;
  for (const field of ['setup', 'monthly'] as const) {
    // Itemized monthly allocations retain their existing manual reconciliation flow.
    if (field === 'monthly' && draft.pricingMode === 'itemized') continue;
    const automatic = draft.defaultPricing?.[field];
    if (automatic === true || (automatic === undefined && !draft[field].trim())) {
      if (next[field] !== prices[field] || automatic !== true) {
        next = { ...next, [field]: prices[field], defaultPricing: { ...next.defaultPricing, [field]: true } };
      }
    }
  }
  return next;
}

export function editScopeDraft<K extends keyof ScopeDraft>(draft: ScopeDraft, key: K, value: ScopeDraft[K], context: PricingContext): ScopeDraft {
  if (context.acceptance) return draft;
  const next = { ...draft, [key]: value };
  // Even clearing a field, entering zero, or retyping its suggestion is an override.
  if (key === 'setup' || key === 'monthly') next.defaultPricing = { ...draft.defaultPricing, [key]: false };
  // Choosing itemization hands monthly pricing to the operator, including on return to package mode.
  if (key === 'pricingMode' && value === 'itemized') next.defaultPricing = { ...next.defaultPricing, monthly: false };
  return withDefaultPrices(next, context);
}
