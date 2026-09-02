import { asc, desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { clients } from "../../../db/schema";

const allowedStages = new Set(["Intake", "Connections", "Building", "Testing", "Live"]);

export async function GET() {
  try {
    const rows = await getDb().select().from(clients).orderBy(asc(clients.stage), desc(clients.id));
    return Response.json({ clients: rows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load clients" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const companyName = String(body.companyName ?? "").trim();
    const contactName = String(body.contactName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const stage = String(body.stage ?? "Intake");
    const dueDate = String(body.dueDate ?? "").trim();
    if (!companyName || !contactName || !email) {
      return Response.json({ error: "Company, contact, and email are required." }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!allowedStages.has(stage)) {
      return Response.json({ error: "Invalid onboarding stage." }, { status: 400 });
    }
    const [client] = await getDb().insert(clients).values({ companyName, contactName, email, phone, stage, dueDate }).returning();
    return Response.json({ client }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create client" }, { status: 500 });
  }
}
