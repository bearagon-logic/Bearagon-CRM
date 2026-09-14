"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function InquiryCleanup({inquiry,onDone,disabled=false,open:controlledOpen,onOpenChange}:{inquiry:{id:string;companyName:string;updatedAt:string};onDone:(message:string)=>void;disabled?:boolean;open?:boolean;onOpenChange?:(open:boolean)=>void}) {
  const [localOpen,setLocalOpen]=useState(false),[kind,setKind]=useState("test"),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const open=controlledOpen??localOpen;
  const setOpen=(value:boolean)=>{setLocalOpen(value);onOpenChange?.(value);};
  return <>{controlledOpen===undefined&&<Button type="button" variant="outline" disabled={disabled} onClick={()=>{setKind("test");setReason("");setError("");setOpen(true);}}>Mark as test / spam</Button>}
    <Dialog open={open} onOpenChange={v=>{if(!busy && (v || !reason || window.confirm("Discard this cleanup note?")))setOpen(v);}}><DialogContent className="crm-dialog"><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{const response=await fetch("/api/inquiries/cleanup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:inquiry.id,updatedAt:inquiry.updatedAt,kind,reason})});const data=await response.json() as {error?:string;message:string};if(!response.ok)throw Error(data.error||"Cleanup failed.");setOpen(false);onDone(data.message);}catch(e){setError(e instanceof Error?e.message:"Cleanup failed.");}finally{setBusy(false);}}}>
      <DialogHeader><DialogTitle>Mark {inquiry.companyName} inquiry</DialogTitle><DialogDescription>Removes this inquiry from active work. Nothing is sent or permanently deleted. History stays available under Test / spam.</DialogDescription></DialogHeader>
      <div className="form-grid"><label>Classification<select disabled={busy} value={kind} onChange={e=>setKind(e.target.value)}><option value="test">Test submission</option><option value="spam">Spam</option></select></label><label>Reason<Textarea required maxLength={1000} disabled={busy} value={reason} onChange={e=>setReason(e.target.value)}/></label></div>
      <p>Test / spam is kept in history, not active work. A company created only for these submissions is removed from the active directory automatically. Existing leads, clients and companies with other work are retained.</p>
      {error&&<p role="alert">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy?"Saving…":"Confirm cleanup"}</Button></DialogFooter>
    </form></DialogContent></Dialog></>;
}
