import { z } from 'zod';
import { publicWebsite } from '../company-research';
import type { getRawDb } from '@/db';
import type { OperatorIdentity } from './operator-auth';
export const contextInput=z.object({website:z.string().max(1000),notes:z.string().max(5000),expectedWebsite:z.string().max(1000),expectedNotes:z.string()});
export async function saveCompanyContext(db:ReturnType<typeof getRawDb>,id:string,value:z.infer<typeof contextInput>,actor:OperatorIdentity) {
  const website=value.website.trim()?publicWebsite(value.website):'',notes=value.notes.trim();
  const auditId='audit_'+crypto.randomUUID(),now=new Date().toISOString();
  const results=await db.batch([
    db.prepare(`INSERT INTO operator_audit_events(id,account_id,resource_type,resource_id,action,actor_id,actor_email,actor_name,result,detail,created_at)
      SELECT ?,id,'account',id,'company.context_updated',?,?,?,'succeeded','Operator saved website and company notes',? FROM accounts
      WHERE id=? AND status<>'archived' AND website=? AND notes=?`).bind(auditId,actor.userId,actor.email,actor.displayName,now,id,value.expectedWebsite,value.expectedNotes),
    db.prepare('UPDATE accounts SET website=?,notes=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM operator_audit_events WHERE id=?)').bind(website,notes,now,id,auditId),
  ]);
  if(results[0].meta.changes!==1)throw Error('Company context changed or this account is unavailable. Your draft is kept; reload before saving again.');
  return {website,notes};
}
