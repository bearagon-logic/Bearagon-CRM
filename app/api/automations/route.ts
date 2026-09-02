import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { clients, workflows } from "../../../db/schema";

const starterWorkflows = [
  {
    name: "Website intake → Client record",
    description:
      "Validates a Bearagon.com submission and creates a new onboarding record.",
    trigger: "Verified website intake",
    action: "Create client and checklist",
    safetyLevel: "Automatic",
    approvalRequired: false,
  },
  {
    name: "Welcome email approval",
    description:
      "Prepares a personalized welcome email after a client record is created.",
    trigger: "New client created",
    action: "Draft welcome email",
    safetyLevel: "Supervised",
    approvalRequired: true,
  },
  {
    name: "Overdue onboarding alert",
    description:
      "Flags stalled clients and notifies the internal Bearagon team.",
    trigger: "Checklist item becomes overdue",
    action: "Create internal alert",
    safetyLevel: "Automatic",
    approvalRequired: false,
  },
  {
    name: "Client launch approval",
    description:
      "Prevents a client from moving to Live until a team member approves launch.",
    trigger: "Checklist reaches 100%",
    action: "Change client stage to Live",
    safetyLevel: "Restricted",
    approvalRequired: true,
  },
];

export async function GET() {
  const db = getDb();
  let rows = await db.select().from(workflows).orderBy(asc(workflows.id));
  if (!rows.length)
    rows = await db.insert(workflows).values(starterWorkflows).returning();
  return Response.json({ workflows: rows });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const clientId = Number(body.clientId),
      name = String(body.name || "").trim().slice(0, 120),
      description = String(body.description || "").trim().slice(0, 500),
      trigger = String(body.trigger || "").trim().slice(0, 200),
      action = String(body.action || "").trim().slice(0, 200),
      safetyLevel = String(body.safetyLevel || "Supervised");
    if (!Number.isInteger(clientId) || clientId < 1 || !name || !trigger || !action)
      return Response.json({ error: "Client, workflow name, trigger, and action are required." }, { status: 400 });
    if (!["Automatic", "Supervised", "Restricted"].includes(safetyLevel))
      return Response.json({ error: "Invalid safety level." }, { status: 400 });
    const db = getDb();
    const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) return Response.json({ error: "Client not found." }, { status: 404 });
    const [workflow] = await db.insert(workflows).values({ clientId, name, description, trigger, action, safetyLevel, approvalRequired: body.approvalRequired !== false, active: false, lastRunStatus: "Ready for review" }).returning();
    return Response.json({ workflow }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create workflow" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: number;
    active?: boolean;
    pauseAll?: boolean;
    simulate?: boolean;
  };
  const db = getDb();
  if (typeof body.pauseAll === "boolean") {
    const rows = await db
      .update(workflows)
      .set({ active: !body.pauseAll, updatedAt: new Date().toISOString() })
      .returning();
    return Response.json({ workflows: rows });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id))
    return Response.json({ error: "Invalid workflow." }, { status: 400 });
  if (body.simulate) {
    const now = new Date().toISOString();
    const [row] = await db
      .update(workflows)
      .set({ lastRunStatus: "Test passed", lastRunAt: now, updatedAt: now })
      .where(eq(workflows.id, id))
      .returning();
    return row
      ? Response.json({ workflow: row })
      : Response.json({ error: "Workflow not found." }, { status: 404 });
  }
  const [row] = await db
    .update(workflows)
    .set({ active: Boolean(body.active), updatedAt: new Date().toISOString() })
    .where(eq(workflows.id, id))
    .returning();
  return row
    ? Response.json({ workflow: row })
    : Response.json({ error: "Workflow not found." }, { status: 404 });
}
