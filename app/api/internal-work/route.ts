import {getRawDb} from '@/db';
import {getOperatorIdentity,operatorRequiredResponse} from '@/lib/server/operator-auth';
import {internalBacklog} from '@/lib/internal-operations';
import type {ProposalState} from '@/lib/proposal-model';
export async function GET(request:Request){
  if(!await getOperatorIdentity(request))return operatorRequiredResponse();
  try {
    const rows=await getRawDb().prepare("SELECT a.id,a.name,a.relationship_owner owner,p.state FROM accounts a LEFT JOIN account_proposals p ON p.account_id=a.id WHERE a.organization_kind='internal' AND a.status!='archived'").all<{id:string;name:string;owner:string;state:string|null}>();
    return Response.json({items:rows.results.flatMap(row=>internalBacklog(row,row.state?JSON.parse(row.state) as ProposalState:null))},{headers:{'cache-control':'no-store'}});
  }catch{return Response.json({error:'Internal automation work is unavailable.'},{status:500});}
}
