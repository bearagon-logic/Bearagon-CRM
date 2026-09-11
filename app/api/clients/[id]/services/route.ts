import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, getRawDb } from "../../../../../db";
import { accounts, accountServices, automationInstallations, serviceInstallations, operatorAuditEvents } from "../../../../../db/schema";
import { newId } from "../../../../../lib/ops-domain.mjs";
import { serviceInput } from "../../../../../lib/service-input";
import { auditActor, getOperatorIdentity, operatorRequiredResponse } from "../../../../../lib/server/operator-auth";
import { readProposal } from '@/lib/server/proposal-store';
import { managedService } from '@/lib/workflow-ux';

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  if (!await getOperatorIdentity(request)) return operatorRequiredResponse();
  const { id } = await params;
  const db = getDb();
  const rows = await db.select().from(accountServices).where(eq(accountServices.accountId, id)).orderBy(asc(accountServices.name));
  const links = rows.length ? await db.select().from(serviceInstallations).where(inArray(serviceInstallations.serviceId, rows.map(r => r.id))) : [];
  const proposal=await readProposal(getRawDb(),id);
  return Response.json({ services: rows.map(row => ({ ...row, delivery:managedService(proposal,row.id), installationIds: links.filter(l => l.serviceId === row.id).map(l => l.installationId) })) }, { headers: { "cache-control": "no-store" } });
}

async function save(request: Request, { params }: Context) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  const { id: accountId } = await params;
  let body: Record<string, unknown>;
  try { const value = await request.json(); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); body = value as Record<string, unknown>; } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = serviceInput.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const db = getDb();
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account) return Response.json({ error: "Account not found." }, { status: 404 });
  const id = request.method === "PATCH" ? String(body.id ?? "") : newId("service");
  const [existing] = await db.select().from(accountServices).where(and(eq(accountServices.id, id), eq(accountServices.accountId, accountId))).limit(1);
  if (request.method === "PATCH" && !existing) return Response.json({ error: "Service not found for this account." }, { status: 404 });
  const { installationIds, ...fields } = parsed.data;
  if (existing) {
    const managed = await getRawDb().prepare("SELECT 1 AS found FROM account_proposals p,json_each(p.state,'$.orders') o WHERE p.account_id=? AND json_extract(o.value,'$.serviceId')=? LIMIT 1").bind(accountId,id).first();
    const frozen = ['name','scope','configuration','quoteRef','acceptedAt','monthlyFeeCents','setupFeeCents','currency'] as const;
    if (managed && frozen.some(key => fields[key] !== existing[key])) return Response.json({error:"These services belong to an accepted package. Commercial terms are read-only; a separately agreed amendment is required."},{status:409});
  }
  const ids = [...new Set(installationIds)];
  if (ids.length) {
    const installations = await db.select({ id: automationInstallations.id }).from(automationInstallations).where(and(eq(automationInstallations.accountId, accountId), inArray(automationInstallations.id, ids)));
    if (installations.length !== ids.length) return Response.json({ error: "Only this account’s automations can be linked." }, { status: 400 });
  }
  const record = { ...fields, id, accountId, updatedAt: new Date().toISOString() };
  await db.batch([
    existing ? db.update(accountServices).set(record).where(and(eq(accountServices.id, id), eq(accountServices.accountId, accountId))) : db.insert(accountServices).values(record),
    db.delete(serviceInstallations).where(eq(serviceInstallations.serviceId, id)),
    ...(ids.length ? [db.insert(serviceInstallations).values(ids.map(installationId => ({ serviceId: id, installationId })))] : []),
    db.insert(operatorAuditEvents).values({ id: newId("audit"), accountId, resourceType: "account_service", resourceId: id, action: existing ? "service.updated" : "service.created", ...auditActor(actor), result: "recorded", detail: JSON.stringify({ before: existing ?? null, after: record, installationIds: ids }) }),
  ]);
  return Response.json({ service: { ...record, installationIds: ids } }, { status: existing ? 200 : 201 });
}
export const POST = save;
export const PATCH = save;
