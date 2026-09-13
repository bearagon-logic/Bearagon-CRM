"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { publicWebsite, researchLabels, type CompanyResearch, type ResearchKey } from '@/lib/company-research';

export function WebsiteResearch({website,onWebsiteChange,onApply,disabled=false,notesOnly=false}: {
  website:string;onWebsiteChange:(website:string)=>void;disabled?:boolean;notesOnly?:boolean;
  onApply:(result:CompanyResearch,fields:ResearchKey[],ideas:number[])=>boolean;
}) {
  const uid=useId(),pending=useRef<AbortController|null>(null),requestVersion=useRef(0);
  const [expanded,setExpanded]=useState(true);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [result,setResult]=useState<CompanyResearch|null>(null),[fields,setFields]=useState<ResearchKey[]>([]),[ideas,setIdeas]=useState<number[]>([]);
  useEffect(()=>()=>{requestVersion.current++;pending.current?.abort();},[]);
  function change(value:string){requestVersion.current++;pending.current?.abort();pending.current=null;setBusy(false);setResult(null);setFields([]);setIdeas([]);setError('');setNotice('');onWebsiteChange(value);}
  async function research(){
    if(pending.current)return;
    setError('');setNotice('');let url:string;
    try{url=publicWebsite(website);}catch(e){setError((e as Error).message);return;}
    const version=++requestVersion.current,controller=new AbortController();pending.current=controller;setBusy(true);
    try{
      const response=await fetch('/api/company-research',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({website:url}),signal:controller.signal});
      const data=await response.json() as {research?:CompanyResearch;error?:string};
      if(!response.ok||!data.research)throw Error(data.error||'The website lookup did not return a result.');
      if(version!==requestVersion.current)return;
      setResult(data.research);setExpanded(true);setFields([]);setIdeas([]);setNotice('Review the suggestions and select the ones you want to use.');
    }catch(e){if(version===requestVersion.current&&!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to research this website.');}
    finally{if(version===requestVersion.current){pending.current=null;setBusy(false);}}
  }
  return <div className="website-research">
    <div className="research-start"><label htmlFor={`${uid}-website`}>Company website<Input id={`${uid}-website`} inputMode="url" autoComplete="url" placeholder="example.com" maxLength={1000} value={website} disabled={disabled} onChange={e=>change(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(!disabled&&!busy)void research();}}}/></label><Button type="button" variant="outline" disabled={disabled||busy||!website.trim()} onClick={()=>void research()}>{busy?'Reading website…':'Find company details'}</Button></div>
    <p className="company-help">Reads public pages with Gemini. Review suggestions before adding them to {notesOnly?'company notes':'the form'}.</p>
    {busy&&<p role="status">Checking the website and relevant pages. This can take about a minute.</p>}
    {error&&<p role="alert" className="form-error">{error}</p>}{notice&&<p role="status" className="research-notice">{notice}</p>}
    {result&&<details className="research-review" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary>Review website suggestions · {result.fields.length} facts, {result.automations.length} ideas</summary>
      <h3>Found on the website</h3>{!result.fields.length&&<p>No company fields could be confirmed.</p>}
      {result.fields.map(f=><div className="research-fact" key={f.key}><Checkbox id={`${uid}-${f.key}`} checked={fields.includes(f.key)} disabled={disabled||busy} onCheckedChange={checked=>setFields(current=>checked===true?[...current,f.key]:current.filter(key=>key!==f.key))}/><div><label htmlFor={`${uid}-${f.key}`}>{researchLabels[f.key]}</label><p>{f.value}</p><a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">View source</a></div></div>)}
      {!!result.automations.length&&<><h3>Automation ideas to discuss</h3><p className="company-help">Selected ideas go into notes for review. They do not select services or approve work.</p>{result.automations.map((a,i)=><div className="research-fact" key={i}><Checkbox id={`${uid}-idea-${i}`} checked={ideas.includes(i)} disabled={disabled||busy} onCheckedChange={checked=>setIdeas(current=>checked===true?[...current,i]:current.filter(index=>index!==i))}/><div><label htmlFor={`${uid}-idea-${i}`}>{a.title}</label><p><b>Website evidence:</b> {a.evidence}</p><p><b>Potential benefit:</b> {a.benefit}</p><p><b>Confirm first:</b> {a.questions.join(' ')}</p><a href={a.sourceUrl} target="_blank" rel="noopener noreferrer">View source</a></div></div>)}</>}
      {result.warning&&<p role="status" className="company-help">{result.warning}</p>}
      <div className="company-actions"><Button type="button" disabled={disabled||busy||!fields.length&&!ideas.length} onClick={()=>{if(onApply(result,fields,ideas)){setFields([]);setIdeas([]);setExpanded(false);setNotice('Suggestions added to your draft. Review the fields and save when ready.');}}}>Use selected suggestions</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>{setResult(null);setNotice('');}}>Dismiss</Button></div>
    </details>}
  </div>;
}
