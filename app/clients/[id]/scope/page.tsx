import { ProposalWorkspace } from '@/components/proposal-workspace';
export default async function ScopePage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return <ProposalWorkspace accountId={id}/>;
}
