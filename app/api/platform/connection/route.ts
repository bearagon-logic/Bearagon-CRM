import { and, eq, isNull, ne } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accounts, workspaces, automationInstallations, operatorAuditEvents } from "../../../../db/schema";
import { consolePlatformConfigured, getPlatformFleet, getWorkspaceAutomationOverview } from "../../../../lib/server/console-platform";
import { auditActor, getOperatorIdentity, operatorRequiredResponse } from "../../../../lib/server/operator-auth";
import { newId, slugify } from "../../../../lib/ops-domain.mjs";

export async function GET(request: Request) {
  if (!await getOperatorIdentity(request)) return operatorRequiredResponse();
  const db = getDb();
  const mappings = await db.select({ accountId: accounts.id, name: accounts.name, consoleClientId: workspaces.consoleClientId }).from(accounts).leftJoin(workspaces, eq(accounts.id, workspaces.accountId));
  if (!consolePlatformConfigured()) return Response.json({ state: "not_configured", clients: [], mappings, message: "Console connection needs setup. Configure the Console API address and operator credential on the CRM server." }, { headers: { "cache-control": "no-store" } });
  try {
    const fleet = await getPlatformFleet();
    return Response.json({ state: "connected", clients: fleet.clients, mappings, fetchedAt: new Date().toISOString(), message: "Console is reachable. Link each CRM account to its Console workspace below." }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ state: "unavailable", clients: [], mappings, message: "Console could not be reached or the credential lacks operator access. Check the server connection settings." }, { headers: { "cache-control": "no-store" } });
  }
}

export async function PATCH(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  let body: Record<string, unknown>;
  try { const value = await request.json(); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); body = value as Record<string, unknown>; } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof body.accountId !== "string" || typeof body.consoleClientId !== "string" || !body.consoleClientId) return Response.json({ error: "Choose an account and a Console workspace." }, { status: 400 });
  if (!consolePlatformConfigured()) return Response.json({ error: "Configure the Console connection first." }, { status: 409 });
  const db = getDb();
  const [account] = await db.select().from(accounts).where(eq(accounts.id, body.accountId)).limit(1);
  if (!account) return Response.json({ error: "Account not found." }, { status: 404 });
  try {
    const fleet = await getPlatformFleet();
    if (!fleet.clients.some(c => c.id === body.consoleClientId)) return Response.json({ error: "Workspace was not found in Console." }, { status: 400 });
    await getWorkspaceAutomationOverview(body.consoleClientId);
  } catch { return Response.json({ error: "Unable to verify the workspace in Console. The link was not changed." }, { status: 502 }); }
  const [taken] = await db.select().from(workspaces).where(and(eq(workspaces.consoleClientId, body.consoleClientId), ne(workspaces.accountId, account.id))).limit(1);
  if (taken) return Response.json({ error: "That Console workspace is already linked to another company." }, { status: 409 });
  const [existing] = await db.select().from(workspaces).where(eq(workspaces.accountId, account.id)).limit(1);
  if (existing?.consoleClientId && existing.consoleClientId !== body.consoleClientId) return Response.json({ error: "This account already has a Console workspace. A workspace transfer requires a separate review of its automation mappings." }, { status: 409 });
  const now = new Date().toISOString();
  const id = existing?.id ?? newId("workspace");
  const fields = { consoleClientId: body.consoleClientId, lastSyncedAt: now, updatedAt: now };
  await db.batch([
    existing ? db.update(workspaces).set(fields).where(eq(workspaces.id, id)) : db.insert(workspaces).values({ id, accountId: account.id, displayName: account.name, slug: `${slugify(account.name)}-${id.slice(-8)}`, ...fields }),
    db.update(automationInstallations).set({ workspaceId: id, updatedAt: now }).where(and(eq(automationInstallations.accountId, account.id), isNull(automationInstallations.workspaceId))),
    db.insert(operatorAuditEvents).values({ id: newId("audit"), accountId: account.id, resourceType: "workspace", resourceId: id, action: "workspace.console_linked", ...auditActor(actor), result: "succeeded", detail: `Linked verified Console workspace ${body.consoleClientId}` }),
  ]);
  return Response.json({ linked: true });
}
