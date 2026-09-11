import type { DeliveryReadiness } from '@/lib/delivery-readiness';

export function DeliveryNextAction({readiness, coordination = ''}: {readiness: DeliveryReadiness; coordination?: string}) {
  return <div><small className="eyebrow">NEXT ACTION</small><h2>{readiness.label}</h2><p>{readiness.description}</p>{coordination && <p className="company-help"><b>Saved coordination note:</b> {coordination}</p>}</div>;
}
