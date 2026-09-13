import { env } from 'cloudflare:workers';
import { getRawDb } from '@/db';
import { publicWebsite } from '@/lib/company-research';
import { researchCompany, reserveResearch, ResearchError } from '@/lib/server/company-research';
import { getOperatorIdentity, operatorRequiredResponse } from '@/lib/server/operator-auth';

export async function POST(request: Request) {
  const actor=await getOperatorIdentity(request);
  if(!actor)return operatorRequiredResponse();
  const headers={'cache-control':'no-store'};
  try {
    const raw=await request.text();
    if(raw.length>2000)return Response.json({error:'Enter one company website.'},{status:400,headers});
    let website: string;
    try { website=publicWebsite((JSON.parse(raw) as {website?:unknown}).website); }
    catch(e) { return Response.json({error:e instanceof Error?e.message:'Enter a company website.'},{status:400,headers}); }
    const key=(env as unknown as {GEMINI_API_KEY?:string}).GEMINI_API_KEY?.trim();
    if(!key)throw new ResearchError('Website research is not connected yet. You can still enter company details manually.',503);
    await reserveResearch(getRawDb(),actor);
    return Response.json({research:await researchCompany(website,key)},{headers});
  } catch(e) {
    return Response.json({error:e instanceof ResearchError?e.message:'Website research is temporarily unavailable. Your form is unchanged.'},{status:e instanceof ResearchError?e.status:500,headers});
  }
}
