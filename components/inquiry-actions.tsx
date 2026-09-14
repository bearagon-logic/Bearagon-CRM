"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { InquiryCleanup } from './inquiry-cleanup';
import type { InquiryRecord } from '@/lib/workspace-model';

export function InquiryActions({inquiry,onDone,disabled=false}:{inquiry:InquiryRecord;onDone:(message:string)=>void;disabled?:boolean}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[cleanup,setCleanup]=useState(false);
  async function route(action:'lead'|'workflow') {
    if(busy||disabled)return;setBusy(true);setError('');
    try {
      const response=await fetch('/api/inquiries',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action,id:inquiry.id,accountId:inquiry.accountId,expectedUpdatedAt:inquiry.updatedAt})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw Error(data.error||'Unable to update this inquiry.');
      onDone(action==='lead'?`${inquiry.companyName} marked as a lead. Follow-up remains in the queue.`:`${inquiry.companyName} handed off to the client workflow.`);
      if(action==='workflow')router.push(`/clients/${encodeURIComponent(inquiry.accountId)}?tab=services`);
    } catch(e) {setError(e instanceof Error?e.message:'Unable to update this inquiry.');}
    finally {setBusy(false);}
  }
  return <div className="queue-row-menu">
    <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" disabled={busy||disabled} aria-label={`Actions for ${inquiry.companyName}`}>{busy?'Saving…':'Actions'}<ChevronDown size={14}/></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="inquiry-action-menu">
        <DropdownMenuItem onSelect={()=>{setError('');setCleanup(true);}}>Mark as test / spam</DropdownMenuItem>
        <DropdownMenuItem disabled={inquiry.status==='qualified'} onSelect={()=>void route('lead')}>{inquiry.status==='qualified'?'Already marked as lead':'Mark as lead'}</DropdownMenuItem>
        <DropdownMenuItem onSelect={()=>void route('workflow')}><span>Start client workflow<small>Hand off inquiry and open service scope</small></span></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {cleanup&&<InquiryCleanup inquiry={inquiry} open={cleanup} onOpenChange={setCleanup} onDone={onDone}/>}
    {error&&<p className="queue-action-error" role="alert">{error}</p>}
  </div>;
}
