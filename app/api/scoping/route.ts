import { getRawDb } from '@/db';
import { getOperatorIdentity, operatorRequiredResponse } from '@/lib/server/operator-auth';
import { readScopingWork } from '@/lib/server/scoping-work';

export async function GET(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  try {
    const scoping = await readScopingWork(getRawDb());
    return Response.json({ scoping }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load scope preparation', error);
    return Response.json({ error: 'Unable to load scope preparation.' }, { status: 500 });
  }
}
