import { EmailWalkthroughWorkspace } from '@/components/email-walkthrough';

export default async function EmailPlaybookPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return <EmailWalkthroughWorkspace key={id} accountId={id}/>;
}
