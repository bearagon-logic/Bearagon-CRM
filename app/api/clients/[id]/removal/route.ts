import {getRawDb} from '@/db';
import {z} from 'zod';
import {getOperatorIdentity,operatorRequiredResponse,configuredOperatorEmails} from '@/lib/server/operator-auth';
import {requestCompanyRemoval} from '@/lib/server/company-removal';
const input=z.object({kind:z.enum(['test','spam']),reason:z.string().trim().min(1).max(2000),reviewerEmail:z.string().trim().email(),requestKey:z.string().min(8).max(160)});
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 const actor=await getOperatorIdentity(request);if(!actor)return operatorRequiredResponse();
 const {id}=await params,db=getRawDb();
 const pending=await db.prepare("SELECT id,status,reviewer_email AS reviewerEmail,removal_kind AS kind,summary AS reason FROM decision_requests WHERE account_id=? AND type='Company removal' AND status='pending' ORDER BY created_at DESC LIMIT 1").bind(id).first();
 return Response.json({pending,reviewers:[...configuredOperatorEmails()].filter(email=>email!==actor.email.toLowerCase())},{headers:{'cache-control':'no-store'}});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 const actor=await getOperatorIdentity(request);if(!actor)return operatorRequiredResponse();
 const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:parsed.error.issues[0].message},{status:400});
 const {id}=await params;
 try{const result=await requestCompanyRemoval(getRawDb(),{...parsed.data,accountId:id},actor,configuredOperatorEmails());return Response.json(result,{status:result.status});}
 catch{ return Response.json({error:'Unable to save the removal request. Refresh before retrying.'},{status:500}); }
}
