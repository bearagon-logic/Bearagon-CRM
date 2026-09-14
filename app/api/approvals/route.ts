import {canReviewRemoval,decideCompanyRemoval,companyRemovalType} from '@/lib/server/company-removal';
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, getRawDb } from "../../../db";
import {
  accounts,
  automationInstallations,
  decisionRequests,
  operatorAuditEvents,
} from "../../../db/schema";
import { displayLabel, newId } from "../../../lib/ops-domain.mjs";
import {
  auditActor,
  getOperatorIdentity,
  operatorRequiredResponse,
} from "../../../lib/server/operator-auth";

const allowedTypes = new Set([
  "Client launch",
  "Automation activation",
  "Delivery exception",
]);
const allowedStatuses = new Set(["pending", "approved", "rejected"]);

export async function GET(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();

  try {
    const url = new URL(request.url);
    const requestedStatus = url.searchParams.get("status")?.toLowerCase();
    const accountId = url.searchParams.get("clientId")?.trim();
    const conditions = [sql`(${accounts.status} <> 'archived' OR ${decisionRequests.type} = 'Company removal' OR ${decisionRequests.status} <> 'pending')`];
    if (requestedStatus && allowedStatuses.has(requestedStatus)) {
      conditions.push(eq(decisionRequests.status, requestedStatus));
    }
    if (accountId) conditions.push(eq(decisionRequests.accountId, accountId));

    const rows = await getDb()
      .select({
        id: decisionRequests.id,
        clientId: decisionRequests.accountId,
        clientName: accounts.name,
        type: decisionRequests.type,
        title: decisionRequests.title,
        summary: decisionRequests.summary,
        riskLevel: decisionRequests.riskLevel,
        status: decisionRequests.status,
        requesterId: decisionRequests.requesterId,
        requesterEmail: decisionRequests.requesterEmail,
        reviewerEmail: decisionRequests.reviewerEmail,
        removalKind: decisionRequests.removalKind,
        requestedBy: decisionRequests.requestedBy,
        decidedBy: decisionRequests.decidedBy,
        decidedAt: decisionRequests.decidedAt,
        createdAt: decisionRequests.createdAt,
      })
      .from(decisionRequests)
      .innerJoin(accounts, eq(decisionRequests.accountId, accounts.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(decisionRequests.createdAt));

    return Response.json(
      {
        approvals: rows.map((row) => ({
          ...row,
          canDecide: row.type!==companyRemovalType||canReviewRemoval({requester_id:row.requesterId,requester_email:row.requesterEmail,reviewer_email:row.reviewerEmail},actor),
          assignedToMe: row.reviewerEmail.toLowerCase()===actor.email.toLowerCase(),
          riskLevel: displayLabel(row.riskLevel),
          status: displayLabel(row.status),
        })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load decision requests", error);
    return Response.json(
      { error: "Unable to load approval requests." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const accountId = String(body.clientId ?? body.accountId ?? "").trim();
    const type = String(body.type ?? "");
    const title = String(body.title ?? "").trim().slice(0, 160);
    const summary = String(body.summary ?? "").trim().slice(0, 2000);
    const installationId = String(body.installationId ?? "").trim() || null;
    const requestKey = String(
      body.requestKey ?? body.idempotencyKey ?? "",
    ).trim().slice(0, 160);
    if (!accountId || !title || !allowedTypes.has(type) || !requestKey) {
      return Response.json(
        {
          error:
            "A valid account, type, title, and idempotency key are required.",
        },
        { status: 400 },
      );
    }

    const db = getDb();
    const [existingRequest] = await db
      .select()
      .from(decisionRequests)
      .where(eq(decisionRequests.requestKey, requestKey))
      .limit(1);
    if (existingRequest) {
      const sameRequest =
        existingRequest.accountId === accountId &&
        existingRequest.installationId === installationId &&
        existingRequest.type === type &&
        existingRequest.title === title;
      if (!sameRequest) {
        return Response.json(
          { error: "That idempotency key belongs to another request." },
          { status: 409 },
        );
      }
      return Response.json({
        approval: {
          id: existingRequest.id,
          clientId: existingRequest.accountId,
          installationId: existingRequest.installationId,
          type: existingRequest.type,
          title: existingRequest.title,
          summary: existingRequest.summary,
          riskLevel: displayLabel(existingRequest.riskLevel),
          status: displayLabel(existingRequest.status),
          requestedBy: existingRequest.requestedBy,
          decidedBy: existingRequest.decidedBy,
          decidedAt: existingRequest.decidedAt,
        },
      });
    }
    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    if (!account) {
      return Response.json({ error: "Account not found." }, { status: 404 });
    }
    if (type === "Automation activation" && !installationId) {
      return Response.json(
        { error: "Automation activation requests require an installation." },
        { status: 400 },
      );
    }
    if (installationId) {
      const [installation] = await db
        .select({ id: automationInstallations.id })
        .from(automationInstallations)
        .where(
          and(
            eq(automationInstallations.id, installationId),
            eq(automationInstallations.accountId, accountId),
          ),
        )
        .limit(1);
      if (!installation) {
        return Response.json(
          { error: "Installation does not belong to this account." },
          { status: 400 },
        );
      }
      const [pendingRequest] = await db
        .select({ id: decisionRequests.id })
        .from(decisionRequests)
        .where(
          and(
            eq(decisionRequests.installationId, installationId),
            eq(decisionRequests.type, type),
            eq(decisionRequests.status, "pending"),
          ),
        )
        .limit(1);
      if (pendingRequest) {
        return Response.json(
          { error: "This installation already has a pending request of that type." },
          { status: 409 },
        );
      }
    }

    const id = newId("decision");
    await db.batch([
      db.insert(decisionRequests).values({
        id,
        accountId,
        installationId,
        type,
        requestKey,
        title,
        summary,
        riskLevel: "supervised",
        status: "pending",
        requestedBy: actor.displayName,
      }),
      db.insert(operatorAuditEvents).values({
        id: newId("audit"),
        accountId,
        resourceType: "decision_request",
        resourceId: id,
        action: "decision.requested",
        ...auditActor(actor),
        result: "pending",
        detail: title,
      }),
    ]);
    return Response.json(
      {
        approval: {
          id,
          clientId: accountId,
          installationId,
          type,
          title,
          summary,
          riskLevel: "Supervised",
          status: "Pending",
          requestedBy: actor.displayName,
          decidedBy: "",
          decidedAt: "",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unable to create decision request", error);
    return Response.json(
      { error: "Unable to create the approval request." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const status = String(body.status ?? "").trim().toLowerCase();
    if (!id || !["approved", "rejected"].includes(status)) {
      return Response.json(
        { error: "A valid approval decision is required." },
        { status: 400 },
      );
    }

    const db = getDb();
    const [existing] = await db
      .select()
      .from(decisionRequests)
      .where(eq(decisionRequests.id, id))
      .limit(1);
    if (!existing) {
      return Response.json({ error: "Approval not found." }, { status: 404 });
    }
    if(existing.type===companyRemovalType){
      const result=await decideCompanyRemoval(getRawDb(),id,status as 'approved'|'rejected',actor);
      return Response.json(result,{status:result.status});
    }
    const [targetAccount]=await db.select({status:accounts.status}).from(accounts).where(eq(accounts.id,existing.accountId)).limit(1);
    if(!targetAccount||targetAccount.status==='archived')return Response.json({error:'This company is archived. Its pending workflow decisions cannot be changed.'},{status:409});
    if (existing.status !== "pending") {
      return Response.json(
        { error: "This request has already been decided." },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const auditId = newId("audit");
    const audit = auditActor(actor);
    await db.batch([
      db
        .update(decisionRequests)
        .set({
          status,
          decidedBy: actor.displayName,
          decidedAt: now,
          decisionNonce: auditId,
          updatedAt: now,
        })
        .where(
          and(
            eq(decisionRequests.id, id),
            eq(decisionRequests.status, "pending"),
          ),
        ),
      db.insert(operatorAuditEvents).select(
        db
          .select({
            id: sql<string>`${auditId}`.as("id"),
            accountId: decisionRequests.accountId,
            resourceType: sql<string>`'decision_request'`.as("resource_type"),
            resourceId: decisionRequests.id,
            action: sql<string>`'decision.decided'`.as("action"),
            actorId: sql<string>`${audit.actorId}`.as("actor_id"),
            actorEmail: sql<string>`${audit.actorEmail}`.as("actor_email"),
            actorName: sql<string>`${audit.actorName}`.as("actor_name"),
            result: decisionRequests.status,
            detail: decisionRequests.title,
            createdAt: sql<string>`CURRENT_TIMESTAMP`.as("created_at"),
          })
          .from(decisionRequests)
          .where(
            and(
              eq(decisionRequests.id, id),
              eq(decisionRequests.decisionNonce, auditId),
            ),
          ),
      ),
    ]);
    const [[approval], [savedAudit]] = await Promise.all([
      db
        .select()
        .from(decisionRequests)
        .where(eq(decisionRequests.id, id))
        .limit(1),
      db
        .select({ id: operatorAuditEvents.id })
        .from(operatorAuditEvents)
        .where(eq(operatorAuditEvents.id, auditId))
        .limit(1),
    ]);
    if (!savedAudit || approval.decisionNonce !== auditId) {
      return Response.json(
        { error: "Approval changed before this decision could be saved." },
        { status: 409 },
      );
    }

    return Response.json({
      approval: {
        id: approval.id,
        clientId: approval.accountId,
        installationId: approval.installationId,
        type: approval.type,
        title: approval.title,
        summary: approval.summary,
        status: displayLabel(approval.status),
        riskLevel: displayLabel(approval.riskLevel),
        requestedBy: approval.requestedBy,
        decidedBy: approval.decidedBy,
        decidedAt: approval.decidedAt,
        createdAt: approval.createdAt,
      },
    });
  } catch (error) {
    console.error("Unable to save decision", error);
    return Response.json(
      { error: "Unable to save the approval decision." },
      { status: 500 },
    );
  }
}
