"use client";

import type { WorkOrder } from '@/lib/proposal-model';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { DialogFooter } from './ui/dialog';

export function evidenceChanged(draft: WorkOrder | null, saved?: WorkOrder) {
  return !!draft && (!saved || draft.status !== saved.status || draft.buildRef !== saved.buildRef || draft.testRef !== saved.testRef);
}

export function WorkOrderEvidenceForm({ order, saved, busy, error, onChange, onCancel, onSave }: {
  order: WorkOrder; saved?: WorkOrder; busy: boolean; error: string;
  onChange: (order: WorkOrder) => void; onCancel: () => void; onSave: () => void;
}) {
  const editing = !!saved?.recorded;
  const clearsBuild = order.status === 'to_build' && !!(order.buildRef || order.testRef);
  const clearsTest = order.status === 'built' && !!order.testRef;
  return <form onSubmit={event => { event.preventDefault(); if (!busy) onSave(); }}>
    <fieldset disabled={busy} className="evidence-fields">
      <label htmlFor="evidence-state">Delivery state</label>
      <select id="evidence-state" value={order.status} onChange={event => onChange({ ...order, status: event.target.value as WorkOrder['status'] })}>
        <option value="to_build">To build</option>
        <option value="built">Built · awaiting testing</option>
        <option value="tested">Tested · external evidence recorded</option>
      </select>
      <label htmlFor="evidence-build">Build reference</label>
      <Textarea id="evidence-build" rows={4} value={order.buildRef} maxLength={2000} required={order.status !== 'to_build'} disabled={order.status === 'to_build'} onChange={event => onChange({ ...order, buildRef: event.target.value })}/>
      <label htmlFor="evidence-test">Test evidence reference</label>
      <Textarea id="evidence-test" rows={4} value={order.testRef} maxLength={2000} required={order.status === 'tested'} disabled={order.status !== 'tested'} onChange={event => onChange({ ...order, testRef: event.target.value })}/>
      {order.status !== 'tested' && <p className="company-help">Choose Tested to record test evidence. Choose Built or Tested to record a build reference.</p>}
      {(clearsBuild || clearsTest) && <p role="status" className="proposal-issues">{clearsBuild ? 'Saving To build clears the current build and test references.' : 'Saving Built clears the current test reference and returns this module to awaiting testing.'} Previously saved evidence remains in revision history.</p>}
      {error && <p role="alert">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy || !evidenceChanged(order, saved)}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save evidence'}</Button>
      </DialogFooter>
    </fieldset>
  </form>;
}
