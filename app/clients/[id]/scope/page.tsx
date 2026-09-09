import { redirect } from 'next/navigation';
export default async function ScopePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{step?:string}>}) {
  const {id}=await params;
  redirect(`/clients/${id}?tab=${(await searchParams).step==='setup'?'delivery':'services'}`);
}
