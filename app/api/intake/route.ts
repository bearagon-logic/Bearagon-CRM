import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { intakeReceipts, intakeFeedState } from "@/db/schema";
import { getOperatorIdentity, operatorRequiredResponse } from "@/lib/server/operator-auth";
import { intakeConfigured, syncIntake } from "@/lib/server/intake-sync";
export async function GET(request: Request) {
  if (!await getOperatorIdentity(request)) return operatorRequiredResponse();
  const db=getDb();
  const [state] = await db.select().from(intakeFeedState).where(eq(intakeFeedState.id,"website"));
  const receipts = await db.select().from(intakeReceipts).where(eq(intakeReceipts.status,"review")).orderBy(asc(intakeReceipts.sequence)).limit(100);
  return Response.json({ configured:intakeConfigured(), lastSyncedAt:state?.lastSyncedAt || "", lastError:state?.lastError || "", health:JSON.parse(state?.health || "{}"), reviews:receipts.map((r)=>({id:r.id,reason:r.reason,event:JSON.parse(r.payload)})) },{headers:{"cache-control":"no-store"}});
}
export async function POST(request: Request) {
  if (!await getOperatorIdentity(request)) return operatorRequiredResponse();
  const result=await syncIntake(request);
  return Response.json(result,{status:result.error?502:200,headers:{"cache-control":"no-store"}});
}
