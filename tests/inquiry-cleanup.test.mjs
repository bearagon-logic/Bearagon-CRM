import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const source=await readFile(new URL('../app/api/inquiries/cleanup/route.ts',import.meta.url),'utf8');
const archiveSql=source.match(/db\.prepare\(`(UPDATE accounts[\s\S]*?RETURNING id)`\)/)[1];
async function fixture(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) db.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));db.exec("INSERT INTO accounts(id,name) VALUES('a','Test'); INSERT INTO contacts(id,display_name) VALUES('c','Test'); INSERT INTO account_contacts(account_id,contact_id) VALUES('a','c'); INSERT INTO inquiries(id,request_key,account_id,contact_id,source,summary,recorded_by,status,resolution,updated_at) VALUES('i','r','a','c','phone','Test','operator','closed','[Test submission] QA','now')");return db;}
test('cleanup archives only unused prospects and keeps contact/history',async()=>{const db=await fixture();assert.equal(db.prepare(archiveSql).all('now','a','i','now','i').length,1);assert.equal(db.prepare('SELECT count(*) n FROM contacts').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM inquiries').get().n,1);db.close();});
for(const [name,setup] of [
 ['client',"UPDATE accounts SET relationship_type='client'"],
 ['internal',"UPDATE accounts SET organization_kind='internal'"],
 ['qualified',"UPDATE accounts SET sales_stage='qualified'"],
 ['other inquiry',"INSERT INTO inquiries(id,request_key,account_id,contact_id,source,summary,recorded_by) VALUES('j','s','a','c','phone','Real','operator')"],
 ['shared contact',"INSERT INTO accounts(id,name) VALUES('b','Real'); INSERT INTO account_contacts(account_id,contact_id) VALUES('b','c')"],
 ['engagement',"INSERT INTO engagements(id,account_id) VALUES('e','a')"],
 ['stale inquiry',"UPDATE inquiries SET updated_at='later'"],
]) test(`cleanup protects ${name}`,async()=>{const db=await fixture();db.exec(setup);assert.equal(db.prepare(archiveSql).all('now','a','i','now','i').length,0);assert.equal(db.prepare("SELECT status FROM accounts WHERE id='a'").get().status,'active');db.close();});
test('cleanup remains authenticated, audited, and has no deletes',()=>{assert.match(source,/getOperatorIdentity/);assert.match(source,/operatorRequiredResponse/);assert.match(source,/db\.batch/);assert.match(source,/operator_audit_events/);assert.doesNotMatch(source,/DELETE FROM/);});
