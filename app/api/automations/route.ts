import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  accounts,
  automationBlueprints,
  automationInstallations,
  operatorAuditEvents,
  workspaces,
} from "../../../db/schema";
import {
  activationBlocker,
  DELIVERY_STAGES,
  DESIRED_STATES,
  displayLabel,
  newId,
  normalizeAutomationInput,
  normalizeEnum,
  slugify,
} from "../../../lib/ops-domain.mjs";
import {
  auditActor,
  getOperatorIdentity,
  operatorRequiredResponse,
} from "../../../lib/server/operator-auth";

async function loadAutomations(accountId?: string) {
  const rows = await getDb()
    .select({
      id: automationInstallations.id,
      clientId: automationInstallations.accountId,
      clientName: accounts.name,
      workspaceId: automationInstallations.workspaceId,
      blueprintId: automationInstallations.blueprintId,
      name: automationBlueprints.name,
      description: automationBlueprints.objective,
      trigger: automationBlueprints.triggerSummary,
      action: automationBlueprints.actionSummary,
      safetyLevel: automationBlueprints.safetyLevel,
      approvalRequired: automationBlueprints.approvalRequired,
      acceptanceCriteria: automationBlueprints.acceptanceCriteria,
      deliveryStage: automationInstallations.deliveryStage,
      desiredState: automationInstallations.desiredState,
      observedState: automationInstallations.observedState,
      runnerKey: automationInstallations.runnerKey,
      externalWorkflowId: automationInstallations.externalWorkflowId,
      consoleAutomationId: automationInstallations.consoleAutomationId,
      configVersion: automationInstallations.configVersion,
      owner: automationInstallations.owner,
      lastRunStatus: automationInstallations.lastRunStatus,
      lastRunAt: automationInstallations.lastRunAt,
      lastObservedAt: automationInstallations.lastObservedAt,
      lastError: automationInstallations.lastError,
      failureCount: automationInstallations.failureCount,
    })
    .from(automationInstallations)
    .innerJoin(accounts, eq(automationInstallations.accountId, accounts.id))
    .innerJoin(
      automationBlueprints,
      eq(automationInstallations.blueprintId, automationBlueprints.id),
    )
    .where(
      accountId ? eq(automationInstallations.accountId, accountId) : eq(accounts.status, "active"),
    )
    .orderBy(asc(accounts.name), asc(automationBlueprints.name));

  return rows.map((row) => ({
    ...row,
    safetyLevel: displayLabel(row.safetyLevel),
    active: row.observedState === "active",
    linked:
      Boolean(row.workspaceId) &&
      row.runnerKey !== "unassigned" &&
      Boolean(row.externalWorkflowId) &&
      Boolean(row.configVersion),
  }));
}

export async function GET(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();

  try {
    const accountId = new URL(request.url).searchParams.get("accountId") ?? undefined;
    return Response.json(
      { workflows: await loadAutomations(accountId) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load automations", error);
    return Response.json(
      { error: "Unable to load automation records." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const normalized = normalizeAutomationInput(body);
    if (normalized.error || !normalized.value) {
      return Response.json({ error: normalized.error }, { status: 400 });
    }
    const value = normalized.value;
    const db = getDb();
    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, value.accountId))
      .limit(1);
    if (!account) {
      return Response.json({ error: "Account not found." }, { status: 404 });
    }
    if (value.runnerKey !== "unassigned" && value.externalWorkflowId) {
      const [duplicateHarnessLink] = await db
        .select({ id: automationInstallations.id })
        .from(automationInstallations)
        .where(
          and(
            eq(automationInstallations.accountId, value.accountId),
            eq(automationInstallations.runnerKey, value.runnerKey),
            eq(
              automationInstallations.externalWorkflowId,
              value.externalWorkflowId,
            ),
          ),
        )
        .limit(1);
      if (duplicateHarnessLink) {
        return Response.json(
          { error: "That harness workflow is already linked to this account." },
          { status: 409 },
        );
      }
    }
    const [workspace] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.accountId, value.accountId))
      .orderBy(asc(workspaces.createdAt))
      .limit(1);

    const blueprintId = newId("blueprint");
    const installationId = newId("installation");
    const now = new Date().toISOString();
    const key = `${slugify(value.name)}-${blueprintId.slice(-8).toLowerCase()}`;
    await db.batch([
      db.insert(automationBlueprints).values({
        id: blueprintId,
        accountId: value.accountId,
        scope: "bespoke",
        key,
        name: value.name,
        objective: value.objective,
        triggerSummary: value.triggerSummary,
        actionSummary: value.actionSummary,
        safetyLevel: value.safetyLevel,
        approvalRequired: value.approvalRequired,
        defaultRunner: value.runnerKey,
        acceptanceCriteria: value.acceptanceCriteria,
        lifecycle: "draft",
        updatedAt: now,
      }),
      db.insert(automationInstallations).values({
        id: installationId,
        accountId: value.accountId,
        workspaceId: workspace?.id,
        blueprintId,
        deliveryStage: value.runnerKey === "unassigned" ? "draft" : "building",
        runnerKey: value.runnerKey,
        externalWorkflowId: value.externalWorkflowId,
        configVersion: value.configVersion,
        desiredState: "paused",
        observedState: "unregistered",
        owner: value.owner,
        updatedAt: now,
      }),
      db.insert(operatorAuditEvents).values({
        id: newId("audit"),
        accountId: value.accountId,
        resourceType: "automation_installation",
        resourceId: installationId,
        action: "automation.created",
        ...auditActor(actor),
        result: "succeeded",
        detail: "Blueprint and paused installation created; no harness command issued",
      }),
    ]);

    const [workflow] = await loadAutomations(value.accountId).then((rows) =>
      rows.filter((row) => row.id === installationId),
    );
    return Response.json({ workflow }, { status: 201 });
  } catch (error) {
    console.error("Unable to create automation", error);
    return Response.json(
      { error: "Unable to create the automation record." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const db = getDb();
    const now = new Date().toISOString();

    if (body.pauseAll === true) {
      await db.batch([
        db
          .update(automationInstallations)
          .set({ desiredState: "paused", updatedAt: now })
          .where(ne(automationInstallations.desiredState, "retired")),
        db.insert(operatorAuditEvents).values({
          id: newId("audit"),
          accountId: null,
          resourceType: "automation_fleet",
          resourceId: "all",
          action: "automations.pause_all_requested",
          ...auditActor(actor),
          result: "recorded",
          detail: "All non-retired desired states set to paused; runtime acknowledgement pending",
        }),
      ]);
      return Response.json({ workflows: await loadAutomations() });
    }
    if (typeof body.pauseAll === "boolean") {
      return Response.json(
        { error: "Bulk resume is intentionally not supported." },
        { status: 400 },
      );
    }

    const id = String(body.id ?? "").trim();
    if (!id) {
      return Response.json({ error: "Invalid automation." }, { status: 400 });
    }
    const [existing] = await db
      .select()
      .from(automationInstallations)
      .where(eq(automationInstallations.id, id))
      .limit(1);
    if (!existing) {
      return Response.json({ error: "Automation not found." }, { status: 404 });
    }

    if (body.simulate === true) {
      return Response.json(
        {
          error:
            "A real safe test requires a harness adapter. No result was recorded.",
        },
        { status: 409 },
      );
    }

    const requestedDesiredState = typeof body.active === "boolean"
      ? body.active
        ? "active"
        : "paused"
      : typeof body.desiredState === "string"
        ? normalizeEnum(body.desiredState, DESIRED_STATES)
        : existing.desiredState;
    const requestedDeliveryStage = typeof body.deliveryStage === "string"
      ? normalizeEnum(body.deliveryStage, DELIVERY_STAGES)
      : existing.deliveryStage;
    if (!requestedDesiredState || !requestedDeliveryStage) {
      return Response.json(
        { error: "Invalid automation state." },
        { status: 400 },
      );
    }
    if (
      (existing.desiredState === "retired" ||
        existing.deliveryStage === "retired") &&
      (requestedDesiredState !== "retired" ||
        requestedDeliveryStage !== "retired")
    ) {
      return Response.json(
        { error: "A retired installation cannot be reopened." },
        { status: 409 },
      );
    }
    if (
      (requestedDesiredState === "retired") !==
      (requestedDeliveryStage === "retired")
    ) {
      return Response.json(
        {
          error:
            "Retirement must set both delivery stage and desired state to retired.",
        },
        { status: 409 },
      );
    }
    if (requestedDesiredState === "active") {
      const [[workspace], [blueprint]] = await Promise.all([
        existing.workspaceId
          ? db
              .select({ lifecycle: workspaces.lifecycle })
              .from(workspaces)
              .where(eq(workspaces.id, existing.workspaceId))
              .limit(1)
          : Promise.resolve([]),
        db
          .select({ lifecycle: automationBlueprints.lifecycle })
          .from(automationBlueprints)
          .where(eq(automationBlueprints.id, existing.blueprintId))
          .limit(1),
      ]);
      const blocker = activationBlocker({
        ...existing,
        deliveryStage: requestedDeliveryStage,
        workspaceLifecycle: workspace?.lifecycle,
        blueprintLifecycle: blueprint?.lifecycle,
      });
      if (blocker) {
        return Response.json({ error: blocker }, { status: 409 });
      }
    }

    await db.batch([
      db
        .update(automationInstallations)
        .set({
          desiredState: requestedDesiredState,
          deliveryStage: requestedDeliveryStage,
          updatedAt: now,
        })
        .where(eq(automationInstallations.id, id)),
      db.insert(operatorAuditEvents).values({
        id: newId("audit"),
        accountId: existing.accountId,
        resourceType: "automation_installation",
        resourceId: id,
        action: "automation.intent_updated",
        ...auditActor(actor),
        result: "recorded",
        detail: `Desired ${requestedDesiredState}; delivery ${requestedDeliveryStage}; observed state unchanged`,
      }),
    ]);

    const [workflow] = await loadAutomations(existing.accountId).then((rows) =>
      rows.filter((row) => row.id === id),
    );
    return Response.json({ workflow });
  } catch (error) {
    console.error("Unable to update automation", error);
    return Response.json(
      { error: "Unable to save the automation change." },
      { status: 500 },
    );
  }
}
