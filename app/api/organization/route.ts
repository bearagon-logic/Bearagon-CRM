import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, operatorAuditEvents } from "@/db/schema";
import { auditActor, getOperatorIdentity, operatorRequiredResponse } from "@/lib/server/operator-auth";
import { newId } from "@/lib/ops-domain.mjs";

export async function POST(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  const db = getDb();
  const [internal] = await db.select().from(accounts).where(eq(accounts.organizationKind, "internal"));
  if (internal) return Response.json({ accountId: internal.id });
  const candidates = await db.select().from(accounts).where(sql`lower(trim(${accounts.name})) = 'bearagon'`);
  // Do not silently reclassify an existing customer record.
  if (candidates.length) return Response.json({ error: "An account named Bearagon already exists. Review it before creating a separate internal profile." }, { status: 409 });
  const id = "acct_bearagon_internal";
  try {
    await db.batch([
      db.insert(accounts).values({ id, name: "Bearagon", organizationKind: "internal", relationshipType: "other", website: "https://bearagon.com", notes: "Bearagon's internal automation portfolio. Not a customer or sales opportunity." }),
      db.insert(operatorAuditEvents).values({ id: newId("audit"), accountId: id, resourceType: "account", resourceId: id, action: "organization.created", ...auditActor(actor), result: "succeeded", detail: "Created Bearagon internal organization; excluded from external account directory and sales pipeline. No workspace or automations provisioned." }),
    ]);
  } catch (error) {
    const [created] = await db.select().from(accounts).where(eq(accounts.organizationKind, "internal"));
    if (created) return Response.json({ accountId: created.id });
    throw error;
  }
  return Response.json({ accountId: id }, { status: 201 });
}
