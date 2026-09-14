import type { getRawDb } from '@/db';
import type { OperatorIdentity } from './operator-auth';
import { cleanupPrefix } from '../inquiry-cleanup';

export async function cleanupInquiry(db:ReturnType<typeof getRawDb>, v:{id:string;kind:'test'|'spam';reason:string;updatedAt:string}, actor:OperatorIdentity) {
  const now=new Date().toISOString();
  const row=await db.prepare("SELECT * FROM inquiries WHERE id = ?").bind(v.id).first();
  if (!row) return {error:"Inquiry not found.",status:404};
  if (row.updated_at!==v.updatedAt) return {error:"This inquiry changed. Refresh and review it before cleanup.",status:409};
  // Conditions execute inside the atomic batch, not only in a preflight check.
  const archive = db.prepare(`UPDATE accounts SET status='archived', updated_at=? WHERE id=? AND status='active'
    AND organization_kind='external' AND relationship_type='prospect' AND sales_stage IN ('new','contacted','lost','nurture')
    AND EXISTS (SELECT 1 FROM inquiries WHERE id=? AND updated_at=? AND status='closed')
    AND EXISTS (SELECT 1 FROM operator_audit_events WHERE account_id=accounts.id AND resource_type='inquiry' AND action='inquiry.recorded' AND detail LIKE '%; created prospect account.%')
    AND NOT EXISTS (SELECT 1 FROM inquiries WHERE account_id=accounts.id AND id<>? AND NOT (status='closed' AND (resolution LIKE '[Test submission] %' OR resolution LIKE '[Spam] %')))
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
    archive,
    db.prepare(`INSERT INTO operator_audit_events (id,account_id,resource_type,resource_id,action,actor_email,actor_id,actor_name,result,detail)
      SELECT ?, account_id, 'inquiry', id, 'inquiry.marked_junk', ?, ?, ?, 'succeeded', ? FROM inquiries WHERE id=? AND updated_at=?`).bind(crypto.randomUUID(),actor.email,actor.userId,actor.displayName,`${v.kind}: ${v.reason}; automatic archive eligibility checked. Contacts retained; no permanent deletion.`,v.id,now),
  ]);
  if (!result[0].results.length) return {error:"This inquiry changed. Refresh before cleanup.",status:409};
  const archived=!!result[1].results.length;
  return {status:200,message:archived?"Inquiry marked as test / spam. Its inquiry-only company was removed from the active directory; history and contacts are retained.":"Inquiry marked as test / spam. The existing company remains because it has lead, client, shared or other saved records, or was created separately."};
}
