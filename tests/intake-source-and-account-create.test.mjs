import assert from 'node:assert/strict';
import test, {after} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {drizzle} from 'drizzle-orm/d1';

const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},plugins:[{
  name:'local-account-fixture',enforce:'pre',
  load(id){
    if(id.replaceAll('\\','/').endsWith('/db/index.ts'))return 'export const getDb=()=>globalThis.__accountFixtureDb; export const getRawDb=()=>globalThis.__accountFixtureRaw;';
    if(id.replaceAll('\\','/').endsWith('/lib/server/operator-auth.ts'))return 'export const getOperatorIdentity=async()=>({userId:"fixture",email:"operator@example.test",displayName:"Fixture"}); export const auditActor=()=>({actorId:"fixture",actorEmail:"operator@example.test",actorName:"Fixture"}); export const operatorRequiredResponse=()=>new Response(null,{status:401});';
  }
}]});
after(()=>vite.close());
const {inquirySourceLabel}=await vite.ssrLoadModule('/lib/inquiry-source.ts');
const {inquirySourceRef}=await vite.ssrLoadModule('/lib/server/inquiry-source.ts');
const {inquiries}=await vite.ssrLoadModule('/db/schema.ts');
const {POST}=await vite.ssrLoadModule('/app/api/clients/route.ts');
const {PATCH}=await vite.ssrLoadModule('/app/api/clients/[id]/route.ts');

async function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const f of(await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const counts=[];
 const raw={prepare(sql){const stmt={values:[],bind(...values){counts.push(values.length);if(values.length>100)throw Error(`D1 bound-parameter limit exceeded: ${values.length}`);return {...stmt,values};},async raw(){const q=sqlite.prepare(sql);q.setReturnArrays(true);return q.all(...this.values);},async first(){return sqlite.prepare(sql).get(...this.values)||null;},all(){return {results:sqlite.prepare(sql).all(...this.values)};},run(){return {results:[],meta:{changes:Number(sqlite.prepare(sql).run(...this.values).changes)}};}};return stmt;},async batch(statements){sqlite.exec('BEGIN');try{const rows=statements.map(s=>s.run());sqlite.exec('COMMIT');return rows;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 globalThis.__accountFixtureRaw=raw;globalThis.__accountFixtureDb=drizzle(raw);
 return {sqlite,db:globalThis.__accountFixtureDb,counts};
}
const input={companyName:'Example Painting',contactName:'Sample Owner',email:'OWNER@example.test',phone:'5550100123',relationshipType:'client',stage:'Intake',dueDate:'2026-09-16',notes:'Fictional local test',startOnboarding:true};
const request=(overrides={})=>new Request('https://ops.example.test/api/clients',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...input,...overrides})});

test('source labels recognize exact domains and reject misleading references',()=>{
 for(const host of ['aisprawlcleanup.com','www.aisprawlcleanup.com','AISPRAWLCLEANUP.COM'])assert.equal(inquirySourceLabel('website',`https://${host}/#contact`),'AI Sprawl Cleanup');
 assert.equal(inquirySourceLabel('website','https://bearagon.com/contact'),'Bearagon website');
 for(const ref of ['',null,'not a URL','https://aisprawlcleanup.com.evil.test/','https://aisprawlcleanup.com@evil.test/','https://evil.test/?site=aisprawlcleanup.com','javascript:aisprawlcleanup.com'])assert.equal(inquirySourceLabel('website',ref),'Website');
 assert.equal(inquirySourceLabel('phone','https://aisprawlcleanup.com'),'Phone');
});
test('saved source references stay attached to their own inquiries without rewriting historical data',async()=>{
 const {sqlite,db}=await fixture();
 sqlite.exec("INSERT INTO accounts(id,name) VALUES('a','Example'); INSERT INTO contacts(id,display_name) VALUES('c','Sample'); INSERT INTO inquiries(id,request_key,account_id,contact_id,source,summary,recorded_by) VALUES('one','r1','a','c','website','Original','fixture'),('two','r2','a','c','website','Unrelated','fixture');");
 const add=sqlite.prepare('INSERT INTO intake_receipts(id,sequence,source,payload,status,inquiry_id,received_at) VALUES(?,?,?,?,?,?,?)');
 add.run('old',1,'website',JSON.stringify({sourceRef:'https://aisprawlcleanup.com/#contact'}),'imported','one','2026-09-15');
 add.run('review',2,'website',JSON.stringify({sourceRef:'https://evil.test/'}),'review',null,'2026-09-16');
 const query=db.select({id:inquiries.id,sourceRef:inquirySourceRef}).from(inquiries).toSQL();
 const rows=sqlite.prepare(query.sql).all(...query.params);
 assert.equal(rows.length,2);assert.equal(rows.find(r=>r.id==='one').sourceRef,'https://aisprawlcleanup.com/#contact');assert.equal(rows.find(r=>r.id==='two').sourceRef,null);
 assert.equal(sqlite.prepare("SELECT summary FROM inquiries WHERE id='one'").get().summary,'Original');sqlite.close();
});
for(const startOnboarding of [true,false])test(`account creation with onboarding ${startOnboarding} respects D1 limits and saves complete records`,async()=>{
 const {sqlite,counts}=await fixture();const response=await POST(request({startOnboarding}));
 assert.equal(response.status,201,JSON.stringify(await response.clone().json()));
 assert.equal(sqlite.prepare('SELECT count(*) n FROM accounts').get().n,1);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM contacts').get().n,1);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM onboarding_tasks').get().n,startOnboarding?8:0);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM engagements').get().n,startOnboarding?1:0);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM operator_audit_events').get().n,1);
 assert.ok(counts.every(n=>n<=100));sqlite.close();
});
test('reusing a contact preserves contact information and marketing preference',async()=>{
 const {sqlite}=await fixture();sqlite.exec("INSERT INTO contacts(id,display_name,email,email_normalized,phone,marketing_status) VALUES('existing','Saved Name','owner@example.test','owner@example.test','saved phone','unsubscribed')");
 const response=await POST(request());assert.equal(response.status,201);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM contacts').get().n,1);
 const contact=sqlite.prepare("SELECT * FROM contacts WHERE id='existing'").get();assert.equal(contact.display_name,'Saved Name');assert.equal(contact.marketing_status,'unsubscribed');sqlite.close();
});
test('failed onboarding rolls back the entire account creation',async()=>{
 const {sqlite}=await fixture();sqlite.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON onboarding_tasks WHEN NEW.template_key='launch' BEGIN SELECT RAISE(ABORT,'fixture task failure'); END;");
 assert.equal((await POST(request())).status,500);
 for(const table of ['accounts','contacts','account_contacts','engagements','onboarding_tasks','operator_audit_events'])assert.equal(sqlite.prepare(`SELECT count(*) n FROM ${table}`).get().n,0,table);sqlite.close();
});
test('starting onboarding later saves all tasks once and stays under D1 limits',async()=>{
 const {sqlite,counts}=await fixture();const created=await POST(request({startOnboarding:false}));assert.equal(created.status,201);
 const id=(await created.json()).client.id;
 const start=()=>PATCH(new Request(`https://ops.example.test/api/clients/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({startOnboarding:true})}),{params:Promise.resolve({id})});
 assert.equal((await start()).status,201);assert.equal((await start()).status,200);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM onboarding_tasks').get().n,8);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM engagements').get().n,1);
 assert.ok(counts.every(n=>n<=100));sqlite.close();
});
