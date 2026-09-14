import type { getRawDb } from '@/db';
import type { OperatorIdentity } from './operator-auth';

export async function routeInquiry(db:ReturnType<typeof getRawDb>, input:{id:string;accountId:string;expectedUpdatedAt:string;action:'lead'|'workflow'}, actor:OperatorIdentity) {
  const now=new Date().toISOString(), workflow=input.action==='workflow';
  const resolution='Handed off to company scope and delivery; intake review complete.';
  const result=await db.batch([
    db.prepare(`UPDATE inquiries SET status=?,
      resolution=CASE WHEN ? THEN CASE WHEN resolution='' THEN ? ELSE resolution || char(10) || ? END ELSE resolution END,
      next_action=CASE WHEN ?=0 AND next_action='' THEN 'Follow up with lead' ELSE next_action END,updated_at=?
      WHERE id=? AND account_id=? AND updated_at=? AND status IN ('new','working','qualified') AND (?=1 OR status!='qualified')
      AND EXISTS(SELECT 1 FROM accounts WHERE id=inquiries.account_id AND status='active' AND organization_kind='external')`)
      .bind(workflow?'closed':'qualified',workflow?1:0,resolution,resolution,workflow?1:0,now,input.id,input.accountId,input.expectedUpdatedAt,workflow?1:0),
    db.prepare(`INSERT INTO operator_audit_events(id,account_id,resource_type,resource_id,action,actor_id,actor_email,actor_name,result,detail,created_at)
      SELECT ?,?,'inquiry',?,?,?,?,?,'succeeded',?,? WHERE changes()=1`)
      .bind(`audit_${crypto.randomUUID()}`,input.accountId,input.id,workflow?'inquiry.handed_off':'inquiry.qualified',actor.userId,actor.email,actor.displayName,
        workflow?'Selected inquiry handed off to company scope. No quote accepted or onboarding created.':'Selected inquiry marked as a lead for follow-up. Existing contact preferences and delivery records preserved.',now),
    // A successful audit insert proves that this exact inquiry changed in this batch.
    db.prepare(`UPDATE accounts SET sales_stage=CASE WHEN relationship_type='prospect' AND sales_stage IN ('new','contacted','lost','nurture') THEN 'qualified' ELSE sales_stage END,updated_at=?
      WHERE id=? AND changes()=1`).bind(now,input.accountId),
  ]);
  return result[0].meta.changes===1;
}
