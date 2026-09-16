import type { getRawDb } from '@/db';
import type { ProposalState } from '@/lib/proposal-model';

export type ScopingRecord = {
  id: string;
  accountId: string;
  accountName: string;
  owner: string;
  followUpDate: string;
  nextAction: string;
  coordination: string;
  stage: 'Prepare scope' | 'Internal review' | 'Client acceptance' | 'Review saved scope';
  scopeRevision: number;
};

type ScopingRow = {
  accountId: string; accountName: string; owner: string; followUpDate: string;
  coordination: string; state: string | null;
};

// A handoff closes an inquiry before acceptance creates an engagement. Keep
// that deliberate gap visible without manufacturing an onboarding record.
export async function readScopingWork(db: ReturnType<typeof getRawDb>): Promise<ScopingRecord[]> {
  const { results } = await db.prepare(`
    SELECT a.id AS accountId, a.name AS accountName,
      a.relationship_owner AS owner, a.follow_up_date AS followUpDate,
      a.relationship_next_action AS coordination, p.state
    FROM accounts a
    LEFT JOIN account_proposals p ON p.account_id = a.id
    WHERE a.status = 'active' AND a.organization_kind = 'external'
      AND a.relationship_type IN ('prospect', 'client')
      AND a.sales_stage NOT IN ('lost', 'nurture')
      AND NOT EXISTS (
        SELECT 1 FROM engagements e WHERE e.account_id = a.id
          AND e.kind = 'onboarding'
      )
      AND (p.version > 0 OR EXISTS (
        SELECT 1 FROM operator_audit_events audit
        WHERE audit.account_id = a.id AND audit.action = 'inquiry.handed_off'
          AND audit.result IN ('succeeded', 'recorded')
      ))
    ORDER BY CASE WHEN a.follow_up_date = '' THEN 1 ELSE 0 END, a.follow_up_date, a.name, a.id
  `).all<ScopingRow>();

  return results.flatMap(row => {
    let proposal: ProposalState | null = null;
    let unreadable = false;
    try { proposal = row.state ? JSON.parse(row.state) as ProposalState : null; }
    catch { unreadable = true; }
    // Normal acceptance creates its engagement atomically. If a legacy/damaged
    // record violates that invariant, keep it visible as a repair task, never as
    // a request to accept the same scope again.
    const missingDelivery = !!proposal?.acceptance;
    const revision = proposal?.scopeRevision || 0;
    const reviewed = revision > 0 && proposal?.approval?.revision === revision;
    const stage: ScopingRecord['stage'] = unreadable || missingDelivery ? 'Review saved scope'
      : reviewed ? 'Client acceptance' : revision > 0 ? 'Internal review' : 'Prepare scope';
    const nextAction = missingDelivery ? 'Review accepted scope: its delivery record is missing'
      : unreadable ? 'Open the company and review its saved scope record'
      : reviewed ? 'Prepare the quote and record client acceptance'
        : revision > 0 ? 'Complete the scope and request internal review'
          : 'Define the service package and prepare the first scope';
    return [{ id: `scope:${row.accountId}`, accountId: row.accountId,
      accountName: row.accountName, owner: row.owner, followUpDate: row.followUpDate,
      coordination: row.coordination, nextAction, stage, scopeRevision: revision }];
  });
}
