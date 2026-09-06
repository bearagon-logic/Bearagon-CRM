import { env } from "cloudflare:workers";
import { and, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, contacts, accountContacts, intakeReceipts, intakeFeedState } from "@/db/schema";
import { automaticMatch, eventRequestKey, feedResponse, type FeedEvent } from "@/lib/intake-feed";
import { recordInquiry } from "@/app/api/inquiries/route";

function config() {
  const values = env as typeof env & { INTAKE_FEED_URL?: string; INTAKE_FEED_TOKEN?: string };
  const url = values.INTAKE_FEED_URL || "";
  // Never turn operator requests into a generic authenticated URL fetcher.
  if (url !== "https://bearagon.com/api/intake/feed") return null;
  return values.INTAKE_FEED_TOKEN ? { url, token: values.INTAKE_FEED_TOKEN } : null;
}
export function intakeConfigured() { return !!config(); }
export async function importEvent(request: Request, id: string, event: FeedEvent, accountId: string, overrides: Record<string, unknown> = {}) {
  const input = { companyName: event.companyName, contactName: event.contactName, email: event.email, phone: event.phone, summary: event.summary, ...overrides, accountId, source: event.source === "retell" ? "phone" : "website", requestKey: await eventRequestKey(id) };
  const result = await recordInquiry(new Request(request.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }), `${event.source} · ${event.eventId}`);
  const body = await result.json() as { inquiry?: { id: string }; error?: string };
  if (!result.ok || !body.inquiry) return { error: body.error || "Import could not be completed." };
  await getDb().update(intakeReceipts).set({ status: "imported", inquiryId: body.inquiry.id, reason: "", updatedAt: new Date().toISOString() }).where(eq(intakeReceipts.id, id));
  return { inquiry: body.inquiry };
}
export async function syncIntake(request: Request) {
  const settings = config(); if (!settings) return { configured: false };
  const db = getDb(), now = Date.now(), token = crypto.randomUUID();
  await db.insert(intakeFeedState).values({ id: "website" }).onConflictDoNothing();
  const [lease] = await db.update(intakeFeedState).set({ leaseUntil: now + 120000, leaseToken: token }).where(and(eq(intakeFeedState.id,"website"), lte(intakeFeedState.leaseUntil,now))).returning();
  if (!lease) return { busy: true };
  let imported = 0, review = 0, cursor = lease.cursor;
  try {
    const r = await fetch(`${settings.url}?after=${cursor}`, { headers: { authorization: `Bearer ${settings.token}` }, redirect: "manual", signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`Intake feed returned ${r.status}.`);
    const reader = r.body?.getReader(); let raw = "", size = 0; const decoder = new TextDecoder();
    if (!reader) throw new Error("Empty feed response.");
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 800000) { await reader.cancel(); throw new Error("Feed response exceeded the safety limit."); } raw += decoder.decode(value, { stream: true }); } raw += decoder.decode(); } finally { reader.releaseLock(); }
    const feed = feedResponse.parse(JSON.parse(raw));
    for (const event of feed.events) {
      if (event.seq <= cursor) throw new Error("Feed sequence is out of order.");
      const id = `${event.source}:${event.eventId}`;
      const [receipt] = await db.select().from(intakeReceipts).where(eq(intakeReceipts.id,id));
      if (!receipt) {
        await db.insert(intakeReceipts).values({ id, sequence:event.seq, source:event.source, payload:JSON.stringify(event), receivedAt:event.receivedAt, reason:"Awaiting identity review." }).onConflictDoNothing();
        const named = await db.select({id:accounts.id}).from(accounts).where(sql`lower(trim(${accounts.name})) = ${event.companyName.toLowerCase()}`);
        const linked = event.email ? await db.select({id:accounts.id,name:accounts.name,organizationKind:accounts.organizationKind,status:accounts.status}).from(contacts).innerJoin(accountContacts,eq(accountContacts.contactId,contacts.id)).innerJoin(accounts,eq(accounts.id,accountContacts.accountId)).where(eq(contacts.emailNormalized,event.email.toLowerCase())) : [];
        const match = automaticMatch(event,named,linked);
        const result = match.reason ? {error:match.reason} : await importEvent(request,id,event,match.accountId || "");
        if (result.error) { review++; await db.update(intakeReceipts).set({reason:result.error}).where(eq(intakeReceipts.id,id)); } else imported++;
      }
      cursor = event.seq;
      // Advance only after a durable receipt exists. A lost response can safely replay.
      await db.update(intakeFeedState).set({cursor}).where(and(eq(intakeFeedState.id,"website"),eq(intakeFeedState.leaseToken,token)));
    }
    await db.update(intakeFeedState).set({ lastSyncedAt:new Date().toISOString(),lastError:"",health:JSON.stringify({sources:feed.health,retellConfigured:feed.retellConfigured}) }).where(and(eq(intakeFeedState.id,"website"),eq(intakeFeedState.leaseToken,token)));
    return { configured:true,imported,review,hasMore:feed.events.length===50 };
  } catch (error) {
    console.error("Intake synchronization failed", error instanceof Error ? error.message.slice(0,200) : "Unknown error");
    const message = error instanceof Error && error.message.startsWith("Intake feed returned") ? error.message : "Unable to synchronize the intake feed. Saved inquiries remain available; retry shortly.";
    await db.update(intakeFeedState).set({lastError:message}).where(and(eq(intakeFeedState.id,"website"),eq(intakeFeedState.leaseToken,token)));
    return { error:message };
  } finally { await db.update(intakeFeedState).set({leaseUntil:0,leaseToken:""}).where(and(eq(intakeFeedState.id,"website"),eq(intakeFeedState.leaseToken,token))); }
}
