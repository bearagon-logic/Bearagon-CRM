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
import {
  isTerminalTaskStatus,
  onboardingTaskStatuses,
  onboardingTemplate,
  requirementsForStage,
  taskTemplate,
} from "../../../../lib/server/onboarding-template";
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
      salesStage: account.salesStage,
      relationshipOwner: account.relationshipOwner,
      followUpDate: account.followUpDate,
      relationshipNextAction: account.relationshipNextAction,
      organizationKind: account.organizationKind,
      stage: engagement ? displayLabel(engagement.stage) : "Not started",
      onboardingStatus: engagement?.status ?? "not_started",
      nextStep: engagement?.nextStep ?? "Start onboarding",
      dueDate: engagement?.targetDate ?? "",
      notes: account.notes,
      website: account.website,
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
          .set({ relationshipType: account.organizationKind === "internal" ? "other" : "client", updatedAt: now })
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
            description: task.description,
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
      const detail = await loadAccountDetail(id);
      return Response.json({ workspace, activity: detail?.activity ?? [] });
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
      const requestedStatus =
        typeof body.status === "string"
          ? body.status
          : body.completed === true
            ? "completed"
            : body.completed === false
              ? "pending"
              : null;
      if (!requestedStatus || !onboardingTaskStatuses.includes(requestedStatus as never)) {
        return Response.json({ error: "Choose a valid task status." }, { status: 400 });
      }
      const [task] = await db
        .select({
          id: onboardingTasks.id,
          engagementId: onboardingTasks.engagementId,
          templateKey: onboardingTasks.templateKey,
          title: onboardingTasks.title,
          evidenceRef: onboardingTasks.evidenceRef,
          completionNote: onboardingTasks.completionNote,
          blockedReason: onboardingTasks.blockedReason,
          engagementStatus: engagements.status,
          engagementNextStep: engagements.nextStep,
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
      if (task.templateKey.startsWith("scope:")) {
        return Response.json({ error: "Use Guided setup to update this work order, so evidence stays tied to the current setup revision." }, { status: 409 });
      }
      if (!activeEngagementStatuses.includes(task.engagementStatus)) {
        return Response.json(
          { error: "This onboarding is closed and its tasks can no longer be changed." },
          { status: 409 },
        );
      }
      const evidenceRef =
        typeof body.evidenceRef === "string"
          ? body.evidenceRef.trim().slice(0, 1000)
          : task.evidenceRef;
      const completionNote =
        typeof body.completionNote === "string"
          ? body.completionNote.trim().slice(0, 3000)
          : task.completionNote;
      const blockedReason =
        typeof body.blockedReason === "string"
          ? body.blockedReason.trim().slice(0, 3000)
          : task.blockedReason;
      if (requestedStatus === "completed" && !evidenceRef && !completionNote) {
        return Response.json(
          { error: "Add a completion note or evidence reference before completing this task." },
          { status: 400 },
        );
      }
      if (requestedStatus === "blocked" && !blockedReason) {
        return Response.json(
          { error: "Explain what is blocking this task before saving it as blocked." },
          { status: 400 },
        );
      }
      if (requestedStatus === "skipped" && !completionNote) {
        return Response.json(
          { error: "Document the approved exception before skipping this task." },
          { status: 400 },
        );
      }

      const allTasks = await db
        .select()
        .from(onboardingTasks)
        .where(eq(onboardingTasks.engagementId, task.engagementId));
      const template = taskTemplate(task.templateKey);
      const statusByKey = new Map(allTasks.map((item) => [item.templateKey, item.status]));
      const unmetDependencies = (template?.dependsOn ?? []).filter(
        (key) => !isTerminalTaskStatus(statusByKey.get(key) ?? "pending"),
      );
      if (requestedStatus === "completed" && unmetDependencies.length > 0) {
        const names = unmetDependencies.map((key) => taskTemplate(key)?.title ?? key);
        return Response.json(
          { error: `Complete ${names.join(" and ")} before completing this task.` },
          { status: 409 },
        );
      }
      const plannedTasks = allTasks.map((item) =>
        item.id === task.id ? { ...item, status: requestedStatus } : item,
      );
      const nextOpenTask = plannedTasks.find(
        (item) => !isTerminalTaskStatus(item.status),
      );
      const nextStep = nextOpenTask?.title ?? "Review onboarding readiness";
      await db.batch([
        db
          .update(onboardingTasks)
          .set({
            status: requestedStatus,
            evidenceRef,
            completionNote,
            blockedReason,
            completedAt: requestedStatus === "completed" ? now : "",
            updatedAt: now,
          })
          .where(eq(onboardingTasks.id, task.id)),
        db
          .update(engagements)
          .set({ nextStep, updatedAt: now })
          .where(eq(engagements.id, task.engagementId)),
        db.insert(operatorAuditEvents).values({
          id: newId("audit"),
          accountId: id,
          resourceType: "onboarding_task",
          resourceId: task.id,
          action: `onboarding_task.${requestedStatus}`,
          ...auditActor(actor),
          result: "succeeded",
          detail: `${task.title}: ${requestedStatus}${evidenceRef ? `; evidence ${evidenceRef}` : ""}`,
        }),
      ]);
      const [updatedTask] = await db
        .select()
        .from(onboardingTasks)
        .where(eq(onboardingTasks.id, task.id))
        .limit(1);
      const detail = await loadAccountDetail(id);
      return Response.json({
        task: { ...updatedTask, completed: updatedTask.status === "completed" },
        client: detail?.client,
        activity: detail?.activity ?? [],
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
      if (
        typeof body.stage === "string" ||
        typeof body.nextStep === "string" ||
        typeof body.targetDate === "string" ||
        body.completeOnboarding === true
      ) {
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

    if (body.completeOnboarding === true) {
      const taskRows = await db
        .select()
        .from(onboardingTasks)
        .where(eq(onboardingTasks.engagementId, engagement.id));
      const incomplete = taskRows.filter(
        (task) => !isTerminalTaskStatus(task.status),
      );
      if (incomplete.length > 0) {
        return Response.json(
          { error: "Resolve every onboarding requirement before completing onboarding." },
          { status: 409 },
        );
      }
      if (engagement.stage !== "live") {
        return Response.json(
          { error: "Move the account to Live before completing onboarding." },
          { status: 409 },
        );
      }
      await db.batch([
        db
          .update(engagements)
          .set({
            status: "completed",
            completedAt: now,
            nextStep: "Onboarding completed",
            updatedAt: now,
          })
          .where(eq(engagements.id, engagement.id)),
        db.insert(operatorAuditEvents).values({
          id: newId("audit"),
          accountId: id,
          resourceType: "engagement",
          resourceId: engagement.id,
          action: "onboarding.completed",
          ...auditActor(actor),
          result: "succeeded",
          detail: "Completed onboarding after all requirements reached a terminal state",
        }),
      ]);
      const detail = await loadAccountDetail(id);
      return Response.json(detail, { headers: { "cache-control": "no-store" } });
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
    const requiredTasks = requirementsForStage(stage);
    if (requiredTasks.length > 0) {
      const taskRows = await db
        .select({ templateKey: onboardingTasks.templateKey, status: onboardingTasks.status })
        .from(onboardingTasks)
        .where(eq(onboardingTasks.engagementId, engagement.id));
      const statusByKey = new Map(taskRows.map((task) => [task.templateKey, task.status]));
      const missing = requiredTasks.filter(
        (key) => !isTerminalTaskStatus(statusByKey.get(key) ?? "pending"),
      );
      if (missing.length > 0) {
        return Response.json(
          {
            error: `Resolve ${missing
              .map((key) => taskTemplate(key)?.title ?? key)
              .join(" and ")} before moving this account to ${displayLabel(stage)}.`,
          },
          { status: 409 },
        );
      }
    }
    const nextStep =
      typeof body.nextStep === "string"
        ? body.nextStep.trim().slice(0, 300)
        : engagement.nextStep;
    const targetDate =
      typeof body.targetDate === "string"
        ? body.targetDate.trim().slice(0, 10)
        : engagement.targetDate;
    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return Response.json({ error: "Target date must use YYYY-MM-DD." }, { status: 400 });
    }

    await db.batch([
      db
        .update(accounts)
        .set({ notes, updatedAt: now })
        .where(eq(accounts.id, id)),
      db
        .update(engagements)
        .set({ stage, nextStep, targetDate, updatedAt: now })
        .where(eq(engagements.id, engagement.id)),
      db.insert(operatorAuditEvents).values({
        id: newId("audit"),
        accountId: id,
        resourceType: "engagement",
        resourceId: engagement.id,
        action: "engagement.updated",
        ...auditActor(actor),
        result: "succeeded",
        detail: `Stage ${stage}; next step ${nextStep || "not set"}; target ${targetDate || "not set"}`,
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
