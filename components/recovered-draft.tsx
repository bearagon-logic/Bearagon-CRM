"use client";
import {useRef,useState} from 'react';
import {Button} from './ui/button';

export function RecoveredDraft({text}:{text:string}){
  const input=useRef<HTMLTextAreaElement>(null),[message,setMessage]=useState('');
  return <details className="recovered-draft"><summary>Recovered unsaved entries — available to copy</summary><p>These entries are your draft, separate from the current saved record.</p><textarea ref={input} readOnly value={text} rows={10} aria-label="Recovered unsaved entries"/><Button variant="outline" type="button" onClick={async()=>{try{await navigator.clipboard.writeText(text);setMessage('Recovered entries copied.');}catch{input.current?.focus();input.current?.select();setMessage('Entries selected. Copy them manually.');}}}>Copy recovered entries</Button>{message&&<p role="status">{message}</p>}</details>;
}
