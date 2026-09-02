import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { approvals, auditEvents, clients } from "../../../db/schema";

const allowedTypes = new Set(["Email draft", "Call follow-up", "Appointment", "Client launch", "Workflow exception"]);
const allowedStatuses = new Set(["Pending", "Approved", "Rejected"]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const clientId = Number(url.searchParams.get("clientId"));
    const conditions = [];
    if (status && allowedStatuses.has(status)) conditions.push(eq(approvals.status, status));
    if (Number.isInteger(clientId) && clientId > 0) conditions.push(eq(approvals.clientId, clientId));
    const rows = await getDb().select({
      id: approvals.id,
      clientId: approvals.clientId,
      clientName: clients.companyName,
      type: approvals.type,
      title: approvals.title,
      summary: approvals.summary,
      riskLevel: approvals.riskLevel,
      status: approvals.status,
      requestedBy: approvals.requestedBy,
      decidedBy: approvals.decidedBy,
      decidedAt: approvals.decidedAt,
      createdAt: approvals.createdAt,
    }).from(approvals).innerJoin(clients, eq(approvals.clientId, clients.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(approvals.id));
    return Response.json({ approvals: rows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load approvals" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const clientId = Number(body.clientId);
    const type = String(body.type || "Call follow-up");
    const title = String(body.title || "").trim().slice(0, 160);
    const summary = String(body.summary || "").trim().slice(0, 2000);
    if (!Number.isInteger(clientId) || clientId < 1 || !title || !allowedTypes.has(type))
      return Response.json({ error: "A valid client, type, and title are required." }, { status: 400 });
    const db = getDb();
    const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) return Response.json({ error: "Client not found." }, { status: 404 });
    const [approval] = await db.insert(approvals).values({ clientId, type, title, summary, riskLevel: "Supervised" }).returning();
    await db.insert(auditEvents).values({ clientId, approvalId: approval.id, action: "Approval requested", actor: "Cipher", result: "Pending", detail: title });
    return Response.json({ approval }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create approval" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    const status = String(body.status || "");
    if (!Number.isInteger(id) || id < 1 || !["Approved", "Rejected"].includes(status))
      return Response.json({ error: "A valid approval decision is required." }, { status: 400 });
    const db = getDb();
    const [existing] = await db.select().from(approvals).where(eq(approvals.id, id)).limit(1);
    if (!existing) return Response.json({ error: "Approval not found." }, { status: 404 });
    if (existing.status !== "Pending") return Response.json({ error: "This request has already been decided." }, { status: 409 });
    const now = new Date().toISOString();
    const [approval] = await db.update(approvals).set({ status, decidedBy: "Derek Manchego", decidedAt: now, updatedAt: now }).where(and(eq(approvals.id, id), eq(approvals.status, "Pending"))).returning();
    if (!approval) return Response.json({ error: "Approval changed before this decision could be saved." }, { status: 409 });
    await db.insert(auditEvents).values({ clientId: existing.clientId, approvalId: id, action: "Approval decided", actor: "Derek Manchego", result: status, detail: existing.title });
    return Response.json({ approval });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save decision" }, { status: 500 });
  }
}
