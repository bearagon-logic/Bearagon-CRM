"use client";
import { journeyLabels } from '@/lib/company-journey';
export function CompanyJourney({phase,onNavigate,deliveryAvailable=phase>=2,buildAvailable=phase>=3}:{phase:number;onNavigate:(phase:number)=>void;deliveryAvailable?:boolean;buildAvailable?:boolean}) {
  return <ol className="company-journey" aria-label="Company journey">{journeyLabels.map((label,i)=>{
    const available=i<2||(i===4?phase===4:i===3?buildAvailable:deliveryAvailable);
    const state=i===phase?'Current':available?'Available':'Later';
    return <li key={label} className={i===phase?'current':available?'available':'later'} aria-current={i===phase?'step':undefined}><button type="button" disabled={!available} onClick={()=>onNavigate(i)} title={!available?(i===4?'Available after the saved onboarding handoff.':i===3?'Available after all setup answers are saved.':'Available after accepted scope.'):undefined}><span aria-hidden="true">{i+1}</span><span className="journey-label"><b>{label}</b><small>{state}</small></span></button></li>;
  })}</ol>;
}
