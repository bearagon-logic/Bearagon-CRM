import { z } from "zod";
export const feedEvent = z.object({
  seq: z.number().int().positive(), eventId: z.string().min(1).max(150), source: z.enum(["website", "retell"]),
  companyName: z.string().max(200), contactName: z.string().max(200), email: z.string().max(254), phone: z.string().max(60), summary: z.string().min(1).max(5000), sourceRef: z.string().max(500), receivedAt: z.string().max(50), notificationStatus: z.enum(["pending","failed","sent","not_applicable"]),
});
export const feedResponse = z.object({ events: z.array(feedEvent).max(50), health: z.array(z.object({ source: z.enum(["website","retell"]), last_received_at: z.string(), total: z.number(), notification_pending: z.number() })).max(2), retellConfigured: z.boolean() });
export type FeedEvent = z.infer<typeof feedEvent>;
export async function eventRequestKey(id: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`bearagon-intake:${id}`))).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2,"0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function automaticMatch(event: FeedEvent, named: { id: string }[], linked: { id: string; name: string; organizationKind: string; status: string }[]) {
  if (!event.companyName || !event.contactName || !z.string().email().safeParse(event.email).success) return { reason: "Confirm company, contact name, and email. Phone-only inquiries need review." };
  if (linked.length === 1 && linked[0].organizationKind === "external" && linked[0].status === "active" && linked[0].name.trim().toLowerCase() === event.companyName.trim().toLowerCase() && named.every((a) => a.id === linked[0].id)) return { accountId: linked[0].id, reason: "" };
  if (linked.length || named.length) return { reason: "An existing company or contact matches. Confirm the correct account before importing." };
  return { accountId: "", reason: "" };
}
