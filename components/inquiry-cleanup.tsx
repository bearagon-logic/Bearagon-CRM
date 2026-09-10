"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function InquiryCleanup({inquiry,onDone,disabled=false}:{inquiry:{id:string;companyName:string;updatedAt:string};onDone:(message:string)=>void;disabled?:boolean}) {
  const [open,setOpen]=useState(false),[kind,setKind]=useState("test"),[reason,setReason]=useState(""),[archive,setArchive]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  return <><Button type="button" variant="outline" disabled={disabled} onClick={()=>{setKind("test");setReason("");setArchive(false);setError("");setOpen(true);}}>Mark as test / spam</Button>
    <Dialog open={open} onOpenChange={v=>{if(!busy && (v || !reason || window.confirm("Discard this cleanup note?")))setOpen(v);}}><DialogContent className="crm-dialog"><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{const response=await fetch("/api/inquiries/cleanup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:inquiry.id,updatedAt:inquiry.updatedAt,kind,reason,archiveCompany:archive})});const data=await response.json() as {error?:string;message:string};if(!response.ok)throw Error(data.error||"Cleanup failed.");setOpen(false);onDone(data.message);}catch(e){setError(e instanceof Error?e.message:"Cleanup failed.");}finally{setBusy(false);}}}>
      <DialogHeader><DialogTitle>Mark {inquiry.companyName} inquiry</DialogTitle><DialogDescription>Removes this inquiry from active work. Nothing is sent or permanently deleted. History stays available under Test / spam.</DialogDescription></DialogHeader>
      <div className="form-grid"><label>Classification<select disabled={busy} value={kind} onChange={e=>setKind(e.target.value)}><option value="test">Test submission</option><option value="spam">Spam</option></select></label><label>Reason<Textarea required maxLength={1000} disabled={busy} value={reason} onChange={e=>setReason(e.target.value)}/></label></div>
      <label><input type="checkbox" disabled={busy} checked={archive} onChange={e=>setArchive(e.target.checked)}/> Also archive this test-only prospect company</label><p>Only unused prospects qualify. Clients, shared contacts, other inquiries and any scope or delivery work prevent company archival. Contact records are retained.</p>
      {error&&<p role="alert">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy?"Saving…":"Confirm cleanup"}</Button></DialogFooter>
    </form></DialogContent></Dialog></>;
}
