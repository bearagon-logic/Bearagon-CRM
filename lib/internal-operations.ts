import type {ProposalState,WorkOrder} from './proposal-model';
export function internalStage(order:WorkOrder,revision:number) {
  if(order.setupRevision!==revision)return 'Planned';
  if(order.status==='tested'&&order.buildRef.trim()&&order.testRef.trim()&&order.internalRelease?.setupRevision===revision&&order.internalRelease.review.trim())return 'Operating';
  return order.status==='to_build'?'Planned':order.status==='building'?'Building':'Testing';
}
export function internalBacklog(account:{id:string;name:string;owner:string},proposal:ProposalState|null) {
  if(!proposal?.internal||!proposal.acceptance)return [{id:`internal:${account.id}:setup`,company:account.name,title:'Establish the internal automation plan',owner:account.owner||'Unassigned',due:'',kind:'Internal automation',href:`/clients/${encodeURIComponent(account.id)}?tab=services`,priority:3}];
  return proposal.orders.filter(o=>internalStage(o,proposal.setup.revision)!=='Operating').map(o=>({id:`internal:${account.id}:${o.key}`,company:account.name,title:`${o.name} — ${o.status==='tested'?'review for ongoing use':internalStage(o,proposal.setup.revision).toLowerCase()}`,owner:account.owner||'Unassigned',due:'',kind:'Internal automation',href:`/clients/${encodeURIComponent(account.id)}?tab=delivery#internal-${encodeURIComponent(o.key)}`,priority:3}));
}
