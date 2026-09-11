import { getRawDb } from '@/db';
import { getOperatorIdentity, operatorRequiredResponse } from '@/lib/server/operator-auth';
import { getPlatformFleet, getWorkspaceAutomationOverview } from '@/lib/server/console-platform';
import { parseTransfer, transferUnusedWorkspace } from '@/lib/server/workspace-transfer';
const json = (body:unknown,status=200) => Response.json(body,{status,headers:{'cache-control':'no-store'}});
export async function POST(request:Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({error:'A same-origin request is required.'},403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({error:'Use JSON.'},415);
  let transfer;
  try {
    const reader=request.body?.getReader();if(!reader)throw new Error('Missing request.');
    const chunks:Uint8Array[]=[];let size=0;
    try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new Error('Request is too large.');}chunks.push(value);}}finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    transfer=parseTransfer(JSON.parse(new TextDecoder().decode(bytes)));
  } catch(e) { return json({error:e instanceof Error?e.message:'Invalid request.'},400); }
  try {
    const fleet=await getPlatformFleet();
    if(!fleet.clients.some(c=>c.id===transfer.consoleClientId))return json({error:'Workspace not found in Console. Nothing changed.'},409);
    await getWorkspaceAutomationOverview(transfer.consoleClientId);
  } catch {return json({error:'Console could not verify this workspace. Nothing changed.'},502);}
  try {await transferUnusedWorkspace(getRawDb(),transfer,actor);return json({transferred:true});}
  catch(e){console.error(JSON.stringify({event:'workspace.transfer_failed'}));return json({error:e instanceof Error&&e.message.startsWith('Transfer not applied')?e.message:'Transfer could not be committed. Refresh connections before retrying.'},409);}
}
