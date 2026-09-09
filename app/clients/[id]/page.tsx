import { CompanyWorkspace } from '@/components/company-workspace';
export default async function ClientDetail({params}:{params:Promise<{id:string}>}){ const {id}=await params; return <CompanyWorkspace key={id}/>; }
