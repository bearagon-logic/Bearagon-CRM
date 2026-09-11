import Link from 'next/link';
import type { WorkOrder } from '@/lib/proposal-model';

export function EmailWalkthroughLink({accountId,order,readOnly=false}:{accountId:string;order:WorkOrder;readOnly?:boolean}) {
  if(order.key!=='email')return null;
  const run=order.emailRun;
  const done=run?.steps.filter(s=>run.progress[s.id]?.status==='completed').length||0;
  return <div className="walkthrough-entry"><Link href={`/clients/${accountId}/playbooks/email`}>{readOnly?'View saved walkthrough':run?'Resume email setup':'Start guided email setup'} →</Link><span>{run?`${done} / ${run.steps.length} steps · ${run.config.owner||'Unassigned'}`:'Google Workspace or Microsoft 365 · saved step-by-step guidance'}</span></div>;
}
