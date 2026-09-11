import { getRawDb } from '@/db';
import { getOperatorIdentity, operatorRequiredResponse } from '@/lib/server/operator-auth';
import { newProposal, transitionProposal, ProposalError, type ProposalCommand } from '@/lib/proposal-model';
import { readProposal, persistProposal } from '@/lib/server/proposal-store';

type Context = { params: Promise<{id:string}> };
const json = (body: unknown,status=200) => Response.json(body,{status,headers:{'cache-control':'no-store'}});
async function boundedBody(request: Request): Promise<ProposalCommand> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ProposalError('Use a JSON request.',415);
  const reader=request.body?.getReader(); if(!reader)throw new ProposalError('Missing request.');
  const chunks:Uint8Array[]=[];let size=0;
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>120000){await reader.cancel();throw new ProposalError('Proposal exceeds the 120 KB limit.',413);}chunks.push(value);} } finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let body:unknown;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ProposalError('Invalid JSON.');}
  if(!body||typeof body!=='object'||Array.isArray(body)||!('expectedVersion' in body)||!Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<0||!('action' in body)||!['save','approve','accept','authorizeInternal','setup','order'].includes(String(body.action)))throw new ProposalError('Choose an action and a valid saved version.');
  return body as ProposalCommand;
}
export async function GET(request:Request,{params}:Context){
  const actor=await getOperatorIdentity(request);if(!actor)return operatorRequiredResponse();
  try{const {id}=await params;const db=getRawDb();const account=await db.prepare('SELECT name,organization_kind FROM accounts WHERE id=?').bind(id).first<{name:string;organization_kind:string}>();if(!account)return json({error:'Company not found.'},404);
    const revision = new URL(request.url).searchParams.get('revision');
    if (revision !== null) {
      if (!/^[1-9]\d{0,8}$/.test(revision)) return json({error:'Invalid history version.'},400);
      const archived=await db.prepare('SELECT state FROM proposal_revisions WHERE account_id=? AND version=?').bind(id,Number(revision)).first<{state:string}>();
      return archived?json({proposal:JSON.parse(archived.state),historical:true}):json({error:'That saved version was not found for this company.'},404);
    }
    const proposal=await readProposal(db,id)||newProposal(account.name,account.organization_kind==='internal');
    const history=await db.prepare('SELECT version,action,actor_email,created_at FROM proposal_revisions WHERE account_id=? ORDER BY version DESC LIMIT 40').bind(id).all();
    const closed=proposal.engagementId ? await db.prepare("SELECT status FROM engagements WHERE id=? AND account_id=?").bind(proposal.engagementId,id).first<{status:string}>():null;
    return json({proposal,history:history.results,closed:!!closed&&!['active','planned','blocked'].includes(closed.status),actor:{name:actor.displayName,email:actor.email}});
  }catch{console.error(JSON.stringify({event:'proposal.read_failed'}));return json({error:'Unable to load the saved proposal. Retry before making changes.'},500);}
}
export async function POST(request:Request,{params}:Context){
  const actor=await getOperatorIdentity(request);if(!actor)return operatorRequiredResponse();
  try{const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new ProposalError('Cross-origin changes are not allowed.',403);
    const command=await boundedBody(request);const {id}=await params;const db=getRawDb();const account=await db.prepare('SELECT name,organization_kind,status FROM accounts WHERE id=?').bind(id).first<{name:string;organization_kind:string;status:string}>();if(!account)throw new ProposalError('Company not found.',404);if(account.status==='archived')throw new ProposalError('Archived companies cannot be changed.',409);
    const before=await readProposal(db,id)||newProposal(account.name,account.organization_kind==='internal');
    if(before.engagementId&&['setup','order'].includes(command.action)){const engagement=await db.prepare('SELECT status FROM engagements WHERE id=? AND account_id=?').bind(before.engagementId,id).first<{status:string}>();if(!engagement||!['active','planned','blocked'].includes(engagement.status))throw new ProposalError('Closed delivery history is read-only.',409);}
    const stamp={id:actor.userId,name:actor.displayName,email:actor.email,at:new Date().toISOString()};
    const next=transitionProposal(before,command,stamp,()=>crypto.randomUUID());
    if(next===before)return json({proposal:before});
    const saved=await persistProposal(db,id,before,next,stamp,command.action,crypto.randomUUID());
    const history=await db.prepare('SELECT version,action,actor_email,created_at FROM proposal_revisions WHERE account_id=? ORDER BY version DESC LIMIT 40').bind(id).all();
    return json({proposal:saved,history:history.results});
  }catch(error){if(error instanceof ProposalError)return json({error:error.message},error.status);console.error(JSON.stringify({event:'proposal.write_failed'}));return json({error:'The change could not be committed. Reload the record before retrying.'},500);}
}
