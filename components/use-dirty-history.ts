"use client";
import {useEffect,useRef} from 'react';
import {createDirtyHistoryGuard,type DirtyHistoryParticipant} from '@/lib/dirty-history';

let guard:ReturnType<typeof createDirtyHistoryGuard>|undefined;
let users=0;
export function discardCurrentHistoryDrafts(){guard?.discard();}
export function useDirtyHistory(participant:DirtyHistoryParticipant){
  const latest=useRef(participant);latest.current=participant;
  useEffect(()=>{
    guard??=createDirtyHistoryGuard(window,()=>window.confirm('Leave this page and discard unsaved changes?'));
    users++;
    const unregister=guard.register({dirty:()=>latest.current.dirty(),retain:()=>latest.current.retain(),discard:()=>latest.current.discard()});
    return()=>{unregister();if(--users===0){guard?.dispose();guard=undefined;}};
  },[]);
}
