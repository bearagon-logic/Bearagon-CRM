import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  accountContacts,
  accounts,
  contacts,
  engagements,
  onboardingTasks,
  accountProposals,
} from "../../../db/schema";
import { deliveryReadiness, type DeliveryRequirement } from "../../../lib/delivery-readiness";
import type { ProposalState } from "../../../lib/proposal-model";
import { displayLabel } from "../../../lib/ops-domain.mjs";
import {
  getOperatorIdentity,
  operatorRequiredResponse,
} from "../../../lib/server/operator-auth";

const activeStatuses = ["planned", "active", "blocked"];

export async function GET(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();

  try {
    const db = getDb();
    const [engagementRows, contactRows] = await Promise.all([
      db
        .select({
          id: engagements.id,
          accountId: engagements.accountId,
          accountName: accounts.name,
          organizationKind: accounts.organizationKind,
          stage: engagements.stage,
          status: engagements.status,
          nextStep: engagements.nextStep,
          targetDate: engagements.targetDate,
          owner: engagements.owner,
          createdAt: engagements.createdAt,
        })
        .from(engagements)
        .innerJoin(accounts, eq(engagements.accountId, accounts.id))
        .where(
          and(
            eq(engagements.kind, "onboarding"),
            inArray(engagements.status, activeStatuses),
          ),
        )
        .orderBy(asc(engagements.targetDate), asc(accounts.name)),
      db
        .select({
          accountId: accountContacts.accountId,
          displayName: contacts.displayName,
          email: contacts.email,
        })
        .from(accountContacts)
        .innerJoin(contacts, eq(accountContacts.contactId, contacts.id))
        .where(eq(accountContacts.isPrimary, true)),
    ]);

    const engagementIds = engagementRows.map((engagement) => engagement.id);
    const taskRows = engagementIds.length
      ? await db
        .select({
          engagementId: onboardingTasks.engagementId,
          id: onboardingTasks.id,
          templateKey: onboardingTasks.templateKey,
          title: onboardingTasks.title,
          status: onboardingTasks.status,
        })
        .from(onboardingTasks)
        .where(inArray(onboardingTasks.engagementId, engagementIds))
        .orderBy(asc(onboardingTasks.sortOrder), asc(onboardingTasks.id))
      : [];
    const accountIds = [...new Set(engagementRows.map(row => row.accountId))];
    const proposalRows = accountIds.length ? await db.select({ accountId: accountProposals.accountId, state: accountProposals.state })
      .from(accountProposals).where(inArray(accountProposals.accountId, accountIds)) : [];
    const proposals = new Map(proposalRows.map(row => [row.accountId, JSON.parse(row.state) as ProposalState]));
    const contactByAccount = new Map(
      contactRows.map((contact) => [contact.accountId, contact]),
    );
    const tasksByEngagement = new Map<string, DeliveryRequirement[]>();
    for (const task of taskRows) {
      const current = tasksByEngagement.get(task.engagementId) ?? [];
      current.push(task);
      tasksByEngagement.set(task.engagementId, current);
    }

    const onboardings = engagementRows.map((engagement) => {
      const readiness = deliveryReadiness(engagement.status, tasksByEngagement.get(engagement.id) ?? [], proposals.get(engagement.accountId) ?? null);
      const contact = contactByAccount.get(engagement.accountId);
      return {
        id: engagement.id,
        accountId: engagement.accountId,
        accountName: engagement.accountName,
        organizationKind: engagement.organizationKind,
        contactName: contact?.displayName ?? "No primary contact",
        contactEmail: contact?.email ?? "",
        stage: displayLabel(engagement.stage),
        status: engagement.status,
        nextStep: engagement.nextStep,
        targetDate: engagement.targetDate,
        owner: engagement.owner,
        createdAt: engagement.createdAt,
        readiness,
        total: readiness.total,
        complete: readiness.complete,
        open: readiness.open,
        blocked: readiness.blocked,
      };
    });

    return Response.json(
      { onboardings },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load onboarding queue", error);
    return Response.json(
      { error: "Unable to load onboarding work." },
      { status: 500 },
    );
  }
}
