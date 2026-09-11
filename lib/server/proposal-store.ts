import type { getRawDb } from '@/db';
import { customerQuote } from '@/lib/customer-quote';
import { type ProposalState, type Stamp, ProposalError } from '@/lib/proposal-model';
import { onboardingTemplate } from '@/lib/server/onboarding-template';

type DB = ReturnType<typeof getRawDb>;
export async function readProposal(db: DB, accountId: string) {
  const row = await db.prepare('SELECT state FROM account_proposals WHERE account_id = ?').bind(accountId).first<{ state: string }>();
  return row ? JSON.parse(row.state) as ProposalState : null;
}

// Every dependent statement is guarded by the exact successful CAS mutation.
// D1 batch is transactional; a stale writer cannot append history or create work.
export async function persistProposal(db: DB, accountId: string, before: ProposalState, next: ProposalState, actor: Stamp, action: string, mutationId: string) {
  const gate = 'EXISTS (SELECT 1 FROM account_proposals WHERE account_id = ? AND mutation_id = ?)';
  const guarded = (sql: string, values: (string | number | null)[] = []) => db.prepare(sql).bind(...values, accountId, mutationId);
  let createEngagement = false;
  if (!before.acceptance && next.acceptance) {
    const prior = await db.prepare("SELECT id,status FROM engagements WHERE account_id=? AND kind='onboarding' ORDER BY created_at DESC LIMIT 1").bind(accountId).first<{id:string;status:string}>();
    if (prior && !['active','planned','blocked'].includes(prior.status)) throw new ProposalError('A prior delivery is closed. A new engagement/amendment decision is required before accepting more work.',409);
    next.engagementId = prior?.id || `eng_${crypto.randomUUID()}`;
    createEngagement = !prior;
  }
  const state = JSON.stringify(next);
  const statements = [before.version === 0
    ? db.prepare('INSERT INTO account_proposals(account_id,version,mutation_id,state,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(account_id) DO NOTHING').bind(accountId,next.version,mutationId,state,actor.at)
    : db.prepare('UPDATE account_proposals SET version=?,mutation_id=?,state=?,updated_at=? WHERE account_id=? AND version=?').bind(next.version,mutationId,state,actor.at,accountId,before.version),
    guarded(`INSERT INTO proposal_revisions(account_id,version,state,action,actor_id,actor_email,created_at) SELECT ?,?,?,?,?,?,? WHERE ${gate}`, [accountId,next.version,state,action,actor.id,actor.email,actor.at]),
    guarded(`INSERT INTO operator_audit_events(id,account_id,resource_type,resource_id,action,actor_id,actor_email,actor_name,result,detail,created_at) SELECT ?,?,'proposal',?,?,?,?,?,'recorded',?,? WHERE ${gate}`, [`audit_${crypto.randomUUID()}`,accountId,accountId,`proposal.${action}`,actor.id,actor.email,actor.name,`Scope revision ${next.scopeRevision}; record version ${next.version}`,actor.at]),
  ];
  if (!before.acceptance && next.acceptance) {
    if (createEngagement) {
      statements.push(guarded(`INSERT INTO engagements(id,account_id,kind,status,stage,next_step,owner,updated_at) SELECT ?,?,'onboarding','active','intake','Complete guided setup',?,? WHERE ${gate}`, [next.engagementId,accountId,actor.name,actor.at]));
      for (const [i, task] of onboardingTemplate.entries()) statements.push(guarded(`INSERT INTO onboarding_tasks(id,engagement_id,template_key,title,description,sort_order) SELECT ?,?,?,?,?,? WHERE ${gate}`, [`task_${crypto.randomUUID()}`,next.engagementId,task.key,task.title,task.description,i+1]));
    }
    statements.push(guarded(`UPDATE accounts SET relationship_type=?,sales_stage=CASE WHEN organization_kind='internal' THEN sales_stage ELSE 'won' END,updated_at=? WHERE id=? AND ${gate}`, [next.internal?'other':'client',actor.at,accountId]));
    const quote = customerQuote(next.draft);
    for (const [i, order] of next.orders.entries()) {
      const line = quote.services.find(s => s.id === order.key)!;
      statements.push(guarded(`INSERT INTO account_services(id,account_id,name,status,quote_ref,accepted_at,monthly_fee_cents,scope,maintenance,configuration,updated_at) SELECT ?,?,?,'ordered',?,?,?,?,?,?,? WHERE ${gate}`, [order.serviceId,accountId,order.name,`Ops scope ${next.scopeRevision}: ${next.acceptance.reference}`,next.acceptance.date,next.internal?null:line.amount,line.description,'Maintenance within accepted package scope',line.details.map(d=>`${d.label}: ${d.value}`).join('\n'),actor.at]));
      statements.push(guarded(`INSERT INTO onboarding_tasks(id,engagement_id,template_key,title,description,sort_order) SELECT ?,?,?,?,?,? WHERE ${gate}`, [order.taskId,next.engagementId,`scope:${order.key}`,`Implement: ${order.name}`,'Use guided setup to record build and external test evidence against the accepted scope.',100+i]));
    }
  }
  if (action === 'setup' || action === 'order') {
    if (action === 'setup' || next.orders.some(o => o.status !== 'tested')) statements.push(guarded(`UPDATE engagements SET stage='intake',next_step=?,updated_at=? WHERE id=? AND account_id=? AND status IN ('planned','active','blocked') AND ${gate}`, [next.setup.answers.every(a=>a.trim())?'Revalidate package work orders and delivery requirements':'Complete guided setup',actor.at,next.engagementId,accountId]));
    for (const o of next.orders) statements.push(guarded(`UPDATE onboarding_tasks SET status=?,evidence_ref=?,completion_note=?,completed_at=?,updated_at=? WHERE id=? AND engagement_id=? AND ${gate}`, [o.status==='tested'?'completed':o.status==='built'?'in_progress':'pending',o.testRef,o.buildRef,o.status==='tested'?actor.at:'',actor.at,o.taskId,next.engagementId]));
  }
  const result = await db.batch(statements);
  if (result[0].meta.changes !== 1) throw new ProposalError('Another operator saved first. Reload to review their changes; this request made no changes.',409);
  return next;
}
