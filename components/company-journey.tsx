"use client";
import { journeyLabels } from '@/lib/company-journey';
export function CompanyJourney({phase,onNavigate}:{phase:number;onNavigate:(phase:number)=>void}) {
  return <ol className="company-journey" aria-label="Company journey">{journeyLabels.map((label,i)=><li key={label} className={i===phase?'current':i<phase?'done':''} aria-current={i===phase?'step':undefined}><button onClick={()=>onNavigate(i)}><span>{i<phase?'✓':i+1}</span>{label}</button></li>)}</ol>;
}
