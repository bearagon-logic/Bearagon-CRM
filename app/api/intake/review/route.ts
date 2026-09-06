import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { intakeReceipts,operatorAuditEvents } from "@/db/schema";
import { auditActor,getOperatorIdentity,operatorRequiredResponse } from "@/lib/server/operator-auth";
import { importEvent } from "@/lib/server/intake-sync";
import { feedEvent } from "@/lib/intake-feed";
import { newId } from "@/lib/ops-domain.mjs";
const input=z.object({id:z.string().max(200),action:z.enum(["import","dismiss"]),reason:z.string().trim().max(1000).optional(),data:z.record(z.unknown()).optional()});
export async function POST(request:Request) {
  const actor=await getOperatorIdentity(request); if(!actor)return operatorRequiredResponse();
  const parsed=input.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return Response.json({error:"Invalid review request."},{status:400});
  const v=parsed.data,db=getDb(),[receipt]=await db.select().from(intakeReceipts).where(eq(intakeReceipts.id,v.id));
  if(!receipt)return Response.json({error:"Intake record not found."},{status:404});
  if(receipt.status!=="review")return Response.json({error:"This intake has already been resolved. Refresh the inbox."},{status:409});
  if(v.action==="dismiss") {
    if(!v.reason)return Response.json({error:"Record why this message should be dismissed."},{status:400});
    await db.batch([db.update(intakeReceipts).set({status:"dismissed",reason:v.reason,updatedAt:new Date().toISOString()}).where(eq(intakeReceipts.id,v.id)),db.insert(operatorAuditEvents).values({id:newId("audit"),resourceType:"intake",resourceId:v.id,action:"intake.dismissed",...auditActor(actor),result:"succeeded",detail:v.reason})]);
    return Response.json({saved:true});
  }
  const event=feedEvent.parse(JSON.parse(receipt.payload));
  const result=await importEvent(request,v.id,event,typeof v.data?.accountId==="string"?v.data.accountId:"",v.data);
  return Response.json(result,{status:result.error?400:200});
}
