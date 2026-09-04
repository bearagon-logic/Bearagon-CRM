import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  accountContacts,
  accounts,
  automationBlueprints,
  automationInstallations,
  contacts,
  engagements,
  onboardingTasks,
  operatorAuditEvents,
  workspaces,
} from "../../../../db/schema";
import {
  displayLabel,
  newId,
  normalizeEnum,
  ONBOARDING_STAGES,
  slugify,
} from "../../../../lib/ops-domain.mjs";
import { onboardingTemplate } from "../../../../lib/server/onboarding-template";
import {
  auditActor,
  getOperatorIdentity,
  operatorRequiredResponse,
} from "../../../../lib/server/operator-auth";

const activeEngagementStatuses = ["planned", "active", "blocked"];

async function accountId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const value = String(id ?? "").trim();
  return value.length >= 8 && value.length <= 80 ? value : null;
}

async function loadAccountDetail(id: string) {
  const db = getDb();
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!account) return null;

  const [contactRows, engagementRows, workspaceRows, installationRows, activity] =
    await Promise.all([
      db
        .select({
          id: contacts.id,
          displayName: contacts.displayName,
          email: contacts.email,
          phone: contacts.phone,
          jobTitle: contacts.jobTitle,
          relationshipRole: accountContacts.relationshipRole,
          isPrimary: accountContacts.isPrimary,
        })
        .from(accountContacts)
        .innerJoin(contacts, eq(accountContacts.contactId, contacts.id))
        .where(eq(accountContacts.accountId, id))
        .orderBy(desc(accountContacts.isPrimary), asc(contacts.displayName)),
      db
        .select()
        .from(engagements)
        .where(
          and(
            eq(engagements.accountId, id),
            eq(engagements.kind, "onboarding"),
            inArray(engagements.status, activeEngagementStatuses),
          ),
        )
        .orderBy(desc(engagements.createdAt)),
      db
        .select()
        .from(workspaces)
        .where(eq(workspaces.accountId, id))
        .orderBy(desc(workspaces.createdAt)),
      db
        .select({
          id: automationInstallations.id,
          name: automationBlueprints.name,
          description: automationBlueprints.objective,
          trigger: automationBlueprints.triggerSummary,
          action: automationBlueprints.actionSummary,
          safetyLevel: automationBlueprints.safetyLevel,
          approvalRequired: automationBlueprints.approvalRequired,
          deliveryStage: automationInstallations.deliveryStage,
          desiredState: automationInstallations.desiredState,
          observedState: automationInstallations.observedState,
          runnerKey: automationInstallations.runnerKey,
          externalWorkflowId: automationInstallations.externalWorkflowId,
          configVersion: automationInstallations.configVersion,
          lastObservedAt: automationInstallations.lastObservedAt,
          lastRunStatus: automationInstallations.lastRunStatus,
          lastRunAt: automationInstallations.lastRunAt,
          failureCount: automationInstallations.failureCount,
        })
        .from(automationInstallations)
        .innerJoin(
          automationBlueprints,
          eq(automationInstallations.blueprintId, automationBlueprints.id),
        )
        .where(eq(automationInstallations.accountId, id))
        .orderBy(asc(automationBlueprints.name)),
      db
        .select()
        .from(operatorAuditEvents)
        .where(eq(operatorAuditEvents.accountId, id))
        .orderBy(desc(operatorAuditEvents.createdAt))
        .limit(30),
    ]);

  const engagement = engagementRows[0] ?? null;
  const primaryContact =
    contactRows.find((contact) => contact.isPrimary) ?? contactRows[0] ?? null;
  const taskRows = engagement
    ? await db
        .select()
        .from(onboardingTasks)
        .where(eq(onboardingTasks.engagementId, engagement.id))
        .orderBy(asc(onboardingTasks.sortOrder))
    : [];

  return {
    client: {
      id: account.id,
      companyName: account.name,
      contactName: primaryContact?.displayName ?? "",
      email: primaryContact?.email ?? "",
      phone: primaryContact?.phone ?? "",
      relationshipType: account.relationshipType,
      stage: engagement ? displayLabel(engagement.stage) : "Not started",
      nextStep: engagement?.nextStep ?? "Start onboarding",
      dueDate: engagement?.targetDate ?? "",
      notes: account.notes,
    },
    contacts: contactRows,
    engagement,
    tasks: taskRows.map((task) => ({
      ...task,
      completed: task.status === "completed",
    })),
    workspaces: workspaceRows,
    workspace: workspaceRows[0] ?? null,
    workflows: installationRows.map((installation) => ({
      ...installation,
      safetyLevel: displayLabel(installation.safetyLevel),
      active: installation.observedState === "active",
      linked:
        installation.runnerKey !== "unassigned" &&
        Boolean(installation.externalWorkflowId) &&
        Boolean(installation.configVersion),
    })),
    activity,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  const id = await accountId(params);
  if (!id) return Response.json({ error: "Invalid account." }, { status: 400 });

  try {
    const detail = await loadAccountDetail(id);
    return detail
      ? Response.json(detail, { headers: { "cache-control": "no-store" } })
      : Response.json({ error: "Account not found." }, { status: 404 });
  } catch (error) {
    console.error("Unable to load account", error);
    return Response.json(
      { error: "Unable to load the account workspace." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  const id = await accountId(params);
  if (!id) return Response.json({ error: "Invalid account." }, { status: 400 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const db = getDb();
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))
      .limit(1);
    if (!account) {
      return Response.json({ error: "Account not found." }, { status: 404 });
    }
    const now = new Date().toISOString();

    if (body.startOnboarding === true) {
      const [existingOnboarding] = await db
        .select({ id: engagements.id, status: engagements.status })
        .from(engagements)
        .where(
          and(
            eq(engagements.accountId, id),
            eq(engagements.kind, "onboarding"),
          ),
        )
        .limit(1);
      if (existingOnboarding) {
        if (activeEngagementStatuses.includes(existingOnboarding.status)) {
          const detail = await loadAccountDetail(id);
          return Response.json(detail, {
            headers: { "cache-control": "no-store" },
          });
        }
        return Response.json(
          {
            error:
              "A prior onboarding engagement is closed; starting another requires a new engagement decision.",
          },
          { status: 409 },
        );
      }

      const engagementId = newId("eng");
      await db.batch([
        db
          .update(accounts)
          .set({ relationshipType: "client", updatedAt: now })
          .where(eq(accounts.id, id)),
        db.insert(engagements).values({
          id: engagementId,
          accountId: id,
          kind: "onboarding",
          status: "active",
          stage: "intake",
          nextStep: "Complete discovery form",
          updatedAt: now,
        }),
        db.insert(onboardingTasks).values(
          onboardingTemplate.map((task, index) => ({
            id: newId("task"),
            engagementId,
            templateKey: task.key,
            title: task.title,
            sortOrder: index + 1,
            updatedAt: now,
          })),
        ),
        db.insert(operatorAuditEvents).values({
          id: newId("audit"),
          accountId: id,
          resourceType: "engagement",
          resourceId: engagementId,
          action: "onboarding.started",
          ...auditActor(actor),
          result: "succeeded",
          detail: "Created the onboarding engagement and standard checklist",
        }),
      ]);
      const detail = await loadAccountDetail(id);
      return Response.json(detail, { status: 201 });
    }

    if (body.requestWorkspace === true) {
      const [existing] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.accountId, id))
        .limit(1);
      if (existing) return Response.json({ workspace: existing });

      const workspaceId = newId("workspace");
      const workspace = {
        id: workspaceId,
        accountId: id,
        slug: `${slugify(account.name)}-${id.slice(-6).toLowerCase()}`,
        displayName: account.name,
        lifecycle: "requested",
        updatedAt: now,
      };
      await db.batch([
        db.insert(workspaces).values(workspace),
        db
          .update(automationInstallations)
          .set({ workspaceId, updatedAt: now })
          .where(
            and(
              eq(automationInstallations.accountId, id),
              isNull(automationInstallations.workspaceId),
            ),
          ),
        db.insert(operatorAuditEvents).values({
          id: newId("audit"),
          accountId: id,
          resourceType: "workspace",
          resourceId: workspaceId,
          action: "workspace.requested",
          ...auditActor(actor),
          result: "succeeded",
          detail: "Requested an operational workspace; no Console tenant was provisioned",
        }),
      ]);
      return Response.json({ workspace });
    }

    if (body.pauseWorkflows === true) {
      await db.batch([
        db
          .update(automationInstallations)
          .set({ desiredState: "paused", updatedAt: now })
          .where(
            and(
              eq(automationInstallations.accountId, id),
              ne(automationInstallations.desiredState, "retired"),
            ),
          ),
        db.insert(operatorAuditEvents).values({
          id: newId("audit"),
          accountId: id,
          resourceType: "account",
          resourceId: id,
          action: "automations.pause_requested",
          ...auditActor(actor),
          result: "recorded",
          detail: "Desired state set to paused; observed runtime state was not changed",
        }),
      ]);
      return Response.json({ desiredState: "paused" });
    }

    if (typeof body.taskId === "string") {
      if (typeof body.completed !== "boolean") {
        return Response.json(
          { error: "Task completion must be true or false." },
          { status: 400 },
        );
      }
      const [task] = await db
        .select({
          id: onboardingTasks.id,
          engagementId: onboardingTasks.engagementId,
        })
        .from(onboardingTasks)
        .innerJoin(
          engagements,
          eq(onboardingTasks.engagementId, engagements.id),
        )
        .where(
          and(
            eq(onboardingTasks.id, body.taskId),
            eq(engagements.accountId, id),
            eq(engagements.kind, "onboarding"),
          ),
        )
        .limit(1);
      if (!task) {
        return Response.json({ error: "Task not found." }, { status: 404 });
      }
      const completed = body.completed;
      await db.batch([
        db
          .update(onboardingTasks)
          .set({
            status: completed ? "completed" : "pending",
            completedAt: completed ? now : "",
            updatedAt: now,
          })
          .where(eq(onboardingTasks.id, task.id)),
        db.insert(operatorAuditEvents).values({
          id: newId("audit"),
          accountId: id,
          resourceType: "onboarding_task",
          resourceId: task.id,
          action: completed ? "onboarding_task.completed" : "onboarding_task.reopened",
          ...auditActor(actor),
          result: "succeeded",
          detail: "Onboarding checklist status changed",
        }),
      ]);
      const [updatedTask] = await db
        .select()
        .from(onboardingTasks)
        .where(eq(onboardingTasks.id, task.id))
        .limit(1);
      return Response.json({
        task: { ...updatedTask, completed: updatedTask.status === "completed" },
      });
    }

    const [engagement] = await db
      .select()
      .from(engagements)
      .where(
        and(
          eq(engagements.accountId, id),
          eq(engagements.kind, "onboarding"),
          inArray(engagements.status, activeEngagementStatuses),
        ),
      )
      .orderBy(desc(engagements.createdAt))
      .limit(1);
    const notes =
      typeof body.notes === "string"
        ? body.notes.trim().slice(0, 5000)
        : account.notes;
    if (!engagement) {
      if (typeof body.stage === "string" || typeof body.nextStep === "string") {
        return Response.json(
          { error: "Start onboarding before changing its stage or next step." },
          { status: 409 },
        );
      }
      if (typeof body.notes !== "string") {
        return Response.json(
          { error: "No supported account change was supplied." },
          { status: 400 },
        );
      }
      await db.batch([
        db
          .update(accounts)
          .set({ notes, updatedAt: now })
          .where(eq(accounts.id, id)),
        db.insert(operatorAuditEvents).values({
          id: newId("audit"),
          accountId: id,
          resourceType: "account",
          resourceId: id,
          action: "account.notes_updated",
          ...auditActor(actor),
          result: "succeeded",
          detail: "Account notes changed before onboarding",
        }),
      ]);
      const detail = await loadAccountDetail(id);
      return Response.json({ client: detail?.client });
    }
    const stage =
      typeof body.stage === "string"
        ? normalizeEnum(body.stage, ONBOARDING_STAGES, engagement.stage)
        : engagement.stage;
    if (!stage) {
      return Response.json(
        { error: "Invalid onboarding stage." },
        { status: 400 },
      );
    }
    const nextStep =
      typeof body.nextStep === "string"
        ? body.nextStep.trim().slice(0, 300)
        : engagement.nextStep;

    await db.batch([
      db
        .update(accounts)
        .set({ notes, updatedAt: now })
        .where(eq(accounts.id, id)),
      db
        .update(engagements)
        .set({ stage, nextStep, updatedAt: now })
        .where(eq(engagements.id, engagement.id)),
      db.insert(operatorAuditEvents).values({
        id: newId("audit"),
        accountId: id,
        resourceType: "engagement",
        resourceId: engagement.id,
        action: "engagement.updated",
        ...auditActor(actor),
        result: "succeeded",
        detail: `Stage ${stage}; next step ${nextStep || "not set"}`,
      }),
    ]);

    const detail = await loadAccountDetail(id);
    return Response.json({ client: detail?.client });
  } catch (error) {
    console.error("Unable to update account", error);
    return Response.json(
      { error: "Unable to save the account changes." },
      { status: 500 },
    );
  }
}
