import { routeInquiry } from '@/lib/server/inquiry-routing';
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, getRawDb } from "@/db";
import { handoffInquiry } from '@/lib/server/inquiry-handoff';
import { z } from 'zod';
import { accounts, contacts, accountContacts, inquiries, operatorAuditEvents } from "@/db/schema";
import { auditActor, getOperatorIdentity, operatorRequiredResponse } from "@/lib/server/operator-auth";
import { inquiryCreateInput, inquiryUpdateInput } from "@/lib/inquiry-input";
import { newId } from "@/lib/ops-domain.mjs";

export async function GET(request: Request) {
  if (!await getOperatorIdentity(request)) return operatorRequiredResponse();
  const accountId = new URL(request.url).searchParams.get("accountId");
  const rows = await getDb().select({ inquiry: inquiries, companyName: accounts.name, contactName: contacts.displayName, email: contacts.email, phone: contacts.phone })
    .from(inquiries).innerJoin(accounts, eq(accounts.id, inquiries.accountId)).innerJoin(contacts, eq(contacts.id, inquiries.contactId))
    .where(accountId ? eq(inquiries.accountId, accountId) : sql`(${accounts.status}='active' OR ${inquiries.status}='closed')`).orderBy(desc(inquiries.createdAt));
  return Response.json({ inquiries: rows.map(({ inquiry, ...context }) => ({ ...inquiry, ...context })) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  return recordInquiry(request);
}

export async function recordInquiry(request: Request, capturedSource?: string) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  const parsed = inquiryCreateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const v = parsed.data, db = getDb();
  const [replay] = await db.select().from(inquiries).where(eq(inquiries.requestKey, v.requestKey));
  if (replay) return Response.json({ inquiry: replay, reused: true });
  const [existingContact] = v.email ? await db.select().from(contacts).where(eq(contacts.emailNormalized, v.email)) : [];
  let accountId = v.accountId;
  if (accountId) {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    if (!account || account.status === "archived" || account.organizationKind === "internal") return Response.json({ error: "Choose an active external account for an incoming business inquiry." }, { status: 400 });
  } else {
    const named = await db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(sql`lower(trim(${accounts.name})) = ${v.companyName.toLowerCase()}`);
    const linked = existingContact ? await db.select({ id: accounts.id, name: accounts.name }).from(accountContacts).innerJoin(accounts, eq(accounts.id, accountContacts.accountId)).where(eq(accountContacts.contactId, existingContact.id)) : [];
    const matches = [...new Map([...named, ...linked].map((a) => [a.id, a])).values()];
    if (matches.length) return Response.json({ error: `An existing company or contact matches. Choose the existing account before saving: ${matches.map((a) => a.name).join(", ")}.`, matches }, { status: 409 });
    accountId = newId("acct");
  }
  const contactId = existingContact?.id ?? newId("contact"), id = newId("inquiry"), now = new Date().toISOString();
  const [primary] = v.accountId ? await db.select().from(accountContacts).where(and(eq(accountContacts.accountId, accountId), eq(accountContacts.isPrimary, true))) : [];
  const record = { id, requestKey: v.requestKey, accountId, contactId, source: v.source, summary: v.summary, owner: v.owner, nextAction: v.nextAction, followUpDate: v.followUpDate, recordedBy: capturedSource || actor.email, updatedAt: now };
  try {
    // One D1 batch: failed contact/link creation must never leave a partial inquiry.
    const statements = [
      ...(!v.accountId ? [db.insert(accounts).values({ id: accountId, name: v.companyName, relationshipOwner: v.owner, relationshipNextAction: v.nextAction, followUpDate: v.followUpDate, updatedAt: now })] : []),
      ...(!existingContact ? [db.insert(contacts).values({ id: contactId, displayName: v.contactName, email: v.email, emailNormalized: v.email || null, phone: v.phone, updatedAt: now })] : []),
      db.insert(accountContacts).values({ accountId, contactId, isPrimary: !primary, relationshipRole: "stakeholder" }).onConflictDoNothing(),
      db.insert(inquiries).values(record),
      db.insert(operatorAuditEvents).values({ id: newId("audit"), accountId, resourceType: "inquiry", resourceId: id, action: "inquiry.recorded", ...auditActor(actor), result: "succeeded", detail: `${capturedSource ? `Imported ${capturedSource}` : `Manually recorded ${v.source} inquiry`}; ${v.accountId ? "linked existing" : "created prospect"} account. No marketing permission inferred.` }),
    ];
    await db.batch(statements as [typeof statements[number], ...typeof statements]);
    return Response.json({ inquiry: record, contactReused: !!existingContact }, { status: 201 });
  } catch (error) {
    const [saved] = await db.select().from(inquiries).where(eq(inquiries.requestKey, v.requestKey));
    if (saved) return Response.json({ inquiry: saved, reused: true });
    console.error("Inquiry save failed", error);
    return Response.json({ error: "The inquiry could not be saved. Refresh accounts and retry; another operator may have just created this contact." }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  const body=await request.json().catch(()=>null);
  if(body&&typeof body==='object'&&'action' in body&&typeof body.action==='string'&&['lead','workflow'].includes(body.action)) {
    const input=z.object({action:z.enum(['lead','workflow']),id:z.string().min(1).max(100),accountId:z.string().min(1).max(100),expectedUpdatedAt:z.string().min(1).max(100)}).safeParse(body);
    if(!input.success)return Response.json({error:'Select a saved inquiry before choosing its next step.'},{status:400});
    const saved=await routeInquiry(getRawDb(),input.data,actor);
    return saved?Response.json({saved:true}):Response.json({error:'This inquiry changed, was already classified, or its company is unavailable. Refresh the queue before retrying.'},{status:409});
  }
  if(body&&typeof body==='object'&&'action' in body&&body.action==='handoff') {
    const input=z.object({id:z.string().min(1).max(100),accountId:z.string().min(1).max(100),expectedUpdatedAt:z.string().min(1).max(100)}).safeParse(body);
    if(!input.success)return Response.json({error:'Select a saved inquiry before handing it off.'},{status:400});
    const saved=await handoffInquiry(getRawDb(),input.data,actor);
    return saved?Response.json({saved:true}):Response.json({error:'This inquiry changed or was already resolved. Reload and review it before retrying.'},{status:409});
  }
  const parsed = inquiryUpdateInput.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { id, ...values } = parsed.data, db = getDb();
  const [existing] = await db.select().from(inquiries).where(eq(inquiries.id, id));
  if (!existing) return Response.json({ error: "Inquiry not found." }, { status: 404 });
  await db.batch([
    db.update(inquiries).set({ ...values, updatedAt: new Date().toISOString() }).where(eq(inquiries.id, id)),
    db.insert(operatorAuditEvents).values({ id: newId("audit"), accountId: existing.accountId, resourceType: "inquiry", resourceId: id, action: "inquiry.updated", ...auditActor(actor), result: "succeeded", detail: `${existing.status} → ${values.status}; owner ${values.owner || "unassigned"}; next action ${values.nextAction || "not set"}; follow-up ${values.followUpDate || "not set"}; resolution ${values.resolution || "none"}` }),
  ]);
  return Response.json({ saved: true });
}
