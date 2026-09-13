import {getRawDb} from '@/db';
import {getOperatorIdentity,operatorRequiredResponse} from '@/lib/server/operator-auth';
import {parseOperationsOwner,saveOperationsOwner} from '@/lib/server/operations-owner';

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  const actor=await getOperatorIdentity(request);
  if(!actor)return operatorRequiredResponse();
  let input;
  try {input=parseOperationsOwner(await request.json());}
  catch(error){return Response.json({error:(error as Error).message},{status:400});}
  try {
    return Response.json(await saveOperationsOwner(getRawDb(),(await params).id,input,actor),{headers:{'cache-control':'no-store'}});
  } catch(error) {
    if((error as Error).message.startsWith('Owner not saved.'))return Response.json({error:(error as Error).message},{status:409});
    console.error('Unable to save operations owner',error);
    return Response.json({error:'Unable to save the operations owner. Your selection is still here.'},{status:500});
  }
}
