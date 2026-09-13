"use client";
import type { ReactNode } from 'react';
import { Button } from './ui/button';
import { internalStage } from '@/lib/internal-operations';
import type { ProposalState } from '@/lib/proposal-model';

export function InternalOverview({ proposal, owner, ownerEditor, notes, onWork, onServices, onPlan }: {
  proposal: ProposalState | null;
  owner: string;
  ownerEditor?: ReactNode;
  notes: string;
  onWork: () => void;
  onServices: () => void;
  onPlan: () => void;
}) {
  const authorized = !!proposal?.acceptance;
  const orders = authorized ? proposal!.orders : [];
  return <div className="company-record-grid internal-overview">
    <div className="company-record-main">
      <section className="company-panel">
        <small className="eyebrow">BEARAGON OPERATIONS</small>
        <h2>Internal operations overview</h2>
        {authorized ? <>
          <p>{orders.length} {orders.length === 1 ? 'automation' : 'automations'} in the internal plan.</p>
          <div className="internal-stage-counts">{(['Planned', 'Building', 'Testing', 'Operating'] as const).map(stage => <span key={stage}><b>{orders.filter(order => internalStage(order, proposal!.setup.revision) === stage).length}</b> {stage === 'Operating' ? 'Approved for use' : stage}</span>)}</div>
          <p className="company-help">Recorded work and approvals. Services & monitoring shows the separate Console observations.</p>
          <Button onClick={onWork}>Open automation work</Button>
        </> : <>
          <p>No internal plan has been authorized yet. Establish the scope and shared setup to begin the automation backlog.</p>
          <Button onClick={onPlan}>Establish internal plan</Button>
        </>}
      </section>
      <section className="company-panel">
        <small className="eyebrow">INTERNAL CONTEXT</small>
        <h2>Notes & decisions</h2>
        <p>{notes || 'No internal notes recorded.'}</p>
      </section>
    </div>
    <aside className="company-record-side">
      <section className="company-panel" id="operations-owner"><h2>Operations owner</h2>{ownerEditor || <p>{owner || 'Unassigned'}</p>}</section>
      <section className="company-panel"><h2>Services & monitoring</h2><p>Review connected services, installations and the latest reports from Console.</p><Button variant="outline" onClick={onServices}>Open services & monitoring</Button></section>
    </aside>
  </div>;
}
