import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,cacheDir:root+'/.vite-test-cache/dirty-history',resolve:{alias:{'@':root}},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {createDirtyHistoryGuard,retainHistoryDraft,takeHistoryDraft,clearHistoryDraft,beginHistorySave,waitForHistorySave}=await vite.ssrLoadModule('/lib/dirty-history.ts');
const {reconcileCompanyHistoryDraft}=await vite.ssrLoadModule('/lib/company-history.ts');
function surface(withNavigation=true){const window=new EventTarget();if(withNavigation)window.navigation=new EventTarget();window.history={pushState(){assert.fail('must not add history entries');},replaceState(){assert.fail('must not replace router state');},go(){assert.fail('must not bounce browser history');}};return window;}
function traverse(window,cancelable=true){const event=new Event('navigate',{cancelable});Object.defineProperty(event,'navigationType',{value:'traverse'});window.navigation.dispatchEvent(event);if(!event.defaultPrevented)window.dispatchEvent(new Event('popstate'));return event;}

test('Back and Forward cancellation preserves both live drafts and prompts only once per traversal',()=>{
  const window=surface();let prompts=0,retained=0,discarded=0;
  const guard=createDirtyHistoryGuard(window,()=>{prompts++;return false;});
  const remove=guard.register({dirty:()=>true,retain:()=>retained++,discard:()=>discarded++});
  guard.register({dirty:()=>true,retain:()=>retained++,discard:()=>discarded++});
  for(const direction of ['back','forward'])assert.equal(traverse(window).defaultPrevented,true,direction);
  assert.equal(prompts,2);assert.equal(retained,0);assert.equal(discarded,0);
  remove();guard.dispose();traverse(window);assert.equal(prompts,2);
});

test('confirmed traversal discards each editor once, without a second prompt or snapshot on popstate',()=>{
  const window=surface();let prompts=0,retained=0,discarded=0;
  const guard=createDirtyHistoryGuard(window,()=>{prompts++;return true;});
  guard.register({dirty:()=>true,retain:()=>retained++,discard:()=>discarded++});
  guard.register({dirty:()=>true,retain:()=>retained++,discard:()=>discarded++});
  assert.equal(traverse(window).defaultPrevented,false);assert.equal(prompts,1);assert.equal(discarded,2);assert.equal(retained,0);guard.dispose();
});

test('noncancelable and legacy traversals retain the latest values before router teardown, without prompting',()=>{
  for(const modern of [true,false]){const window=surface(modern);let typed='earlier',retained=0;const key=`fallback-${modern}`;
    const guard=createDirtyHistoryGuard(window,()=>assert.fail('noncancelable navigation must not show a misleading stay prompt'));
    guard.register({dirty:()=>true,retain:()=>{retained++;retainHistoryDraft(key,{typed,version:3});},discard:()=>assert.fail('must retain')});
    typed='latest keystroke';if(modern)traverse(window,false);else window.dispatchEvent(new Event('popstate'));
    assert.equal(retained,1);assert.deepEqual(takeHistoryDraft(key),{typed:'latest keystroke',version:3});guard.dispose();
  }
});

test('fallback retention followed by explicit discard or manual revert cannot resurrect a stale draft',()=>{
  const window=surface(false),key='discard-return';let dirty=true;
  const guard=createDirtyHistoryGuard(window,()=>true);
  guard.register({dirty:()=>dirty,retain:()=>retainHistoryDraft(key,{notes:'unsaved'}),discard:()=>{clearHistoryDraft(key);dirty=false;}});
  window.dispatchEvent(new Event('popstate'));guard.discard();assert.equal(takeHistoryDraft(key),undefined);
  dirty=true;window.dispatchEvent(new Event('popstate'));dirty=false;clearHistoryDraft(key); // clean-editor effect after revert/cancel
  guard.dispose();assert.equal(takeHistoryDraft(key),undefined);
});

test('drafts remain account/editor scoped and preserve the original conflict baseline across repeat departures',()=>{
  const v1={website:'old',tasks:[{id:'t',note:'original'}]},v2={website:'another operator',tasks:[{id:'t',note:'changed'}]};
  retainHistoryDraft('company:A',{baseline:v1,notes:'my unsaved note'});retainHistoryDraft('proposal:B:services',{version:7,contact:'Unsigned contact draft'});
  const first=takeHistoryDraft('company:A');assert.notDeepEqual(first.baseline,v2);
  retainHistoryDraft('company:A',first);const second=takeHistoryDraft('company:A');assert.deepEqual(second.baseline,v1);assert.notDeepEqual(second.baseline,v2);
  assert.deepEqual(takeHistoryDraft('proposal:B:services'),{version:7,contact:'Unsigned contact draft'});assert.equal(takeHistoryDraft('proposal:A:services'),undefined);
});

test('returning during a save waits; success clears the pre-save snapshot, failure retains its original version',async()=>{
  for(const success of [true,false]){const key=`pending-${success}`,finish=beginHistorySave(key);retainHistoryDraft(key,{version:4,setup:['unsaved']});let resumed=false;
    const wait=waitForHistorySave(key).then(()=>{resumed=true;});await Promise.resolve();assert.equal(resumed,false);
    finish(success);await wait;assert.equal(resumed,true);
    assert.deepEqual(takeHistoryDraft(key),success?undefined:{version:4,setup:['unsaved']});finish(!success);
  }
});

test('editor integration retains acceptance-only drafts, uses saved summaries and exposes external recovery controls',async()=>{
  const proposal=await readFile(new URL('../components/proposal-workspace.tsx',import.meta.url),'utf8');
  assert.match(proposal,/!proposal\.acceptance&&!!\(reference\|\|contact\|\|date\|\|confirmed\)/);
  assert.match(proposal,/useEffect\(\(\)=>\(\)=>dirtyNotifier.current\?\.\(false\),\[\]\)/);
  assert.match(proposal,/if\(generation!==loadGeneration.current\)return/);
  assert.match(proposal,/expectedVersion:recoveredVersion\?\?proposal\.version/);
  assert.match(proposal,/<p>\{proposal!\.setup\.answers\[i\]\}<\/p>/);
  assert.match(proposal,/setRecoveredEvidence\(changed\?recovered.order:null\);if\(changed\)setOrder\(null\)/);
  const company=await readFile(new URL('../components/company-workspace.tsx',import.meta.url),'utf8');
  assert.match(company,/if\(generation!==loadGeneration.current\)return/);
  assert.match(company,/baseline:recoveryBaseline.current\|\|detail/);
  assert.match(company,/dirty:\(\)=>!!companyDirty/);
  const external=company.slice(company.indexOf("return <AppShell activeSection={view==='company'"));
  assert.match(external,/<RecoveredDraft/);assert.match(external,/Reload saved company record/);
  assert.match(company,/detail\?\.client.id===id&&!companyDirty/);
  const relation=await readFile(new URL('../components/account-relationship.tsx',import.meta.url),'utf8');
  assert.match(relation,/useEffect\(\(\)=>\(\)=>dirtyNotifier.current\?\.\(false\),\[\]\)/);
  assert.match(relation,/if\(!active\)return/);
  assert.match(relation,/baseline:baseline.current/);assert.match(relation,/disabled=\{saving\|\|recoveryBlocked\}/);
});

test('unmount clears parent dirty indication while preserving its inactive editor draft for return',()=>{
  const window=surface(false),key='scope-unmount';let parentDirty=true;
  const guard=createDirtyHistoryGuard(window,()=>assert.fail('clean parent navigation should not promise to discard an inactive editor'));
  const unregister=guard.register({dirty:()=>true,retain:()=>retainHistoryDraft(key,{version:2,scope:'draft'}),discard:()=>clearHistoryDraft(key)});
  window.dispatchEvent(new Event('popstate'));unregister();parentDirty=false;
  assert.equal(parentDirty,false);guard.discard();
  assert.deepEqual(takeHistoryDraft(key),{version:2,scope:'draft'});guard.dispose();
});

const requirement=(id,note='saved')=>({id,status:'in_progress',evidenceRef:'',completionNote:note,blockedReason:''});
function companySnapshot(){const a=requirement('A'),b=requirement('B');return {baseline:{client:{website:'https://saved.test',notes:'saved notes',relationshipOwner:'Emily',dueDate:'2026-10-01',nextStep:'saved next'},tasks:[a,b]},website:'https://saved.test',notes:'saved notes',savedNotes:'saved notes',operationsOwner:'Emily',target:'2026-10-01',next:'saved next',task:requirement('B','B to save'),requirements:[['A',requirement('A','A unsaved')],['B',requirement('B','B to save')]],contextEditorOpen:false};}

test('partial requirement save during fallback travel preserves A and removes saved B before return resumes',async()=>{
  const key='partial-company',window=surface(false),guard=createDirtyHistoryGuard(window,()=>false),snapshot=companySnapshot();
  const finish=beginHistorySave(key),unregister=guard.register({dirty:()=>true,retain:()=>retainHistoryDraft(key,snapshot),discard:()=>clearHistoryDraft(key)});
  window.dispatchEvent(new Event('popstate'));unregister();let resumed=false;
  const returning=waitForHistorySave(key).then(()=>{resumed=true;return takeHistoryDraft(key);});await Promise.resolve();assert.equal(resumed,false);
  const savedB=requirement('B','B to save');finish(true,cached=>reconcileCompanyHistoryDraft(cached,{kind:'requirement',saved:savedB,submitted:savedB}));
  const recovered=await returning;assert.equal(resumed,true);assert.equal(recovered.task,null);
  assert.deepEqual(recovered.requirements,[['A',requirement('A','A unsaved')]]);
  assert.deepEqual(recovered.baseline.tasks,[requirement('A'),savedB]);
  assert.deepEqual(recovered.baseline.client,snapshot.baseline.client);assert.deepEqual(snapshot.task,requirement('B','B to save'));
  guard.dispose();
});

test('late partial success never recreates discarded snapshots or erases a newer edit to the saved requirement',async()=>{
  const key='discard-partial',finish=beginHistorySave(key),b=requirement('B','B to save');
  retainHistoryDraft(key,companySnapshot());clearHistoryDraft(key);
  finish(true,cached=>reconcileCompanyHistoryDraft(cached,{kind:'requirement',saved:b,submitted:b}));await waitForHistorySave(key);assert.equal(takeHistoryDraft(key),undefined);
  const snapshot=companySnapshot();snapshot.task=requirement('B','a later B edit');snapshot.requirements[1]=['B',snapshot.task];
  const remaining=reconcileCompanyHistoryDraft(snapshot,{kind:'requirement',saved:b,submitted:b});
  assert.equal(remaining.task.completionNote,'a later B edit');assert.equal(remaining.requirements[1][1].completionNote,'a later B edit');assert.equal(remaining.baseline.tasks[1].completionNote,'B to save');
});

test('context owner and coordination successes clear only their saved group and preserve unrelated requirement baseline',()=>{
  for(const kind of ['context','owner','coordination']){
    const snapshot=companySnapshot();snapshot.task=null;snapshot.requirements=snapshot.requirements.slice(0,1);
    snapshot.website='https://draft.test';snapshot.notes='draft notes';snapshot.operationsOwner='Derek';snapshot.target='2026-11-01';snapshot.next='draft next';
    const change=kind==='context'?{kind,saved:{website:'https://draft.test',notes:'draft notes'},submitted:{website:snapshot.website,notes:snapshot.notes}}:kind==='owner'?{kind,saved:'Derek',submitted:'Derek'}:{kind,saved:{target:'2026-11-01',next:'draft next'},submitted:{target:snapshot.target,next:snapshot.next}};
    const remaining=reconcileCompanyHistoryDraft(snapshot,change);
    assert.deepEqual(remaining.requirements,snapshot.requirements);assert.deepEqual(remaining.baseline.tasks,snapshot.baseline.tasks);
    if(kind!=='context'){assert.equal(remaining.baseline.client.website,'https://saved.test');assert.equal(remaining.baseline.client.notes,'saved notes');}
    if(kind!=='owner')assert.equal(remaining.baseline.client.relationshipOwner,'Emily');
    if(kind!=='coordination')assert.equal(remaining.baseline.client.dueDate,'2026-10-01');
  }
});

test('successful last requirement removes the snapshot while failed partial saves keep every draft',async()=>{
  const snapshot=companySnapshot();snapshot.requirements=snapshot.requirements.slice(1);const b=requirement('B','B to save');
  assert.equal(reconcileCompanyHistoryDraft(snapshot,{kind:'requirement',saved:b,submitted:b}),undefined);
  const key='failed-partial',finish=beginHistorySave(key);retainHistoryDraft(key,companySnapshot());finish(false,cached=>reconcileCompanyHistoryDraft(cached,{kind:'requirement',saved:b,submitted:b}));await waitForHistorySave(key);
  assert.deepEqual(takeHistoryDraft(key),companySnapshot());
});
