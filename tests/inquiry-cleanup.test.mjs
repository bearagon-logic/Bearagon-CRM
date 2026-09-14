import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test,{after} from 'node:test';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';

const routeSource=await readFile(new URL('../app/api/inquiries/cleanup/route.ts',import.meta.url),'utf8');
const source=await readFile(new URL('../lib/server/inquiry-cleanup.ts',import.meta.url),'utf8');
const vite=await createServer({appType:'custom',configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});after(()=>vite.close());
const {cleanupInquiry}=await vite.ssrLoadModule('/lib/server/inquiry-cleanup.ts');
const archiveSql=source.match(/db\.prepare\(`(UPDATE accounts[\s\S]*?RETURNING id)`\)/)[1];
async function fixture(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) db.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));db.exec("INSERT INTO accounts(id,name) VALUES('a','Test'); INSERT INTO contacts(id,display_name) VALUES('c','Test'); INSERT INTO account_contacts(account_id,contact_id) VALUES('a','c'); INSERT INTO inquiries(id,request_key,account_id,contact_id,source,summary,recorded_by,status,resolution,updated_at) VALUES('i','r','a','c','phone','Test','operator','closed','[Test submission] QA','now')");db.exec("INSERT INTO operator_audit_events(id,account_id,resource_type,resource_id,action,actor_email,actor_id,actor_name,result,detail) VALUES('origin','a','inquiry','i','inquiry.recorded','operator','operator','Operator','succeeded','Imported website; created prospect account. No marketing permission inferred.')");return db;}
test('cleanup archives only unused prospects and keeps contact/history',async()=>{const db=await fixture();assert.equal(db.prepare(archiveSql).all('now','a','i','now','i').length,1);assert.equal(db.prepare('SELECT count(*) n FROM contacts').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM inquiries').get().n,1);db.close();});
for(const [name,setup] of [
 ['separately created company',"DELETE FROM operator_audit_events"],
 ['client',"UPDATE accounts SET relationship_type='client'"],
 ['internal',"UPDATE accounts SET organization_kind='internal'"],
 ['qualified',"UPDATE accounts SET sales_stage='qualified'"],
 ['other inquiry',"INSERT INTO inquiries(id,request_key,account_id,contact_id,source,summary,recorded_by) VALUES('j','s','a','c','phone','Real','operator')"],
 ['shared contact',"INSERT INTO accounts(id,name) VALUES('b','Real'); INSERT INTO account_contacts(account_id,contact_id) VALUES('b','c')"],
 ['engagement',"INSERT INTO engagements(id,account_id) VALUES('e','a')"],
 ['stale inquiry',"UPDATE inquiries SET updated_at='later'"],
]) test(`cleanup protects ${name}`,async()=>{const db=await fixture();db.exec(setup);assert.equal(db.prepare(archiveSql).all('now','a','i','now','i').length,0);assert.equal(db.prepare("SELECT status FROM accounts WHERE id='a'").get().status,'active');db.close();});
test('cleanup remains authenticated, audited, and has no deletes',()=>{assert.match(routeSource,/getOperatorIdentity/);assert.match(routeSource,/operatorRequiredResponse/);assert.match(source,/db\.batch/);assert.match(source,/operator_audit_events/);assert.doesNotMatch(source,/DELETE FROM/);});

function adapter(sqlite){return {prepare(sql){return {bind(...values){return {async first(){return sqlite.prepare(sql).get(...values);},run(){return {results:sqlite.prepare(sql).all(...values)};}};}};},async batch(statements){sqlite.exec('BEGIN');try{const rows=statements.map(s=>s.run());sqlite.exec('COMMIT');return rows;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};}
const actor={userId:'operator',email:'operator@example.test',displayName:'Operator'};
for(const kind of ['test','spam'])test(`${kind} classification archives an inquiry-only company without an extra flag`,async()=>{
 const db=await fixture();db.exec("UPDATE inquiries SET status='new',resolution='' WHERE id='i'");
 const result=await cleanupInquiry(adapter(db),{id:'i',kind,reason:'Fixture classification',updatedAt:'now'},actor);
 assert.equal(result.status,200);assert.match(result.message,/removed from the active directory/);assert.equal(db.prepare("SELECT status FROM accounts WHERE id='a'").get().status,'archived');assert.equal(db.prepare("SELECT status FROM inquiries WHERE id='i'").get().status,'closed');assert.equal(db.prepare('SELECT count(*) n FROM contacts').get().n,1);db.close();
});
test('the last junk inquiry allows automatic cleanup while another genuine inquiry prevents it',async()=>{
 const db=await fixture();db.exec("INSERT INTO inquiries(id,request_key,account_id,contact_id,source,summary,recorded_by,status,resolution) VALUES('j','s','a','c','phone','Other test','operator','closed','[Spam] Fixture spam')");
 assert.equal(db.prepare(archiveSql).all('now','a','i','now','i').length,1);db.close();
});
test('a stale classification has no company or audit effects',async()=>{
 const db=await fixture();const before=db.prepare('SELECT * FROM inquiries').all();const result=await cleanupInquiry(adapter(db),{id:'i',kind:'test',reason:'Fixture',updatedAt:'stale'},actor);assert.equal(result.status,409);assert.deepEqual(db.prepare('SELECT * FROM inquiries').all(),before);assert.equal(db.prepare("SELECT status FROM accounts WHERE id='a'").get().status,'active');assert.equal(db.prepare('SELECT count(*) n FROM operator_audit_events').get().n,1);db.close();
});
test('cleanup audit failure rolls back both inquiry classification and automatic archival',async()=>{
 const db=await fixture();db.exec("UPDATE inquiries SET status='new',resolution='' WHERE id='i';CREATE TRIGGER deny_cleanup_audit BEFORE INSERT ON operator_audit_events BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
 await assert.rejects(()=>cleanupInquiry(adapter(db),{id:'i',kind:'test',reason:'Fixture',updatedAt:'now'},actor));assert.equal(db.prepare("SELECT status FROM inquiries WHERE id='i'").get().status,'new');assert.equal(db.prepare("SELECT status FROM accounts WHERE id='a'").get().status,'active');db.close();
});
