import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {createServer} from 'vite';
const root=new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const vite=await createServer({appType:'custom',configFile:false,root,cacheDir:root+'/.vite-test-cache/research',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});after(()=>vite.close());
const {publicWebsite,researchNotes}=await vite.ssrLoadModule('/lib/company-research.ts');
const {readInteraction,verifiedResearch,researchCompany,reserveResearch,groundedResearch}=await vite.ssrLoadModule('/lib/server/company-research.ts');
const {saveCompanyContext,contextInput}=await vite.ssrLoadModule('/lib/server/company-context.ts');
const {normalizeAccountInput}=await import('../lib/ops-domain.mjs');
const {publicAddress,publicHost,boundedText}=await vite.ssrLoadModule('/lib/server/public-company-pages.ts');
const website='https://business.demo/';
const facts={fields:[{key:'companyName',value:'Test business',evidence:'Test business',sourceUrl:website}],automations:[{title:'Draft inquiry follow-up',evidence:'Public inquiry form',benefit:'Faster review of inquiries',questions:['Which inbox receives inquiries?'],sourceUrl:website}],nextUrls:[]};
const response=(content=facts,url=website)=>({status:'completed',steps:[{type:'url_context_result',status:'success',url},{type:'model_output',content:[{type:'text',text:JSON.stringify(content)}]}]});
test('public website input rejects private, credentialed and unsafe URL forms',()=>{
  assert.equal(publicWebsite('business.demo'),'https://business.demo/');
  for(const url of ['https://127.0.0.1','http://2130706433','http://[::1]','file:///etc/passwd','https://x.local','https://user:password@business.demo','https://business.demo:444','javascript:alert(1)','http://0x7f000001'])assert.throws(()=>publicWebsite(url));
});
test('research removes unsourced, duplicate and malformed facts and never trusts model-provided sources alone',()=>{
  const parsed=readInteraction(response(),website);
  assert.equal(verifiedResearch(parsed.content,parsed.sources,website).fields.length,1);
  const mixed={...facts,fields:[...facts.fields,{key:'companyName',value:'Overwrite',sourceUrl:website},{key:'email',value:'bad email',sourceUrl:website},{key:'phone',value:'123',sourceUrl:'https://elsewhere.demo/'}]};
  const result=verifiedResearch(mixed,[website],website);assert.equal(result.fields.length,1);assert.ok(result.warning);
  assert.throws(()=>verifiedResearch(facts,[],website),/No source-backed/);
  assert.throws(()=>readInteraction({status:'incomplete',steps:[]},website),/did not finish/);
});
test('provider receives only freshly fetched public page content and no browsing tools',async()=>{
  const pages=[{url:website,text:'Test business. Public inquiry form.',emails:[],phones:[],links:[]}];const calls=[];
  const fetcher=async(url,options)=>{calls.push({url,...options,body:JSON.parse(options.body)});return Response.json(response());};
  const result=await researchCompany(website,'fixture-key',fetcher,async()=>pages);
  assert.equal(calls.length,1);assert.equal(calls[0].headers['x-goog-api-key'],'fixture-key');assert.equal(calls[0].body.store,false);assert.equal(calls[0].body.tools,undefined);
  assert.match(calls[0].body.input,/Public inquiry form/);assert.ok(!JSON.stringify(result).includes('fixture-key'));
  await assert.rejects(()=>researchCompany(website,'fixture-key',async()=>new Response('secret provider error',{status:403}),async()=>pages),/rejected access/);
});
test('current-page matching removes invented contact details despite a correct source URL',()=>{
  const pages=[{url:website,text:'Test business. Public inquiry form. Email actual@business.demo or call (479) 970-3075.',emails:['actual@business.demo'],phones:['+14799703075'],links:[]}];
  const content={...facts,fields:[...facts.fields,{key:'email',value:'invented@business.demo',evidence:'Public inquiry form.',sourceUrl:website},{key:'phone',value:'303-555-0100',evidence:'Public inquiry form.',sourceUrl:website}]};
  const result=groundedResearch(content,pages,website);assert.equal(result.fields.length,1);assert.match(result.warning,/current page/);
  content.fields[1].value='actual@business.demo';content.fields[2].value='(479) 970-3075';assert.equal(groundedResearch(content,pages,website).fields.length,3);
});
test('page fetch guard rejects private DNS answers and oversized responses',async()=>{
  for(const ip of ['127.0.0.1','10.2.1.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.1.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1'])assert.equal(publicAddress(ip),false);
  assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
  await assert.rejects(()=>publicHost('business.demo',async()=>Response.json({Status:0,Answer:[{type:1,data:'127.0.0.1'}]})),/not a public/);
  await assert.rejects(()=>boundedText(new Response('x'.repeat(101)),100),/too large/);
  assert.equal(await boundedText(new Response('public text'),100),'public text');
});
test('selected notes retain provenance and mark automation ideas as unapproved; creation retains website and notes',()=>{
  const result={...facts,website,researchedAt:'2026-09-13T00:00:00Z',sources:[website],warning:''};
  const notes=researchNotes(result,['companyName'],[0]);assert.match(notes,/not approved/);assert.match(notes,/Source: https:\/\/business.demo/);assert.equal(researchNotes(result,[],[]),'');
  const normalized=normalizeAccountInput({companyName:'Test',contactName:'Person',email:'person@business.demo',website,notes});assert.equal(normalized.value.website,website);assert.equal(normalized.value.notes,notes);
  assert.ok(normalizeAccountInput({companyName:'Test',contactName:'Person',email:'person@business.demo',notes:'x'.repeat(5001)}).error);
});
async function fixture(){const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const file of(await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));sqlite.exec("INSERT INTO accounts(id,name,notes,relationship_owner) VALUES('qa','Test','Existing notes','Brendan'),('other','Other','Keep','Emily')");
  const db={prepare(sql){const stmt={values:[],bind(...values){return {...stmt,values};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...this.values).changes)}};}};return stmt;},async batch(statements){sqlite.exec('BEGIN');try{const r=statements.map(s=>s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};return {sqlite,db};}
const actor={userId:'operator',email:'operator@business.demo',displayName:'Test operator'};
test('context saves are isolated, audited, concurrency checked and atomic',async()=>{
  const {sqlite,db}=await fixture();const before=sqlite.prepare("SELECT * FROM accounts WHERE id='other'").get();
  const input=contextInput.parse({website,notes:'Existing notes\nNew reviewed context',expectedWebsite:'',expectedNotes:'Existing notes'});
  await saveCompanyContext(db,'qa',input,actor);assert.deepEqual(sqlite.prepare("SELECT * FROM accounts WHERE id='other'").get(),before);
  assert.equal(sqlite.prepare("SELECT relationship_owner FROM accounts WHERE id='qa'").get().relationship_owner,'Brendan');
  assert.equal(sqlite.prepare('SELECT actor_id FROM operator_audit_events').get().actor_id,'operator');
  await assert.rejects(()=>saveCompanyContext(db,'qa',input,actor),/changed/);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM operator_audit_events').get().n,1);
  sqlite.exec("CREATE TRIGGER fail_context BEFORE UPDATE OF website ON accounts BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
  await assert.rejects(()=>saveCompanyContext(db,'qa',{...input,expectedWebsite:website,expectedNotes:input.notes,notes:'Overwrite'},actor));
  assert.equal(sqlite.prepare('SELECT count(*) n FROM operator_audit_events').get().n,1);sqlite.close();
});
test('research budget is shared across requests without modifying accounts',async()=>{
  const {sqlite,db}=await fixture();const before=sqlite.prepare('SELECT * FROM accounts').all();
  await reserveResearch(db,actor);await reserveResearch(db,actor);await assert.rejects(()=>reserveResearch(db,actor),/limit reached/);
  assert.deepEqual(sqlite.prepare('SELECT * FROM accounts').all(),before);
  await reserveResearch(db,{...actor,userId:'second-operator'});
  for(let i=0;i<4;i++){sqlite.prepare("UPDATE operator_audit_events SET created_at=? WHERE actor_id='operator'").run(new Date(Date.now()-120000).toISOString());await reserveResearch(db,actor);await reserveResearch(db,actor);}
  sqlite.prepare("UPDATE operator_audit_events SET created_at=? WHERE actor_id='operator'").run(new Date(Date.now()-120000).toISOString());await assert.rejects(()=>reserveResearch(db,actor),/limit reached/);sqlite.close();
});

test('URL tool result entries supply retrieval evidence while failed entries do not',()=>{const raw=response();raw.steps[0]={type:'url_context_result',result:[{url:website,status:'success'}]};assert.deepEqual(readInteraction(raw,website).sources,[website]);raw.steps[0].result[0].status='error';assert.deepEqual(readInteraction(raw,website).sources,[]);});
