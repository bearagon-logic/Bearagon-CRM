import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../../../../db";
import { automationInstallations, workspaces, operatorAuditEvents } from "../../../../db/schema";
import { getWorkspaceAutomationOverview } from "../../../../lib/server/console-platform";
import { auditActor, getOperatorIdentity, operatorRequiredResponse } from "../../../../lib/server/operator-auth";
import { newId } from "../../../../lib/ops-domain.mjs";
export async function PATCH(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  let body: Record<string, unknown>;
  try { const value = await request.json(); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); body = value as Record<string, unknown>; } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof body.accountId !== "string" || typeof body.installationId !== "string" || typeof body.consoleSlug !== "string") return Response.json({ error: "Choose an automation to link." }, { status: 400 });
  const db = getDb();
  const [installation] = await db.select().from(automationInstallations).where(and(eq(automationInstallations.id, body.installationId), eq(automationInstallations.accountId, body.accountId))).limit(1);
  if (!installation) return Response.json({ error: "Automation not found for this account." }, { status: 404 });
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.accountId, body.accountId)).limit(1);
  if (!workspace?.consoleClientId) return Response.json({ error: "Link this account to Console first." }, { status: 409 });
  if (body.consoleSlug) {
    try {
      const overview = await getWorkspaceAutomationOverview(workspace.consoleClientId);
      if (!overview.automations.some(a => a.slug === body.consoleSlug)) return Response.json({ error: "Automation not found in this company’s Console workspace." }, { status: 400 });
    } catch { return Response.json({ error: "Console is unavailable. The link was not changed." }, { status: 502 }); }
    const [duplicate] = await db.select().from(automationInstallations).where(and(eq(automationInstallations.accountId, body.accountId), eq(automationInstallations.consoleAutomationId, body.consoleSlug), ne(automationInstallations.id, installation.id))).limit(1);
    if (duplicate) return Response.json({ error: "That Console automation is already matched to another installation." }, { status: 409 });
  }
  await db.batch([
    db.update(automationInstallations).set({ consoleAutomationId: body.consoleSlug || null, workspaceId: workspace.id, updatedAt: new Date().toISOString() }).where(eq(automationInstallations.id, installation.id)),
    db.insert(operatorAuditEvents).values({ id: newId("audit"), accountId: body.accountId, resourceType: "automation_installation", resourceId: installation.id, action: "automation.console_linked", ...auditActor(actor), result: "recorded", detail: `Console reference ${installation.consoleAutomationId ?? "none"} → ${body.consoleSlug || "none"}` }),
  ]);
  return Response.json({ linked: Boolean(body.consoleSlug) });
}
