import type { getRawDb } from '@/db';
import type { OperatorIdentity } from './operator-auth';

export function parseOperationsOwner(value:unknown):{owner:string;expectedOwner:string} {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Choose an operations owner.');
  const v=value as Record<string,unknown>;
  if(typeof v.owner!=='string'||!['','Brendan','Emily','Derek'].includes(v.owner)||typeof v.expectedOwner!=='string'||v.expectedOwner.length>500)throw Error('Choose Brendan, Emily, Derek or Unassigned.');
  return {owner:v.owner,expectedOwner:v.expectedOwner};
}

// The audit insert gates the update in one atomic batch, including the prior owner.
export async function saveOperationsOwner(db:ReturnType<typeof getRawDb>,id:string,input:{owner:string;expectedOwner:string},actor:OperatorIdentity) {
  const auditId='audit_'+crypto.randomUUID(),now=new Date().toISOString();
  const results=await db.batch([
    db.prepare(`INSERT INTO operator_audit_events(id,account_id,resource_type,resource_id,action,actor_id,actor_email,actor_name,result,detail,created_at)
      SELECT ?,id,'account',id,'operations.owner_updated',?,?,?,'succeeded',?,? FROM accounts
      WHERE id=? AND organization_kind='internal' AND status<>'archived' AND relationship_owner=?`)
      .bind(auditId,actor.userId,actor.email,actor.displayName,JSON.stringify({previousOwner:input.expectedOwner,owner:input.owner}),now,id,input.expectedOwner),
    db.prepare(`UPDATE accounts SET relationship_owner=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM operator_audit_events WHERE id=?)`)
      .bind(input.owner,now,id,auditId),
  ]);
  if(results[0].meta.changes!==1)throw Error('Owner not saved. The assignment changed or this internal account is unavailable. Reload the page before trying again.');
  return {owner:input.owner};
}
