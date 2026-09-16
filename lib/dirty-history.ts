export type DirtyHistoryParticipant = {dirty:()=>boolean;retain:()=>void;discard:()=>void};
type NavigationEvent = Event & {navigationType?:string};
type HistorySurface = Pick<EventTarget,'addEventListener'|'removeEventListener'> & {navigation?:Pick<EventTarget,'addEventListener'|'removeEventListener'>};

// No synthetic history entries, URL rewriting or global history method patches.
// Non-cancelable traversal retains drafts before the router can unmount editors.
export function createDirtyHistoryGuard(surface:HistorySurface,confirmDiscard:()=>boolean){
  const participants=new Set<DirtyHistoryParticipant>();
  let handledTraversal=false;
  const active=()=>[...participants].filter(participant=>participant.dirty());
  const navigate=(raw:Event)=>{
    const event=raw as NavigationEvent;handledTraversal=false;
    if(event.navigationType!=='traverse'||event.defaultPrevented)return;
    const dirty=active();if(!dirty.length)return;
    if(event.cancelable){
      if(!confirmDiscard()){event.preventDefault();return;}
      dirty.forEach(participant=>participant.discard());
    }else dirty.forEach(participant=>participant.retain());
    handledTraversal=true;
  };
  const pop=()=>{if(handledTraversal){handledTraversal=false;return;}active().forEach(participant=>participant.retain());};
  surface.navigation?.addEventListener('navigate',navigate);
  surface.addEventListener('popstate',pop,true);
  return {register(participant:DirtyHistoryParticipant){participants.add(participant);return()=>{participants.delete(participant);};},discard(){active().forEach(participant=>participant.discard());},dispose(){surface.navigation?.removeEventListener('navigate',navigate);surface.removeEventListener('popstate',pop,true);participants.clear();}};
}

// Tab-memory only: no business drafts are written to storage or another account.
const drafts=new Map<string,unknown>();
const pending=new Map<string,Promise<void>>();
export function retainHistoryDraft<T>(key:string,draft:T){drafts.set(key,structuredClone(draft));}
export function takeHistoryDraft<T>(key:string):T|undefined{const value=drafts.get(key) as T|undefined;drafts.delete(key);return value;}
export function clearHistoryDraft(key:string){drafts.delete(key);}
export function recoveryText(value:unknown,prefix=''):string{
  if(value===null||value===undefined)return `${prefix}: Not entered`;
  if(typeof value!=='object')return `${prefix}: ${String(value)}`;
  return Object.entries(value).map(([key,entry])=>recoveryText(entry,`${prefix}${prefix?' / ':''}${key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ')}`)).join('\n');
}
export async function waitForHistorySave(key:string){await pending.get(key);}
export function beginHistorySave<T=unknown>(key:string){
  let resolve!:()=>void,finished=false;
  const promise=new Promise<void>(done=>{resolve=done;});pending.set(key,promise);
  return(success:boolean,reconcile?:(draft:T)=>T|undefined)=>{if(finished)return;finished=true;if(success){if(reconcile&&drafts.has(key)){const remaining=reconcile(drafts.get(key) as T);if(remaining===undefined)clearHistoryDraft(key);else drafts.set(key,structuredClone(remaining));}else if(!reconcile)clearHistoryDraft(key);}if(pending.get(key)===promise)pending.delete(key);resolve();};
}
