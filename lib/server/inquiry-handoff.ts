import type { getRawDb } from '@/db';
import type { OperatorIdentity } from './operator-auth';

export async function handoffInquiry(db:ReturnType<typeof getRawDb>, input:{id:string;accountId:string;expectedUpdatedAt:string}, actor:OperatorIdentity) {
  const now=new Date().toISOString();
  // Preserve contact, owner, follow-up and summary. Close only the explicitly
  // selected, unchanged inquiry. Audit and state update share one transaction.
  const result=await db.batch([
    db.prepare("UPDATE inquiries SET status='closed',resolution=?,updated_at=? WHERE id=? AND account_id=? AND updated_at=? AND status!='closed'").bind('Handed off to company scope and delivery; intake review complete.',now,input.id,input.accountId,input.expectedUpdatedAt),
    db.prepare("INSERT INTO operator_audit_events(id,account_id,resource_type,resource_id,action,actor_id,actor_email,actor_name,result,detail,created_at) SELECT ?,?,'inquiry',?,'inquiry.handed_off',?,?,?,'succeeded',?,? WHERE changes()=1").bind(`audit_${crypto.randomUUID()}`,input.accountId,input.id,actor.userId,actor.email,actor.displayName,'Selected intake resolved; other inquiries and follow-up details preserved.',now),
  ]);
  return result[0].meta.changes===1;
}
