import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  accountContacts,
  accounts,
  contacts,
  engagements,
  onboardingTasks,
} from "../../../db/schema";
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
          status: onboardingTasks.status,
        })
        .from(onboardingTasks)
        .where(inArray(onboardingTasks.engagementId, engagementIds))
      : [];
    const contactByAccount = new Map(
      contactRows.map((contact) => [contact.accountId, contact]),
    );
    const taskCounts = new Map<string, { total: number; complete: number; open: number; blocked: number }>();
    for (const task of taskRows) {
      const current = taskCounts.get(task.engagementId) ?? {
        total: 0,
        complete: 0,
        open: 0,
        blocked: 0,
      };
      current.total += 1;
      if (["completed", "skipped"].includes(task.status)) current.complete += 1;
      else current.open += 1;
      if (task.status === "blocked") current.blocked += 1;
      taskCounts.set(task.engagementId, current);
    }

    const onboardings = engagementRows.map((engagement) => {
      const counts = taskCounts.get(engagement.id) ?? {
        total: 0,
        complete: 0,
        open: 0,
        blocked: 0,
      };
      const contact = contactByAccount.get(engagement.accountId);
      return {
        id: engagement.id,
        accountId: engagement.accountId,
        accountName: engagement.accountName,
        contactName: contact?.displayName ?? "No primary contact",
        contactEmail: contact?.email ?? "",
        stage: displayLabel(engagement.stage),
        status: engagement.status,
        nextStep: engagement.nextStep,
        targetDate: engagement.targetDate,
        owner: engagement.owner,
        createdAt: engagement.createdAt,
        ...counts,
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
