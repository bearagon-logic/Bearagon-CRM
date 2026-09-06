import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, contacts, accountContacts, operatorAuditEvents } from "@/db/schema";
import { auditActor, getOperatorIdentity, operatorRequiredResponse } from "@/lib/server/operator-auth";
import { relationshipInput } from "@/lib/inquiry-input";
import { newId } from "@/lib/ops-domain.mjs";

async function load(id: string) {
  const db = getDb();
  const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
  const [primary] = await db.select({ contact: contacts }).from(accountContacts).innerJoin(contacts, eq(contacts.id, accountContacts.contactId)).where(and(eq(accountContacts.accountId, id), eq(accountContacts.isPrimary, true)));
  return { account, contact: primary?.contact ?? null };
}
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getOperatorIdentity(request)) return operatorRequiredResponse();
  const data = await load((await context.params).id);
  if (!data.account) return Response.json({ error: "Account not found." }, { status: 404 });
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  const parsed = relationshipInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { id } = await context.params, db = getDb(), existing = await load(id);
  if (!existing.account) return Response.json({ error: "Account not found." }, { status: 404 });
  if (existing.account.organizationKind === "internal") return Response.json({ error: "Internal operations are excluded from the sales pipeline." }, { status: 400 });
  const { marketingStatus, marketingEvidence, ...values } = parsed.data;
  const now = new Date().toISOString();
  const statements = [
    db.update(accounts).set({ ...values, relationshipType: values.salesStage === "won" ? "client" : existing.account.relationshipType, updatedAt: now }).where(eq(accounts.id, id)),
    ...(existing.contact ? [db.update(contacts).set({ marketingStatus, marketingEvidence, updatedAt: now }).where(eq(contacts.id, existing.contact.id))] : []),
    db.insert(operatorAuditEvents).values({ id: newId("audit"), accountId: id, resourceType: "account", resourceId: id, action: "relationship.updated", ...auditActor(actor), result: "succeeded", detail: `Sales ${existing.account.salesStage} → ${values.salesStage}; owner ${values.relationshipOwner || "unassigned"}; follow-up ${values.followUpDate || "not set"}; primary contact marketing ${marketingStatus}. ${values.salesStage === "won" ? "Client relationship recorded; no onboarding, order, or deployment created." : ""}` }),
  ];
  await db.batch(statements as [typeof statements[number], ...typeof statements]);
  return Response.json(await load(id));
}
