import { z } from "zod";
import { getRawDb } from "@/db";
import { getOperatorIdentity, operatorRequiredResponse } from "@/lib/server/operator-auth";
import { cleanupInquiry } from "@/lib/server/inquiry-cleanup";

const input = z.object({id:z.string().min(1).max(100),kind:z.enum(["test","spam"]),reason:z.string().trim().min(1).max(1000),updatedAt:z.string().min(1)});
export async function POST(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  const parsed = input.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return Response.json({error:"Choose test or spam and provide a reason."},{status:400});
  const {status,...result}=await cleanupInquiry(getRawDb(),parsed.data,actor);
  return Response.json(result,{status});
}
