"use client";
import { useEffect, useRef, useState } from 'react';
import { ClipboardCheck, Copy, ListChecks, Workflow } from 'lucide-react';
import { buildAutomationBrief } from '@/lib/automation-brief';
import type { ProposalState } from '@/lib/proposal-model';
import { Button } from './ui/button';

export function AutomationBrief({proposal,orderKey}:{proposal:ProposalState;orderKey:string}) {
  const brief=buildAutomationBrief(proposal,orderKey);
  const [message,setMessage]=useState(''),[copyFailed,setCopyFailed]=useState(false),[copying,setCopying]=useState(false);
  const prompt=useRef<HTMLTextAreaElement>(null),disclosure=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{setMessage('');setCopyFailed(false);},[proposal.version,orderKey]);
  if(!brief)return null;
  function selectPrompt(){if(disclosure.current)disclosure.current.open=true;requestAnimationFrame(()=>{prompt.current?.focus();prompt.current?.select();});}
  async function copy(){if(!brief||copying)return;setCopying(true);setMessage('');setCopyFailed(false);try{await navigator.clipboard.writeText(brief.text);setMessage('Prompt copied.');}catch{setCopyFailed(true);setMessage('Copy is unavailable. Select the prompt and copy it manually.');selectPrompt();}finally{setCopying(false);}}
  const groups=[{title:'Inputs',Icon:ListChecks,ids:['scope','providers','authority']},{title:'Build',Icon:Workflow,ids:['build','phone-guide']},{title:'Verify',Icon:ClipboardCheck,ids:['test','handoff']}];
  return <section className="automation-brief" aria-label={`Automation brief for ${brief.title}`}>
    <header className="automation-brief-header"><div><h4>Automation build brief</h4><p>Saved {proposal.internal?'internal plan':'accepted scope'} · revision {brief.scopeRevision} · setup {brief.setupRevision}</p></div><Button variant="outline" type="button" disabled={copying} onClick={()=>void copy()}><Copy aria-hidden="true" size={16}/>{copying?'Copying…':'Copy prompt'}</Button></header>
    {brief.missingInputs.length>0&&<div className="automation-brief-missing"><b>Inputs still needed</b><ul>{brief.missingInputs.map(item=><li key={item}>{item}</li>)}</ul></div>}
    <div className="automation-brief-grid">{groups.map(({title,Icon,ids})=><details key={title}><summary><Icon aria-hidden="true" size={16}/>{title}</summary>{brief.sections.filter(section=>ids.includes(section.id)).map(section=><div key={section.id}><h5>{section.title}</h5><ul>{section.items.map((item,i)=><li key={i}>{item}</li>)}</ul></div>)}</details>)}</div>
    <details className="automation-brief-prompt" ref={disclosure}><summary>Full prompt · {brief.guideVersion}</summary><p>This prompt uses saved records. Unsaved setup or scope edits are excluded.</p><textarea ref={prompt} readOnly value={brief.text} aria-label={`Full automation prompt for ${brief.title}`} rows={10}/><Button variant="outline" type="button" onClick={selectPrompt}>Select prompt</Button></details>
    {message&&<p role={copyFailed?'alert':'status'} className="automation-brief-feedback">{message}</p>}
  </section>;
}
