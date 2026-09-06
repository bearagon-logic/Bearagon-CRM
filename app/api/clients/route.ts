import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  accountContacts,
  accounts,
  contacts,
  engagements,
  onboardingTasks,
  operatorAuditEvents,
  workspaces,
} from "../../../db/schema";
import {
  displayLabel,
  newId,
  normalizeAccountInput,
} from "../../../lib/ops-domain.mjs";
import { onboardingTemplate } from "../../../lib/server/onboarding-template";
import {
  auditActor,
  getOperatorIdentity,
  operatorRequiredResponse,
} from "../../../lib/server/operator-auth";

const activeEngagementStatuses = ["planned", "active", "blocked"];

export async function GET(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();

  try {
    const db = getDb();
    const [accountRows, engagementRows, contactRows, workspaceRows, taskRows] =
      await Promise.all([
        db.select().from(accounts).orderBy(asc(accounts.name)),
        db
          .select()
          .from(engagements)
          .where(eq(engagements.kind, "onboarding"))
          .orderBy(desc(engagements.createdAt)),
        db
          .select({
            accountId: accountContacts.accountId,
            displayName: contacts.displayName,
            email: contacts.email,
            phone: contacts.phone,
          })
          .from(accountContacts)
          .innerJoin(contacts, eq(accountContacts.contactId, contacts.id))
          .where(eq(accountContacts.isPrimary, true)),
        db.select().from(workspaces).orderBy(desc(workspaces.createdAt)),
        db
          .select({
            engagementId: onboardingTasks.engagementId,
            status: onboardingTasks.status,
          })
          .from(onboardingTasks),
      ]);

    const latestEngagementByAccount = new Map();
    for (const engagement of engagementRows) {
      if (!latestEngagementByAccount.has(engagement.accountId)) {
        latestEngagementByAccount.set(engagement.accountId, engagement);
      }
    }
    const activeEngagementRows = engagementRows.filter((engagement) =>
      activeEngagementStatuses.includes(engagement.status),
    );
    const primaryContactByAccount = new Map(
      contactRows.map((contact) => [contact.accountId, contact]),
    );
    const workspaceByAccount = new Map();
    for (const workspace of workspaceRows) {
      if (!workspaceByAccount.has(workspace.accountId)) {
        workspaceByAccount.set(workspace.accountId, workspace);
      }
    }
    const accountByEngagement = new Map(
      activeEngagementRows.map((engagement) => [engagement.id, engagement.accountId]),
    );
    const openTasksByAccount = new Map<string, number>();
    for (const task of taskRows) {
      if (["completed", "skipped"].includes(task.status)) continue;
      const accountId = accountByEngagement.get(task.engagementId);
      if (!accountId) continue;
      openTasksByAccount.set(accountId, (openTasksByAccount.get(accountId) ?? 0) + 1);
    }

    const clients = accountRows.map((account) => {
      const engagement = latestEngagementByAccount.get(account.id);
      const contact = primaryContactByAccount.get(account.id);
      const workspace = workspaceByAccount.get(account.id);
      return {
        id: account.id,
        companyName: account.name,
        contactName: contact?.displayName ?? "No primary contact",
        email: contact?.email ?? "",
        phone: contact?.phone ?? "",
        relationshipType: account.relationshipType,
        organizationKind: account.organizationKind,
        salesStage: account.salesStage,
        relationshipOwner: account.relationshipOwner,
        stage: engagement ? displayLabel(engagement.stage) : "Not started",
        onboardingStatus: engagement?.status ?? "not_started",
        nextStep: engagement?.nextStep ?? (account.relationshipNextAction || "Set a follow-up"),
        dueDate: engagement?.targetDate ?? account.followUpDate,
        workspaceStatus: workspace?.lifecycle ?? "not_provisioned",
        openTasks: openTasksByAccount.get(account.id) ?? 0,
        createdAt: account.createdAt,
      };
    });

    return Response.json(
      { clients },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load accounts", error);
    return Response.json(
      { error: "Unable to load account records." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const normalized = normalizeAccountInput(body);
    if (normalized.error || !normalized.value) {
      return Response.json({ error: normalized.error }, { status: 400 });
    }

    const value = normalized.value;
    const db = getDb();
    const accountId = newId("acct");
    const engagementId = newId("eng");
    const now = new Date().toISOString();
    const relationshipType = value.startOnboarding
      ? "client"
      : value.relationshipType;
    const [existingContact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.emailNormalized, value.email))
      .limit(1);
    const contactId = existingContact?.id ?? newId("contact");
    const canonicalContact = existingContact ?? {
      displayName: value.contactName,
      email: value.email,
      phone: value.phone,
    };

    const accountStatement = db.insert(accounts).values({
      id: accountId,
      name: value.companyName,
      relationshipType,
      updatedAt: now,
    });
    const contactStatement = db.insert(contacts).values({
      id: contactId,
      displayName: value.contactName,
      email: value.email,
      emailNormalized: value.email,
      phone: value.phone,
      updatedAt: now,
    });
    const relationshipStatement = db.insert(accountContacts).values({
      accountId,
      contactId,
      relationshipRole: "decision_maker",
      isPrimary: true,
    });
    const engagementStatement = db.insert(engagements).values({
      id: engagementId,
      accountId,
      kind: "onboarding",
      status: "active",
      stage: value.stage,
      targetDate: value.targetDate,
      updatedAt: now,
    });
    const taskStatement = db.insert(onboardingTasks).values(
          onboardingTemplate.map((task, index) => ({
            id: newId("task"),
            engagementId,
            templateKey: task.key,
            title: task.title,
            description: task.description,
            sortOrder: index + 1,
        updatedAt: now,
      })),
    );
    const auditStatement = db.insert(operatorAuditEvents).values({
      id: newId("audit"),
      accountId,
      resourceType: "account",
      resourceId: accountId,
      action: "account.created",
      ...auditActor(actor),
      result: "succeeded",
      detail: value.startOnboarding
        ? "Created client account and started onboarding"
        : `Created ${relationshipType} account without provisioning or onboarding`,
    });

    if (existingContact && value.startOnboarding) {
      await db.batch([
        accountStatement,
        relationshipStatement,
        engagementStatement,
        taskStatement,
        auditStatement,
      ]);
    } else if (existingContact) {
      await db.batch([
        accountStatement,
        relationshipStatement,
        auditStatement,
      ]);
    } else if (value.startOnboarding) {
      await db.batch([
        accountStatement,
        contactStatement,
        relationshipStatement,
        engagementStatement,
        taskStatement,
        auditStatement,
      ]);
    } else {
      await db.batch([
        accountStatement,
        contactStatement,
        relationshipStatement,
        auditStatement,
      ]);
    }

    return Response.json(
      {
        client: {
          id: accountId,
          companyName: value.companyName,
          contactName: canonicalContact.displayName,
          email: canonicalContact.email,
          phone: canonicalContact.phone,
          relationshipType,
          stage: value.startOnboarding ? displayLabel(value.stage) : "Not started",
          onboardingStatus: value.startOnboarding ? "active" : "not_started",
          nextStep: value.startOnboarding
            ? "Complete discovery form"
            : "Start onboarding",
          dueDate: value.startOnboarding ? value.targetDate : "",
          workspaceStatus: "not_provisioned",
          openTasks: value.startOnboarding ? onboardingTemplate.length : 0,
          contactReused: Boolean(existingContact),
          createdAt: now,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unable to create account", error);
    return Response.json(
      { error: "Unable to create the account. Please try again." },
      { status: 500 },
    );
  }
}
