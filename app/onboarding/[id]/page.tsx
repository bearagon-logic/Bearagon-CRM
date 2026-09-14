import { CompanyWorkspace } from '@/components/company-workspace';
export default async function OnboardingDetail({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return <CompanyWorkspace key={id} workspace="onboarding"/>;
}
