import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test,{after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,cacheDir:path.join(root,'.vite-test-cache','proposals'),resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {newProposal,transitionProposal,proposalIssues}=await vite.ssrLoadModule('/lib/proposal-model.ts');
const {serviceCatalog,cents,scopeIssues}=await vite.ssrLoadModule('/lib/proposal-scope.ts');
const {persistProposal,readProposal}=await vite.ssrLoadModule('/lib/server/proposal-store.ts');
const {internalStage,internalBacklog}=await vite.ssrLoadModule('/lib/internal-operations.ts');
const {journeyPhase}=await vite.ssrLoadModule('/lib/company-journey.ts');
const {emailDefaults,emailSteps,emailGuideVersion,buildEmailBrief}=await vite.ssrLoadModule('/lib/email-playbook.ts');
const {EmailWalkthrough}=await vite.ssrLoadModule('/components/email-walkthrough.tsx');
const actor={id:'employee-1',name:'Test reviewer',email:'reviewer@example.test',at:'2026-09-08T12:00:00.000Z'};

test('internal operations opens immediately without changing client lifecycle rules',()=>{
  assert.equal(journeyPhase({organizationKind:'internal',stage:'Intake',onboardingStatus:'active'},null),4);
  assert.notEqual(journeyPhase({organizationKind:'external',stage:'Intake',onboardingStatus:'active'},null),4);
});
test('internal use approval is per automation and retracted when evidence changes',()=>{
  let s=change(accepted(true),{action:'setup',answers:['Outcome','Systems','Authority']});const key=s.orders[0].key;
  assert.throws(()=>change(s,{action:'releaseInternal',key,review:'Boundaries',confirmed:true}),/build and test/);
  s=change(s,{action:'order',key,status:'building',buildRef:'Work in progress'});assert.equal(internalStage(s.orders[0],s.setup.revision),'Building');
  s=change(s,{action:'order',key,status:'tested',buildRef:'Build',testRef:'Test'});
  assert.equal(internalStage(s.orders[0],s.setup.revision),'Testing');
  assert.throws(()=>change(s,{action:'releaseInternal',key,review:'',confirmed:true}),/Review/);
  assert.throws(()=>change(s,{action:'releaseInternal',key,review:'Allowed actions and fallback',confirmed:false}),/Review/);
  s=change(s,{action:'releaseInternal',key,review:'Allowed actions and fallback',confirmed:true});assert.equal(internalStage(s.orders[0],s.setup.revision),'Operating');assert.equal(internalStage(s.orders[1],s.setup.revision),'Planned');
  assert.equal(internalBacklog({id:'a',name:'Internal',owner:'Emily'},s).length,s.orders.length-1);
  const before=structuredClone(s);s=change(s,{action:'addInternalOrder',name:'New workflow',brief:'Outcome, access, fallback'});assert.equal(internalStage(s.orders[0],s.setup.revision),'Operating');assert.deepEqual(s.acceptance,before.acceptance);assert.deepEqual(s.draft,before.draft);
  s=change(s,{action:'order',key,status:'tested',buildRef:'Corrected build',testRef:'Retest'});assert.equal(s.orders[0].internalRelease,null);assert.equal(internalStage(s.orders[0],s.setup.revision),'Testing');
  assert.throws(()=>change(accepted(),{action:'addInternalOrder',name:'No',brief:'Not internal'}),/internal organization/);
  assert.throws(()=>change(change(accepted(),{action:'setup',answers:['a','b','c']}),{action:'order',key,status:'building',buildRef:'x'}),/valid state/);
});
test('internal backlog addition persists atomically without completing other work or creating client fees',async()=>{
  const {db,sqlite}=await database();sqlite.exec("UPDATE accounts SET organization_kind='internal' WHERE id='account-one'");let s=newProposal('Fixture Company',true);
  async function save(next,action){s=await persistProposal(db,'account-one',s,next,actor,action,crypto.randomUUID());}
  await save(complete(true),'save');await save(change(s,{action:'approve'}),'approve');await save(change(s,{action:'authorizeInternal'}),'authorizeInternal');await save(change(s,{action:'setup',answers:['Outcome','Systems','Authority']}),'setup');
  const old=structuredClone(s);await save(change(s,{action:'addInternalOrder',name:'Extra internal automation',brief:'Scoped work with human fallback'}),'addInternalOrder');const added=s.orders.at(-1);
  assert.equal(sqlite.prepare('SELECT monthly_fee_cents FROM account_services WHERE id=?').get(added.serviceId).monthly_fee_cents,null);
  assert.equal(sqlite.prepare('SELECT status FROM onboarding_tasks WHERE id=?').get(added.taskId).status,'pending');
  assert.deepEqual(s.orders.slice(0,-1),old.orders);assert.deepEqual((await readProposal(db,'account-one')).orders,s.orders);
  await assert.rejects(()=>persistProposal(db,'account-one',old,change(old,{action:'addInternalOrder',name:'Stale',brief:'Should not appear'}),actor,'addInternalOrder','stale'),/Another operator/);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM account_services WHERE name='Stale'").get().n,0);
  assert.equal(sqlite.prepare('SELECT status FROM engagements WHERE id=?').get(s.engagementId).status,'active');sqlite.close();
});
function change(state,command){return transitionProposal(state,{expectedVersion:state.version,...command},actor,()=>crypto.randomUUID());}
function complete(internal=false){const s=newProposal('Fixture Company',internal);const d=s.draft;d.ecosystem='Google Workspace';d.setup='2,000';d.monthly='500';d.allowance='100';d.overage='50';d.eligible='Attributable provider costs';d.exclusions='Client-paid subscriptions';d.allocation='Separate project ledger';for(const service of serviceCatalog){for(const f of service.fields)d.services[service.id].config[f.key]=f.options?.[0]||`Agreed ${f.label}`;}return change(s,{action:'save',draft:d});}
function accepted(internal=false){let s=change(complete(internal),{action:'approve'});return change(s,{action:internal?'authorizeInternal':'accept',contact:'Client decision maker',reference:'Signed quote fixture',date:'2026-09-08'});}

function configuredEmail(internal=false){let s=accepted(internal);return change(s,{action:'emailPlaybook',key:'email',emailUpdate:{kind:'configure',config:{...emailDefaults(s.draft),mailboxType:'individual',harness:'Reviewed test harness / connector',owner:'Emily',reviewer:'Company reviewer',rules:'Draft only; excluded topics escalate'}}});}
function emailStep(s,id,status='completed',extra={}){return change(s,{action:'emailPlaybook',key:'email',emailUpdate:{kind:'step',stepId:id,status,notes:'A paragraph of implementation notes to preserve.',evidence:'Restricted test evidence reference',blocker:'',...extra}});}

test('Codex is the new default with provider-aware preflight and a no-send task prompt',()=>{
  const c={...emailDefaults(accepted().draft),mailboxType:'individual',harness:'Codex — Gmail'};
  assert.equal(emailDefaults(accepted().draft).harness,'Codex');
  const steps=emailSteps(c);assert.match(steps.find(s=>s.id==='build').title,/Codex/);assert.match(steps.find(s=>s.id==='connect-google').instructions[0],/Plugins tab/);
  assert.match(emailSteps({...c,provider:'microsoft'}).find(s=>s.id==='connect-microsoft').instructions[0],/If the plugin or required action is unavailable/);
  const prompt=buildEmailBrief('Test company',c);assert.match(prompt,/CODEX TASK/);assert.match(prompt,/Do not send mail/);assert.match(prompt,/capability and identity preflight/);
  assert.doesNotMatch(buildEmailBrief('Test company',{...c,harness:'Another approved harness'}),/CODEX TASK/);
});

test('existing guide snapshots stay editable without silent upgrade; explicit upgrade preserves notes and revalidates',()=>{
  let s=configuredEmail();s=emailStep(s,'authority');s.orders[0].emailRun.version='email-2026-09-11.1';
  const snapshot=structuredClone(s.orders[0].emailRun.steps);
  s=emailStep(s,'connect-google','in_progress');assert.equal(s.orders[0].emailRun.version,'email-2026-09-11.1');assert.deepEqual(s.orders[0].emailRun.steps,snapshot);
  const config={...s.orders[0].emailRun.config,harness:'Codex'};
  assert.throws(()=>change(s,{action:'emailPlaybook',key:'email',emailUpdate:{kind:'configure',config}}),/Confirm revalidation/);
  s=change(s,{action:'emailPlaybook',key:'email',emailUpdate:{kind:'configure',config,confirmReset:true}});
  assert.equal(s.orders[0].emailRun.version,emailGuideVersion);assert.equal(s.orders[0].emailRun.progress.authority.status,'in_progress');assert.match(s.orders[0].emailRun.progress.authority.notes,/paragraph/);
});

test('email guide branches by provider and mailbox type, defaults safely and strips unknown input',()=>{
  let s=configuredEmail();let r=s.orders[0].emailRun;
  assert.equal(r.version,emailGuideVersion);assert.equal(r.config.provider,'google');assert.equal(r.config.mode,'draft');assert.ok(r.steps.some(s=>s.id==='connect-google'));assert.ok(r.steps.some(s=>s.id==='draft-review'));assert.equal(s.orders[0].status,'to_build');
  s=change(s,{action:'emailPlaybook',key:'email',emailUpdate:{kind:'configure',config:{...r.config,provider:'microsoft',mailboxType:'shared',untrusted:'must not persist'}}});r=s.orders[0].emailRun;
  assert.ok(r.steps.some(s=>s.id==='connect-microsoft'));assert.equal(r.config.untrusted,undefined);assert.match(r.steps.find(s=>s.id==='connect-microsoft').instructions.join(' '),/shared mailbox/);
  assert.deepEqual(emailSteps({...r.config,provider:''}),[]);
  assert.throws(()=>change(s,{action:'emailPlaybook',key:'email',emailUpdate:{kind:'configure',config:{...r.config,mode:'auto'}}}),/not in the accepted/);
  assert.throws(()=>change(s,{action:'emailPlaybook',key:'brief',emailUpdate:{kind:'configure',config:r.config}}),/scoped Email/);
  assert.throws(()=>change(s,{action:'emailPlaybook',key:'email',emailUpdate:{kind:'configure',config:{...r.config,owner:'Spoofed owner'}}}),/invalid/);
});

test('email walkthrough accepts partial work, gates completion early and never advances delivery',()=>{
  let s=configuredEmail();const original=structuredClone(s);const ids=s.orders[0].emailRun.steps.map(s=>s.id);
  assert.throws(()=>emailStep(s,'test'),/Complete.*first/);
  s=emailStep(s,'test','in_progress',{evidence:''});assert.equal(s.orders[0].emailRun.progress.test.notes,'A paragraph of implementation notes to preserve.');
  assert.throws(()=>emailStep(s,ids[0],'completed',{evidence:''}),/observed result/);
  assert.throws(()=>emailStep(s,ids[0],'blocked'),/blocker/);
  assert.throws(()=>emailStep(s,'invented'),/existing step/);
  assert.throws(()=>emailStep(s,ids[0],'in_progress',{notes:'x'.repeat(4001)}),/4,000/);
  for(const id of ids)s=emailStep(s,id);
  assert.ok(ids.every(id=>s.orders[0].emailRun.progress[id].status==='completed'));
  assert.equal(s.orders[0].status,'to_build');assert.equal(s.orders[0].buildRef,'');assert.equal(s.orders[0].testRef,'');assert.deepEqual(s.acceptance,original.acceptance);assert.deepEqual(s.draft,original.draft);assert.deepEqual(s.orders[1],original.orders[1]);
  s=emailStep(s,ids[0],'in_progress');assert.equal(s.orders[0].emailRun.progress.test.status,'in_progress');assert.equal(s.orders[0].emailRun.progress.test.evidence,'Restricted test evidence reference');
});

test('email guide revision/reset preserves notes, isolates automation and requires explicit confirmation',()=>{
  let s=configuredEmail(true);s=change(s,{action:'setup',answers:['Outcome','Systems','Authority']});s=emailStep(s,'authority');s=emailStep(s,'connect-google');
  s=change(s,{action:'order',key:'email',status:'tested',buildRef:'Actual build',testRef:'Actual tests'});s=change(s,{action:'releaseInternal',key:'email',review:'Reviewed',confirmed:true});
  const before=structuredClone(s),r=s.orders[0].emailRun;
  s=change(s,{action:'emailPlaybook',key:'email',emailUpdate:{kind:'configure',config:{...r.config,owner:'Derek'}}});assert.ok(s.orders[0].internalRelease);assert.equal(s.orders[0].emailRun.progress.authority.status,'completed');
  assert.throws(()=>change(s,{action:'emailPlaybook',key:'email',emailUpdate:{kind:'configure',config:{...r.config,provider:'microsoft'}}}),/Confirm/);
  s=change(s,{action:'emailPlaybook',key:'email',emailUpdate:{kind:'configure',config:{...r.config,provider:'microsoft'},confirmReset:true}});
  assert.equal(s.orders[0].status,'to_build');assert.equal(s.orders[0].internalRelease,null);assert.equal(s.orders[0].emailRun.progress.authority.status,'in_progress');assert.match(s.orders[0].emailRun.progress.authority.notes,/paragraph/);assert.deepEqual(s.orders[1],before.orders[1]);
  s=change(s,{action:'emailPlaybook',key:'email',emailUpdate:{kind:'configure',config:r.config,confirmReset:true}});assert.equal(s.orders[0].emailRun.progress['connect-google'].status,'in_progress');
  s=emailStep(s,'authority');s=change(s,{action:'setup',answers:['Changed','Systems','Authority'],confirmReset:true});assert.equal(s.orders[0].emailRun.progress.authority.status,'in_progress');assert.match(s.orders[0].emailRun.progress.authority.notes,/paragraph/);
  s.orders[0].emailRun.version='prior-version';assert.throws(()=>emailStep(s,'authority'),/read-only/);
});

test('email walkthrough UI prefills saved notes and exposes prerequisites before editable fields',()=>{
  let s=configuredEmail();s=emailStep(s,'test','blocked',{blocker:'Waiting for test access',notes:'Keep my long saved paragraph.'});
  const markup=renderToStaticMarkup(React.createElement(EmailWalkthrough,{accountId:'account-one',initialData:{proposal:s},initialStep:'test'}));
  assert.ok(markup.includes('Keep my long saved paragraph.'));assert.ok(markup.includes('Waiting for test access'));assert.ok(markup.indexOf('Completion is waiting on:')<markup.indexOf('Work notes'));assert.match(markup,/value="completed" disabled=""/);assert.ok(markup.includes('Save progress'));
  const closed=renderToStaticMarkup(React.createElement(EmailWalkthrough,{accountId:'account-one',initialData:{proposal:s,closed:true},initialStep:'test'}));assert.match(closed,/fieldset disabled=""/);assert.match(closed,/read-only history/);
});

test('email progress persists with CAS/history, leaves other task timestamps alone, and closed history stays protected',async()=>{
  const {db,sqlite}=await database();let s=newProposal('Fixture Company',false);
  async function save(next,action){s=await persistProposal(db,'account-one',s,next,actor,action,crypto.randomUUID());}
  await save(complete(),'save');await save(change(s,{action:'approve'}),'approve');await save(change(s,{action:'accept',contact:'Client',reference:'Signed quote',date:'2026-09-08'}),'accept');
  await save(change(s,{action:'setup',answers:['Outcome','Systems','Authority']}),'setup');
  const config={...emailDefaults(s.draft),mailboxType:'individual',harness:'Harness',owner:'Emily',reviewer:'Human',rules:'Draft only'};
  await save(change(s,{action:'emailPlaybook',key:'email',emailUpdate:{kind:'configure',config}}),'emailPlaybook');const stale=structuredClone(s);
  const tasks=sqlite.prepare('SELECT id,status,updated_at FROM onboarding_tasks ORDER BY id').all();
  await save(emailStep(s,'authority','in_progress',{notes:'Saved detailed work',evidence:''}),'emailPlaybook');
  assert.equal((await readProposal(db,'account-one')).orders[0].emailRun.progress.authority.notes,'Saved detailed work');assert.deepEqual(sqlite.prepare('SELECT id,status,updated_at FROM onboarding_tasks ORDER BY id').all(),tasks);
  await assert.rejects(()=>persistProposal(db,'account-one',stale,emailStep(stale,'authority'),actor,'emailPlaybook','stale-guide'),/Another operator/);
  const history=sqlite.prepare('SELECT state FROM proposal_revisions WHERE account_id=? AND version=?').get('account-one',stale.version);assert.equal(JSON.parse(history.state).orders[0].emailRun.progress.authority,undefined);
  sqlite.prepare("UPDATE engagements SET status='cancelled' WHERE id=?").run(s.engagementId);
  await assert.rejects(()=>save(emailStep(s,'authority'),'emailPlaybook'),/closed|Closed/);sqlite.close();
});

async function database(){const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const file of (await readdir(path.join(root,'drizzle'))).filter(f=>f.endsWith('.sql')).sort()){sqlite.exec(await readFile(path.join(root,'drizzle',file),'utf8'));}sqlite.exec("INSERT INTO accounts(id,name) VALUES('account-one','Fixture Company'),('account-two','Other company')");
 const db={prepare(sql){const statement={values:[],bind(...values){return {...statement,values};},async first(){return sqlite.prepare(sql).get(...this.values)||null;},async all(){return {results:sqlite.prepare(sql).all(...this.values)};},run(){const result=sqlite.prepare(sql).run(...this.values);return {meta:{changes:Number(result.changes)}};}};return statement;},async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};return {sqlite,db};}

test('drafts persist incomplete values but cannot be approved; named identity is supplied by the server',()=>{const start=newProposal('Test',false);const saved=change(start,{action:'save',draft:start.draft});assert.equal(saved.version,1);assert.throws(()=>change(saved,{action:'approve'}),/ecosystem/);const approved=change(complete(),{action:'approve',reviewer:'Spoofed'});assert.equal(approved.approval.id,actor.id);assert.equal(approved.approval.email,actor.email);});
test('comma USD values and exact itemization remain bounded and explicit',()=>{assert.equal(cents('2,000'),200000);for(const value of ['2,00','-1','1.234','1e3','Infinity','10000000'])assert.equal(cents(value),null);const s=complete();assert.deepEqual(scopeIssues(s.draft),[]);s.draft.pricingMode='itemized';s.draft.monthlyPrices={};assert.ok(scopeIssues(s.draft).some(i=>i.includes('monthly price')));});
test('Google/Microsoft scope can proceed without guessing system inventory; mixed systems need details',()=>{const s=complete();assert.deepEqual(scopeIssues(s.draft),[]);s.draft.ecosystem='Microsoft 365';assert.deepEqual(scopeIssues(s.draft),[]);s.draft.ecosystem='Mixed systems';assert.ok(scopeIssues(s.draft).some(i=>i.includes('system')));});
test('editing scope invalidates approval, while a no-op preserves it',()=>{const s=change(complete(),{action:'approve'});assert.equal(change(s,{action:'save',draft:s.draft}),s);const draft=structuredClone(s.draft);draft.quoteComments='Revisit next month';const edited=change(s,{action:'save',draft});assert.equal(edited.approval,null);assert.equal(edited.scopeRevision,s.scopeRevision+1);assert.throws(()=>change(edited,{action:'accept',reference:'x',contact:'Client',date:'2026-09-08'}),/Approve/);});
test('acceptance requires an approved revision and actual nonfuture date/evidence',()=>{const s=change(complete(),{action:'approve'});for(const date of ['2026-02-31','2026-09-09','not-a-date'])assert.throws(()=>change(s,{action:'accept',reference:'x',contact:'Client',date}));assert.throws(()=>change(s,{action:'accept',reference:'',contact:'Client',date:'2026-09-08'}));const a=accepted();assert.equal(a.orders.length,5);assert.throws(()=>change(a,{action:'save',draft:a.draft}),/read-only/);assert.throws(()=>change(a,{action:'accept'}),/already/);});
test('internal authorization has no fictional client acceptance or required prices',()=>{const s=complete(true);s.draft.setup='';s.draft.monthly='';s.draft.allowance='';s.draft.overage='';assert.deepEqual(proposalIssues(s.draft,true),[]);const a=change(change(s,{action:'approve'}),{action:'authorizeInternal'});assert.equal(a.acceptance.internal,true);assert.equal(a.draft.monthly,'');assert.throws(()=>change(change(complete(true),{action:'approve'}),{action:'accept'}),/correct/);});
test('setup changes invalidate build/test evidence only after explicit confirmation',()=>{let s=accepted();assert.throws(()=>change(s,{action:'order',key:'email',status:'tested',buildRef:'build',testRef:'test'}),/setup/);s=change(s,{action:'setup',answers:['Outcome','Systems','Authority']});s=change(s,{action:'order',key:'email',status:'tested',buildRef:'Build URL',testRef:'External report URL'});const original=structuredClone(s);assert.throws(()=>change(s,{action:'setup',answers:['New outcome','Systems','Authority']}),/Confirm/);s=change(s,{action:'setup',answers:['New outcome','Systems','Authority'],confirmReset:true});assert.deepEqual(s.draft,original.draft);assert.deepEqual(s.acceptance,original.acceptance);assert.equal(s.orders[0].status,'to_build');assert.equal(s.orders[0].testRef,'');assert.equal(s.setup.revision,2);assert.equal(original.orders[0].testRef,'External report URL');});
test('database CAS excludes stale history, audit and duplicate work',async()=>{const {db,sqlite}=await database();const empty=newProposal('Fixture Company',false);let saved=complete();saved=await persistProposal(db,'account-one',empty,saved,actor,'save','m1');const stale=structuredClone(saved);const approved=change(saved,{action:'approve'});await persistProposal(db,'account-one',saved,approved,actor,'approve','m2');await assert.rejects(()=>persistProposal(db,'account-one',stale,change(stale,{action:'save',draft:{...stale.draft,monthly:'999'}}),actor,'save','m-stale'),/Another operator/);assert.equal(sqlite.prepare('SELECT count(*) n FROM proposal_revisions').get().n,2);const accepting=change(approved,{action:'accept',reference:'Signed quote',contact:'Client',date:'2026-09-08'});const a=await persistProposal(db,'account-one',approved,accepting,actor,'accept','m3');assert.equal(sqlite.prepare('SELECT count(*) n FROM account_services').get().n,5);assert.equal(sqlite.prepare('SELECT count(*) n FROM engagements').get().n,1);assert.equal(sqlite.prepare('SELECT count(*) n FROM onboarding_tasks').get().n,13);await assert.rejects(()=>persistProposal(db,'account-one',approved,structuredClone(accepting),actor,'accept','m-replay'),/Another operator/);assert.equal(sqlite.prepare('SELECT count(*) n FROM account_services').get().n,5);assert.deepEqual(await readProposal(db,'account-one'),a);assert.equal(await readProposal(db,'account-two'),null);sqlite.close();});
test('accepted scope and history are immutable; delivery gate rejects missing or stale evidence',async()=>{const {db,sqlite}=await database();let before=newProposal('Fixture Company',false);let s=complete();await persistProposal(db,'account-one',before,s,actor,'save','s1');before=s;s=change(s,{action:'approve'});await persistProposal(db,'account-one',before,s,actor,'approve','s2');before=s;s=change(s,{action:'accept',reference:'Evidence',contact:'Client',date:'2026-09-08'});s=await persistProposal(db,'account-one',before,s,actor,'accept','s3');assert.throws(()=>sqlite.prepare("UPDATE engagements SET stage='live' WHERE id=?").run(s.engagementId),/guided setup/);assert.throws(()=>sqlite.prepare("UPDATE account_proposals SET state=json_set(state,'$.draft.monthly','1') WHERE account_id='account-one'").run(),/immutable/);assert.throws(()=>sqlite.prepare("UPDATE account_services SET monthly_fee_cents=1 WHERE id=?").run(s.orders[0].serviceId),/amendment/);assert.throws(()=>sqlite.exec('DELETE FROM proposal_revisions'),/immutable/);before=s;s=change(s,{action:'setup',answers:['Outcome','Systems','Authority']});await persistProposal(db,'account-one',before,s,actor,'setup','s4');for(const [i,o] of s.orders.entries()){before=s;s=change(s,{action:'order',key:o.key,status:'tested',buildRef:'Build',testRef:'Test report'});await persistProposal(db,'account-one',before,s,actor,'order',`order-${i}`);}sqlite.prepare("UPDATE engagements SET stage='live',status='completed' WHERE id=?").run(s.engagementId);before=s;s=change(s,{action:'setup',answers:['New','Systems','Authority'],confirmReset:true});await assert.rejects(()=>persistProposal(db,'account-one',before,s,actor,'setup','closed'),/read-only/);assert.equal((await readProposal(db,'account-one')).setup.revision,1);sqlite.close();});
test('a failed dependent insert rolls back the proposal, history and audit',async()=>{const {db,sqlite}=await database();const empty=newProposal('Fixture Company',false);let s=complete();await persistProposal(db,'account-one',empty,s,actor,'save','first');const approved=change(s,{action:'approve'});await persistProposal(db,'account-one',s,approved,actor,'approve','second');const next=change(approved,{action:'accept',contact:'Client',date:'2026-09-08',reference:'Evidence'});next.orders[1].taskId=next.orders[0].taskId;await assert.rejects(()=>persistProposal(db,'account-one',approved,next,actor,'accept','fail'));assert.equal((await readProposal(db,'account-one')).acceptance,null);assert.equal(sqlite.prepare('SELECT count(*) n FROM account_services').get().n,0);assert.equal(sqlite.prepare('SELECT count(*) n FROM proposal_revisions').get().n,2);sqlite.close();});
test('quote rendering uses the original mark and omits internal cost attribution',async()=>{const {CustomerQuote}=await vite.ssrLoadModule('/components/customer-quote.tsx');const s=complete();s.draft.allocation='PRIVATE LEDGER RULE';const html=renderToStaticMarkup(React.createElement(CustomerQuote,{company:'Fixture Company',draft:s.draft,reference:'TEST',revision:1,status:'Draft'}));assert.ok(html.includes('/cipher-bearagon.png'));assert.ok(html.includes('$2,000.00'));assert.ok(!html.includes('PRIVATE LEDGER RULE'));assert.ok(!html.includes('PROTOTYPE'));assert.ok(html.includes('INTERNAL QUOTE PREVIEW'));});

test('evidence corrections preserve other fields and modules and reject stale saves',()=>{
  let s=change(accepted(),{action:'setup',answers:['Outcome','Systems','Authority']});
  s=change(s,{action:'order',key:'email',status:'tested',buildRef:'Build 42',testRef:'Report with typo'});
  const original=structuredClone(s), email=s.orders.find(o=>o.key==='email');
  const updated=change(s,{action:'order',...email,testRef:'Correct report'});
  assert.equal(updated.orders.find(o=>o.key==='email').buildRef,'Build 42');
  assert.equal(updated.orders.find(o=>o.key==='email').testRef,'Correct report');
  assert.equal(updated.orders.find(o=>o.key==='email').status,'tested');
  assert.deepEqual(updated.orders.filter(o=>o.key!=='email'),original.orders.filter(o=>o.key!=='email'));
  assert.deepEqual(updated.setup,original.setup);
  assert.deepEqual(updated.acceptance,original.acceptance);
  assert.deepEqual(s,original);
  assert.throws(()=>change(updated,{action:'order',...email,expectedVersion:original.version}),/another session/);
  assert.throws(()=>change(updated,{action:'order',...email,testRef:''}),/external test evidence/);
});

test('corrected evidence reloads durably and retains the prior snapshot',async()=>{
  const {db,sqlite}=await database(); let s=newProposal('Fixture Company',false);
  async function save(next,action){s=await persistProposal(db,'account-one',s,next,actor,action,crypto.randomUUID());}
  await save(complete(),'save'); await save(change(s,{action:'approve'}),'approve');
  await save(change(s,{action:'accept',contact:'Client',reference:'Signed quote',date:'2026-09-08'}),'accept');
  await save(change(s,{action:'setup',answers:['Outcome','Systems','Authority']}),'setup');
  await save(change(s,{action:'order',key:'email',status:'tested',buildRef:'Build 42',testRef:'Original report'}),'order');
  const previous=s.version, order=s.orders.find(o=>o.key==='email');
  await save(change(s,{action:'order',...order,testRef:'Corrected report'}),'order');
  const loaded=await readProposal(db,'account-one');
  assert.equal(loaded.orders.find(o=>o.key==='email').testRef,'Corrected report');
  assert.equal(loaded.orders.find(o=>o.key==='email').buildRef,'Build 42');
  const old=JSON.parse(sqlite.prepare('SELECT state FROM proposal_revisions WHERE account_id=? AND version=?').get('account-one',previous).state);
  assert.equal(old.orders.find(o=>o.key==='email').testRef,'Original report');
  assert.equal(sqlite.prepare('SELECT evidence_ref FROM onboarding_tasks WHERE id=?').get(order.taskId).evidence_ref,'Corrected report');
  sqlite.close();
});

test('evidence editor prefills saved fields, detects real edits and renders save/error states',async()=>{
  const {WorkOrderEvidenceForm,evidenceChanged}=await vite.ssrLoadModule('/components/work-order-evidence-form.tsx');
  const s=change(change(accepted(),{action:'setup',answers:['Outcome','Systems','Authority']}),{action:'order',key:'email',status:'tested',buildRef:'Build 42',testRef:'Report 42'});
  const saved=s.orders.find(o=>o.key==='email'), draft={...saved};
  assert.equal(evidenceChanged(draft,saved),false); assert.equal(evidenceChanged(null,saved),false);
  draft.testRef='Corrected report'; assert.equal(evidenceChanged(draft,saved),true); assert.equal(saved.testRef,'Report 42');
  const props={order:draft,saved,busy:false,error:'Save failed. Try again.',onChange:()=>{},onCancel:()=>{},onSave:()=>{}};
  const html=renderToStaticMarkup(React.createElement(WorkOrderEvidenceForm,props));
  assert.match(html,/Build 42/); assert.match(html,/Corrected report/); assert.match(html,/Save changes/); assert.match(html,/Cancel/); assert.match(html,/role="alert"/);
  assert.match(html,/for="evidence-build"/); assert.match(html,/id="evidence-test"/);
  const pending=renderToStaticMarkup(React.createElement(WorkOrderEvidenceForm,{...props,busy:true}));
  assert.match(pending,/fieldset disabled/); assert.match(pending,/Saving…/);
  const demoted=renderToStaticMarkup(React.createElement(WorkOrderEvidenceForm,{...props,order:{...draft,status:'built'}}));
  assert.match(demoted,/clears the current test reference/);
});
