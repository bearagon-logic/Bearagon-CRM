import { z } from "zod";
import { getRawDb } from "@/db";
import { getOperatorIdentity, operatorRequiredResponse } from "@/lib/server/operator-auth";
import { cleanupPrefix } from "@/lib/inquiry-cleanup";

const input = z.object({id:z.string().min(1).max(100),kind:z.enum(["test","spam"]),reason:z.string().trim().min(1).max(1000),archiveCompany:z.boolean().default(false),updatedAt:z.string().min(1)});
export async function POST(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  const parsed = input.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return Response.json({error:"Choose test or spam and provide a reason."},{status:400});
  const v=parsed.data, db=getRawDb(), now=new Date().toISOString();
  const row=await db.prepare("SELECT * FROM inquiries WHERE id = ?").bind(v.id).first();
  if (!row) return Response.json({error:"Inquiry not found."},{status:404});
  if (row.updated_at!==v.updatedAt) return Response.json({error:"This inquiry changed. Refresh and review it before cleanup."},{status:409});
  // Conditions execute inside the atomic batch, not only in a preflight check.
  const archive = db.prepare(`UPDATE accounts SET status='archived', updated_at=? WHERE id=? AND status='active'
    AND organization_kind='external' AND relationship_type='prospect' AND sales_stage IN ('new','contacted','lost','nurture')
    AND EXISTS (SELECT 1 FROM inquiries WHERE id=? AND updated_at=? AND status='closed')
    AND NOT EXISTS (SELECT 1 FROM inquiries WHERE account_id=accounts.id AND id<>?)
    AND NOT EXISTS (SELECT 1 FROM account_contacts a JOIN account_contacts b ON a.contact_id=b.contact_id WHERE a.account_id=accounts.id AND b.account_id<>accounts.id)
    AND NOT EXISTS (SELECT 1 FROM engagements WHERE account_id=accounts.id)
    AND NOT EXISTS (SELECT 1 FROM workspaces WHERE account_id=accounts.id)
    AND NOT EXISTS (SELECT 1 FROM account_proposals WHERE account_id=accounts.id)
    AND NOT EXISTS (SELECT 1 FROM account_services WHERE account_id=accounts.id)
    AND NOT EXISTS (SELECT 1 FROM automation_blueprints WHERE account_id=accounts.id)
    AND NOT EXISTS (SELECT 1 FROM automation_installations WHERE account_id=accounts.id)
    AND NOT EXISTS (SELECT 1 FROM decision_requests WHERE account_id=accounts.id)
    RETURNING id`).bind(now,row.account_id,v.id,now,v.id);
  const result=await db.batch([
    db.prepare("UPDATE inquiries SET status='closed', resolution=?, updated_at=? WHERE id=? AND updated_at=? RETURNING id").bind(`${cleanupPrefix(v.kind)} ${v.reason}`,now,v.id,v.updatedAt),
    ...(v.archiveCompany?[archive]:[]),
    db.prepare(`INSERT INTO operator_audit_events (id,account_id,resource_type,resource_id,action,actor_email,actor_id,actor_name,result,detail)
      SELECT ?, account_id, 'inquiry', id, 'inquiry.marked_junk', ?, ?, ?, 'succeeded', ? FROM inquiries WHERE id=? AND updated_at=?`).bind(crypto.randomUUID(),actor.email,actor.userId,actor.displayName,`${v.kind}: ${v.reason}; company archive requested: ${v.archiveCompany}. Contacts retained; no permanent deletion.`,v.id,now),
  ]);
  if (!result[0].results.length) return Response.json({error:"This inquiry changed. Refresh before cleanup."},{status:409});
  const archived=v.archiveCompany && !!result[1].results.length;
  return Response.json({message:archived?"Inquiry marked and prospect company archived. Contact details and history retained.":v.archiveCompany?"Inquiry marked. Company retained because it has protected or shared records, or is not an eligible active prospect.":"Inquiry marked. Company and contact retained."});
}
