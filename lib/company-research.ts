import { z } from 'zod/v4';

export const researchLabels = {
  companyName: 'Company name', contactName: 'Public contact · confirm primary contact',
  email: 'Public email · confirm contact email', phone: 'Public phone',
  description: 'Business summary', services: 'Services offered', serviceArea: 'Service area', businessHours: 'Business hours',
} as const;
export type ResearchKey = keyof typeof researchLabels;
export function publicWebsite(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 1000) throw Error('Enter a public company website.');
  let url: URL;
  try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value.trim()) ? value.trim() : 'https://' + value.trim()); }
  catch { throw Error('Enter a valid company website, such as example.com.'); }
  const host = url.hostname.toLowerCase();
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port ||
      !host.includes('.') || !/^[a-z\d.-]+$/.test(host) || /^[\d.]+$/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion)$/.test(host)) {
    throw Error('Use a public website address without a login or custom port.');
  }
  url.hash = '';
  return url.href;
}
const text = (length: number) => z.string().trim().min(1).max(length);
export const researchSchema = z.object({
  fields: z.array(z.object({ key: z.enum(['companyName','contactName','email','phone','description','services','serviceArea','businessHours']), value: text(800), evidence: text(350), sourceUrl: text(1000) })).max(8),
  automations: z.array(z.object({ title: text(100), evidence: text(350), benefit: text(350), questions: z.array(text(200)).min(1).max(3), sourceUrl: text(1000) })).max(3),
  nextUrls: z.array(text(1000)).max(3),
});
export type ResearchContent = z.infer<typeof researchSchema>;
export type CompanyResearch = Omit<ResearchContent, 'nextUrls'> & { website: string; researchedAt: string; sources: string[]; warning: string };
export function researchNotes(result: CompanyResearch, fieldKeys: ResearchKey[], ideas: number[]) {
  const parts = result.fields.filter(f => fieldKeys.includes(f.key)).map(f => `${researchLabels[f.key]}: ${f.value}\nSource: ${f.sourceUrl}`);
  result.automations.forEach((a,i) => { if (ideas.includes(i)) parts.push(`Automation idea (not approved): ${a.title}\nWebsite evidence: ${a.evidence}\nPotential benefit: ${a.benefit}\nConfirm: ${a.questions.join(' ')}\nSource: ${a.sourceUrl}`); });
  return parts.length ? `Website research · ${result.researchedAt.slice(0,10)} · review before relying on it\n${parts.join('\n\n')}` : '';
}
