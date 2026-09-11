import { AppShell } from '@/components/app-shell';
import { EmailWalkthrough } from '@/components/email-walkthrough';

export default async function EmailPlaybookPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return <AppShell><EmailWalkthrough accountId={id}/></AppShell>;
}
