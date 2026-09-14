import type {getRawDb} from '@/db';
import type {OperatorIdentity} from './operator-auth';
type Db=ReturnType<typeof getRawDb>;
export const companyRemovalType='Company removal';
export function canReviewRemoval(row:{requester_id:string;requester_email:string;reviewer_email:string},actor:OperatorIdentity) {
  const email=actor.email.trim().toLowerCase();
  return !!row.requester_id && !!row.requester_email && row.requester_id!==actor.userId && row.requester_email.toLowerCase()!==email && row.reviewer_email.toLowerCase()===email;
}
export async function requestCompanyRemoval(db:Db,input:{accountId:string;kind:'test'|'spam';reason:string;reviewerEmail:string;requestKey:string},actor:OperatorIdentity,reviewers:Set<string>) {
  const email=actor.email.trim().toLowerCase(),reviewer=input.reviewerEmail.trim().toLowerCase();
  if(!reviewers.has(reviewer)||reviewer===email)return {status:400,error:'Choose a different authorized operator to review this request.'};
  const account=await db.prepare("SELECT id,name,status,organization_kind FROM accounts WHERE id=?").bind(input.accountId).first<{id:string;name:string;status:string;organization_kind:string}>();
  if(!account)return {status:404,error:'Company not found.'};
  if(account.status!=='active'||account.organization_kind!=='external')return {status:409,error:'Only active external companies can be submitted for removal.'};
  const prior=await db.prepare('SELECT * FROM decision_requests WHERE request_key=?').bind(input.requestKey).first();
  if(prior){
    if(prior.account_id!==input.accountId||prior.type!==companyRemovalType||prior.requester_id!==actor.userId||prior.removal_kind!==input.kind||prior.summary!==input.reason||prior.reviewer_email!==reviewer)return {status:409,error:'That request key belongs to another request.'};
    return {status:200,id:String(prior.id),message:'This request is already recorded.'};
  }
  const id=crypto.randomUUID(),auditId=crypto.randomUUID();
  const title=`Remove ${account.name} as ${input.kind==='test'?'test data':'spam'}`.slice(0,160);
  try {
    const result=await db.batch([
      db.prepare(`INSERT INTO decision_requests (id,account_id,type,request_key,title,summary,risk_level,status,requested_by,requester_id,requester_email,reviewer_email,removal_kind)
        SELECT ?,id,'Company removal',?,?,?,'restricted','pending',?,?,?,?,? FROM accounts WHERE id=? AND status='active' AND organization_kind='external' RETURNING id`).bind(id,input.requestKey,title,input.reason,actor.displayName,actor.userId,email,reviewer,input.kind,input.accountId),
      db.prepare(`INSERT INTO operator_audit_events (id,account_id,resource_type,resource_id,action,actor_id,actor_email,actor_name,result,detail)
        SELECT ?,account_id,'decision_request',id,'company.removal_requested',?,?,?,'pending',? FROM decision_requests WHERE id=?`).bind(auditId,actor.userId,email,actor.displayName,`${input.kind}; reviewer: ${reviewer}; ${input.reason}`,id),
    ]);
    if(!result[0].results.length)return {status:409,error:'The company changed. Refresh before requesting removal.'};
    return {status:201,id,message:'Removal request sent to the selected reviewer. The company remains active until approval.'};
  } catch(error) {
    const pending=await db.prepare("SELECT id FROM decision_requests WHERE account_id=? AND type='Company removal' AND status='pending'").bind(input.accountId).first<{id:string}>();
    if(pending)return {status:409,id:pending.id,error:'This company already has a pending removal request.'};
    throw error;
  }
}
export async function decideCompanyRemoval(db:Db,id:string,status:'approved'|'rejected',actor:OperatorIdentity) {
  const row=await db.prepare('SELECT * FROM decision_requests WHERE id=?').bind(id).first<{account_id:string;type:string;status:string;requester_id:string;requester_email:string;reviewer_email:string;removal_kind:string}>();
  if(!row||row.type!==companyRemovalType)return {status:404,error:'Removal request not found.'};
  if(!canReviewRemoval(row,actor))return {status:403,error:'Only the assigned reviewer can decide this request. The requester cannot approve their own removal.'};
  if(row.status!=='pending')return {status:409,error:'This request has already been decided.'};
  const nonce=crypto.randomUUID(),now=new Date().toISOString(),email=actor.email.trim().toLowerCase();
  const results=await db.batch([
    db.prepare(`UPDATE decision_requests SET status=?,decided_by=?,decided_at=?,updated_at=?,decision_nonce=? WHERE id=? AND type='Company removal' AND status='pending'
      AND reviewer_email=? AND requester_id<>? AND lower(requester_email)<>?
      AND (?='rejected' OR EXISTS(SELECT 1 FROM accounts WHERE id=decision_requests.account_id AND status='active' AND organization_kind='external')) RETURNING id`).bind(status,actor.displayName,now,now,nonce,id,email,actor.userId,email,status),
    db.prepare(`UPDATE accounts SET status='archived',updated_at=? WHERE id=(SELECT account_id FROM decision_requests WHERE id=? AND decision_nonce=? AND status='approved') AND status='active' AND organization_kind='external' RETURNING id`).bind(now,id,nonce),
    db.prepare(`INSERT INTO operator_audit_events (id,account_id,resource_type,resource_id,action,actor_id,actor_email,actor_name,result,detail)
      SELECT ?,account_id,'decision_request',id,'decision.decided',?,?,?,status,title FROM decision_requests WHERE id=? AND decision_nonce=?`).bind(nonce,actor.userId,email,actor.displayName,id,nonce),
    db.prepare(`INSERT INTO operator_audit_events (id,account_id,resource_type,resource_id,action,actor_id,actor_email,actor_name,result,detail)
      SELECT ?,account_id,'account',account_id,'company.archived',?,?,?,'succeeded',removal_kind || ': ' || summary || '; approved removal; records retained; no runtime command sent.' FROM decision_requests WHERE id=? AND decision_nonce=? AND status='approved'`).bind(crypto.randomUUID(),actor.userId,email,actor.displayName,id,nonce),
  ]);
  if(!results[0].results.length)return {status:409,error:'The request or company changed. Refresh before deciding.'};
  return {status:200,message:status==='approved'?'Approved. Company removed from active Ops listings; records retained.':'Rejected. Company remains in its current workflow.'};
}
