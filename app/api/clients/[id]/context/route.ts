import { getRawDb } from '@/db';
import { contextInput, saveCompanyContext } from '@/lib/server/company-context';
import { publicWebsite } from '@/lib/company-research';
import { getOperatorIdentity, operatorRequiredResponse } from '@/lib/server/operator-auth';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  const actor=await getOperatorIdentity(request);if(!actor)return operatorRequiredResponse();
  let value;
  try { const raw=await request.text();if(raw.length>50000)throw Error();value=contextInput.parse(JSON.parse(raw));if(value.website.trim())publicWebsite(value.website); }
  catch { return Response.json({error:'Enter a public website and keep company notes within 5,000 characters.'},{status:400}); }
  try { return Response.json(await saveCompanyContext(getRawDb(),(await params).id,value,actor),{headers:{'cache-control':'no-store'}}); }
  catch { return Response.json({error:'Company context was not saved. The record may have changed; your draft is kept. Reload before trying again.'},{status:409}); }
}
