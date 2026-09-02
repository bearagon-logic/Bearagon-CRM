import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { clients, tasks, workflows } from "../../../../db/schema";
const checklist = [
  "Agreement signed",
  "Discovery form completed",
  "Email and calendar connected",
  "Accounting or payment system connected",
  "Guardrails approved",
  "Automations built",
  "Client testing completed",
  "Launch approved",
];
async function clientId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const value = Number(id);
  return Number.isInteger(value) && value > 0 ? value : null;
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = await clientId(params);
  if (!id) return Response.json({ error: "Invalid client." }, { status: 400 });
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!client)
    return Response.json({ error: "Client not found." }, { status: 404 });
  let clientTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.clientId, id))
    .orderBy(asc(tasks.id));
  if (!clientTasks.length)
    clientTasks = await db
      .insert(tasks)
      .values(checklist.map((title) => ({ clientId: id, title })))
      .returning();
  const clientWorkflows = await db.select().from(workflows).where(eq(workflows.clientId, id)).orderBy(asc(workflows.id));
  return Response.json({ client, tasks: clientTasks, workflows: clientWorkflows });
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = await clientId(params);
  if (!id) return Response.json({ error: "Invalid client." }, { status: 400 });
  const body = (await request.json()) as Record<string, unknown>,
    db = getDb();
  if (body.pauseWorkflows === true) {
    const rows = await db.update(workflows).set({ active: false, updatedAt: new Date().toISOString() }).where(eq(workflows.clientId, id)).returning();
    return Response.json({ workflows: rows });
  }
  if (body.taskId) {
    const taskId = Number(body.taskId);
    const [task] = await db
      .update(tasks)
      .set({ completed: Boolean(body.completed) })
      .where(and(eq(tasks.id, taskId), eq(tasks.clientId, id)))
      .returning();
    return task
      ? Response.json({ task })
      : Response.json({ error: "Task not found." }, { status: 404 });
  }
  const updates: { stage?: string; notes?: string; nextStep?: string } = {};
  if (typeof body.stage === "string") updates.stage = body.stage;
  if (typeof body.notes === "string") updates.notes = body.notes.slice(0, 5000);
  if (typeof body.nextStep === "string")
    updates.nextStep = body.nextStep.slice(0, 300);
  const [client] = await db
    .update(clients)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(eq(clients.id, id))
    .returning();
  return client
    ? Response.json({ client })
    : Response.json({ error: "Client not found." }, { status: 404 });
}
