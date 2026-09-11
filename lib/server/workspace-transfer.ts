import type { getRawDb } from '@/db';
import type { OperatorIdentity } from './operator-auth';

export type Transfer = { fromAccountId: string; toAccountId: string; consoleClientId: string; reason: string; confirmed: true };
export function parseTransfer(value: unknown): Transfer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Choose both companies and confirm the transfer.');
  const v = value as Record<string, unknown>;
  for (const key of ['fromAccountId','toAccountId','consoleClientId','reason']) {
    if (typeof v[key] !== 'string' || !v[key].trim() || v[key].length > (key === 'reason' ? 1000 : 200)) throw new Error('Choose both companies and provide a reason (up to 1,000 characters).');
  }
  if (v.confirmed !== true || v.fromAccountId === v.toAccountId) throw new Error('Confirm a transfer between two different companies.');
  return { fromAccountId: String(v.fromAccountId).trim(), toAccountId: String(v.toAccountId).trim(), consoleClientId: String(v.consoleClientId).trim(), reason: String(v.reason).trim(), confirmed: true };
}

// This narrowly scoped correction never moves installations or rewrites company history.
// The conditional audit insert is the transaction gate; every write depends on it.
export async function transferUnusedWorkspace(db: ReturnType<typeof getRawDb>, t: Transfer, actor: OperatorIdentity) {
  const auditId = `audit_${crypto.randomUUID()}`;
  const destinationId = `workspace_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const gate = 'EXISTS (SELECT 1 FROM operator_audit_events WHERE id=?)';
  const detail = JSON.stringify({ fromAccountId:t.fromAccountId, toAccountId:t.toAccountId, consoleClientId:t.consoleClientId, reason:t.reason });
  const result = await db.batch([
    db.prepare(`INSERT INTO operator_audit_events(id,account_id,resource_type,resource_id,action,actor_id,actor_email,actor_name,result,detail,created_at)
      SELECT ?,old.id,'workspace',src.id,'workspace.console_transfer_out',?,?,?,'succeeded',?,?
      FROM workspaces src JOIN accounts old ON old.id=src.account_id JOIN accounts dst ON dst.id=?
      WHERE src.account_id=? AND src.console_client_id=? AND old.id<>dst.id
      AND old.status<>'archived' AND dst.status<>'archived'
      AND NOT EXISTS(SELECT 1 FROM workspaces w WHERE w.account_id=dst.id AND w.console_client_id IS NOT NULL)
      AND NOT EXISTS(SELECT 1 FROM automation_installations i WHERE i.account_id IN(old.id,dst.id) OR i.workspace_id=src.id OR i.workspace_id IN(SELECT id FROM workspaces WHERE account_id=dst.id))`)
      .bind(auditId,actor.userId,actor.email,actor.displayName,detail,now,t.toAccountId,t.fromAccountId,t.consoleClientId),
    db.prepare(`UPDATE workspaces SET console_client_id=NULL,last_synced_at='',updated_at=? WHERE account_id=? AND ${gate}`).bind(now,t.fromAccountId,auditId),
    db.prepare(`INSERT INTO workspaces(id,account_id,slug,display_name,updated_at)
      SELECT ?,id,?,name,? FROM accounts WHERE id=? AND NOT EXISTS(SELECT 1 FROM workspaces WHERE account_id=?) AND ${gate}`)
      .bind(destinationId,destinationId,now,t.toAccountId,t.toAccountId,auditId),
    db.prepare(`UPDATE workspaces SET console_client_id=?,last_synced_at=?,updated_at=? WHERE account_id=? AND ${gate}`).bind(t.consoleClientId,now,now,t.toAccountId,auditId),
    db.prepare(`INSERT INTO operator_audit_events(id,account_id,resource_type,resource_id,action,actor_id,actor_email,actor_name,result,detail,created_at)
      SELECT ?,?,'workspace',id,'workspace.console_transfer_in',?,?,?,'succeeded',?,? FROM workspaces WHERE account_id=? AND ${gate}`)
      .bind(`audit_${crypto.randomUUID()}`,t.toAccountId,actor.userId,actor.email,actor.displayName,detail,now,t.toAccountId,auditId),
  ]);
  if (result[0].meta.changes !== 1) throw new Error('Transfer not applied. The mapping changed, a company is archived, the destination is already linked, or an automation installation needs separate review. Refresh connections.');
}
