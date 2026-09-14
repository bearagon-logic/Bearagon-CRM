"use client";
import { useEffect, useState } from 'react';
import { Palette, Sun, Moon, Sparkles, Radio } from 'lucide-react';
import { CassettePlayer } from './cassette-player';
import { usePathname } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { appearanceKey, validAppearance, type Appearance } from '@/lib/appearance';

export function AppearanceControls(){
  const [mode,setMode]=useState<Appearance>('light'),[open,setOpen]=useState(false),[ambient,setAmbient]=useState(true),[storageNotice,setStorageNotice]=useState('');
  useEffect(()=>{
    const sync=()=>{let next:Appearance='light',motion=true;try{next=validAppearance(localStorage.getItem(appearanceKey));motion=localStorage.getItem('bearagon-ambient')!=='off';}catch{next=validAppearance(document.documentElement.dataset.appearance);}
      document.documentElement.dataset.appearance=next;document.documentElement.dataset.ambient=motion?'on':'off';setMode(next);setAmbient(motion);};
    sync();const changed=(e:StorageEvent)=>{if(e.key===appearanceKey||e.key==='bearagon-ambient'||e.key===null)sync();};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
  },[]);
  function choose(next:Appearance){setMode(next);document.documentElement.dataset.appearance=next;try{localStorage.setItem(appearanceKey,next);setStorageNotice('');}catch{setStorageNotice('Applied for this visit. This browser could not save your preference.');}}
  function motion(next:boolean){setAmbient(next);document.documentElement.dataset.ambient=next?'on':'off';try{localStorage.setItem('bearagon-ambient',next?'on':'off');}catch{setStorageNotice('Applied for this visit. This browser could not save your preference.');}}
  return <><button type="button" className="ops-appearance-trigger" title="Appearance" aria-label={`Appearance: ${mode}`} onClick={()=>setOpen(true)}><Palette aria-hidden="true"/><span>Appearance<small>{mode==='plaid'?'Plaid · after hours':mode==='dark'?'Dark':'Light'}</small></span></button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="appearance-dialog"><DialogHeader><DialogTitle>Make yourself at home</DialogTitle><DialogDescription>Choose your view of Bearagon. Saved in this browser.</DialogDescription></DialogHeader>
      <div className="appearance-choices" aria-label="Color mode">{([{id:'light',name:'Light',note:'The original. Clear & bright.',Icon:Sun},{id:'dark',name:'Dark',note:'Low light. Full focus.',Icon:Moon},{id:'plaid',name:'Plaid',note:'Neon nights. Zero restraint.',Icon:Sparkles}] as const).map(({id,name,note,Icon})=><button type="button" key={id} className={`appearance-choice appearance-swatch-${id}`} aria-pressed={mode===id} onClick={()=>choose(id)}><span className="appearance-mini" aria-hidden="true"><i/><i/><i/></span><b><Icon aria-hidden="true"/>{name}<span className="appearance-selected">{mode===id?'Selected':''}</span></b><small>{note}</small></button>)}</div>
      {mode==='plaid'&&<div className="appearance-plaid-note"><Sparkles aria-hidden="true"/><p>Welcome to the neon district. Cipher has a night shift. The cassette has a B-side. There may be a familiar cheat code…</p></div>}
      <label className="appearance-motion"><input type="checkbox" checked={ambient} onChange={e=>motion(e.target.checked)}/>Ambient animation in Plaid<small>Always respects your device’s reduced-motion setting.</small></label>
      {storageNotice&&<p role="status">{storageNotice}</p>}
    </DialogContent></Dialog></>;
}

const cipherLines=['Night shift activated. Snacks acquired.','I came here to automate and chew bamboo. Wrong bear.','No rogue agents. Just excellent sunglasses.','All your base are belong to bear.','Have you tried turning the neon off and on again?'];
export function PlaidScene(){
  const pathname=usePathname(),[line,setLine]=useState(0),[boost,setBoost]=useState(false);
  useEffect(()=>{if(!boost)return;const timer=setTimeout(()=>setBoost(false),4200);return()=>clearTimeout(timer);},[boost]);
  useEffect(()=>{const code=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];let index=0;
    const key=(e:KeyboardEvent)=>{if(document.documentElement.dataset.appearance!=='plaid'||e.ctrlKey||e.metaKey||e.altKey||(e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]'))return;const value=e.key.length===1?e.key.toLowerCase():e.key;index=value===code[index]?index+1:value===code[0]?1:0;if(index===code.length){index=0;setBoost(true);}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const district=pathname.startsWith('/communications')?'Signal exchange':pathname.startsWith('/companies')?'The directory':pathname.startsWith('/clients')?'Client district':pathname.startsWith('/onboarding')?'Launch boulevard':pathname.startsWith('/operations')?'Mission control':pathname.startsWith('/approvals')?'Human checkpoint':pathname.startsWith('/playbooks')?'The blueprint arcade':'Neon headquarters';
  return <section className={`plaid-scene${boost?' plaid-boost':''}`} aria-label="Plaid lounge"><div className="plaid-stars" aria-hidden="true"/><div className="plaid-scene-copy"><small>BEARAGON AFTER HOURS / {district}</small><strong>{boost?'THEY’VE GONE TO PLAID.':'THE FUTURE CALLED.'}</strong><span>{boost?'Secret unlocked. Ludicrous style enabled.':'It wants its neon back.'}</span></div><div className="plaid-toys"><CassettePlayer/><button type="button" className="plaid-cipher" title="Check in with Cipher" onClick={()=>setLine(v=>(v+1)%cipherLines.length)}><img src="/cipher-bearagon.png" alt=""/><span>CIPHER // NIGHT SHIFT<small>{cipherLines[line]}</small></span></button></div><div className="plaid-secret" role="status">{boost&&'Secret unlocked: ludicrous style.'}</div><Radio className="plaid-signal" aria-hidden="true"/></section>;
}
