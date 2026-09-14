import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile,readdir } from 'node:fs/promises';
import test,{after} from 'node:test';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});after(()=>vite.close());
const {routeInquiry}=await vite.ssrLoadModule('/lib/server/inquiry-routing.ts');
const actor={userId:'operator',email:'operator@example.test',displayName:'Operator'};
const input={id:'one',accountId:'a',expectedUpdatedAt:'original',action:'lead'};
async function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const f of(await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 sqlite.exec("INSERT INTO accounts(id,name) VALUES('a','Example'),('b','Other');INSERT INTO contacts(id,display_name,marketing_status) VALUES('c','Contact','unsubscribed');INSERT INTO inquiries(id,request_key,account_id,contact_id,source,summary,status,resolution,owner,next_action,follow_up_date,recorded_by,updated_at) VALUES('one','r1','a','c','phone','Keep summary','new','Existing note','Emily','Callback owed','2026-09-20','source','original'),('two','r2','a','c','phone','Other message','working','','Derek','','','source','other')");
 const db={prepare(sql){return {bind(...values){return {run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}}}}}}},async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};return {sqlite,db};
}
test('lead routing keeps follow-up and contacts, qualifies the prospect and changes only the selected inquiry',async()=>{
 const {sqlite,db}=await fixture();const before=sqlite.prepare("SELECT * FROM inquiries WHERE id='one'").get(),other=sqlite.prepare("SELECT * FROM inquiries WHERE id='two'").get();
 assert.equal(await routeInquiry(db,input,actor),true);const saved=sqlite.prepare("SELECT * FROM inquiries WHERE id='one'").get();
 assert.equal(saved.status,'qualified');for(const key of ['summary','resolution','owner','next_action','follow_up_date','contact_id'])assert.equal(saved[key],before[key]);
 assert.deepEqual(sqlite.prepare("SELECT * FROM inquiries WHERE id='two'").get(),other);assert.equal(sqlite.prepare("SELECT sales_stage FROM accounts WHERE id='a'").get().sales_stage,'qualified');
 assert.equal(sqlite.prepare("SELECT marketing_status FROM contacts WHERE id='c'").get().marketing_status,'unsubscribed');assert.equal(sqlite.prepare('SELECT count(*) n FROM engagements').get().n,0);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM operator_audit_events').get().n,1);assert.equal(await routeInquiry(db,{...input,expectedUpdatedAt:saved.updated_at},actor),false);sqlite.close();
});
test('workflow handoff retains notes and follow-up, and does not fabricate a won client or onboarding',async()=>{
 const {sqlite,db}=await fixture();assert.equal(await routeInquiry(db,{...input,action:'workflow'},actor),true);
 const row=sqlite.prepare("SELECT * FROM inquiries WHERE id='one'").get();assert.equal(row.status,'closed');assert.match(row.resolution,/^Existing note\nHanded off/);assert.equal(row.next_action,'Callback owed');
 assert.equal(sqlite.prepare("SELECT relationship_type FROM accounts WHERE id='a'").get().relationship_type,'prospect');assert.equal(sqlite.prepare('SELECT count(*) n FROM engagements').get().n,0);assert.equal(await routeInquiry(db,{...input,action:'workflow',expectedUpdatedAt:row.updated_at},actor),false);sqlite.close();
});
for(const [name,setup,overrides] of [
 ['stale','',{expectedUpdatedAt:'stale'}],['wrong account','',{accountId:'b'}],['closed',"UPDATE inquiries SET status='closed' WHERE id='one'",{}],['archived',"UPDATE accounts SET status='archived' WHERE id='a'",{}],['internal',"UPDATE accounts SET organization_kind='internal' WHERE id='a'",{}]
])test(`routing rejects ${name} without audit or related changes`,async()=>{const {sqlite,db}=await fixture();if(setup)sqlite.exec(setup);const before=sqlite.prepare('SELECT * FROM inquiries').all();assert.equal(await routeInquiry(db,{...input,...overrides},actor),false);assert.deepEqual(sqlite.prepare('SELECT * FROM inquiries').all(),before);assert.equal(sqlite.prepare('SELECT count(*) n FROM operator_audit_events').get().n,0);sqlite.close();});
test('existing client and proposal sales stages are not downgraded',async()=>{for(const stage of ['won','proposal']){const {sqlite,db}=await fixture();sqlite.prepare("UPDATE accounts SET sales_stage=? WHERE id='a'").run(stage);assert.equal(await routeInquiry(db,input,actor),true);assert.equal(sqlite.prepare("SELECT sales_stage FROM accounts WHERE id='a'").get().sales_stage,stage);sqlite.close();}});
test('audit failure rolls back inquiry and company updates',async()=>{const {sqlite,db}=await fixture();sqlite.exec("CREATE TRIGGER deny_audit BEFORE INSERT ON operator_audit_events BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");await assert.rejects(()=>routeInquiry(db,input,actor));assert.equal(sqlite.prepare("SELECT status FROM inquiries WHERE id='one'").get().status,'new');assert.equal(sqlite.prepare("SELECT sales_stage FROM accounts WHERE id='a'").get().sales_stage,'new');sqlite.close();});
