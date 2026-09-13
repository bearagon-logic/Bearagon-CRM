import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdir,readFile } from 'node:fs/promises';
import test,{after} from 'node:test';
import {createServer} from 'vite';
const root=new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const vite=await createServer({appType:'custom',configFile:false,root,server:{middlewareMode:true,hmr:false}});after(()=>vite.close());
const {parseOperationsOwner,saveOperationsOwner}=await vite.ssrLoadModule('/lib/server/operations-owner.ts');
const actor={userId:'operator',email:'operator@example.test',displayName:'Test operator'};

async function fixture(){const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of(await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));sqlite.exec("INSERT INTO accounts(id,name) VALUES('qa','QA'),('internal','Bearagon');INSERT INTO workspaces(id,account_id,slug,display_name,console_client_id) VALUES('original','qa','qa','QA','workspace-console')");
 sqlite.exec("UPDATE accounts SET organization_kind='internal',notes='Preserve internal notes' WHERE id='internal'");
 const db={prepare(sql){const stmt={values:[],bind(...values){return {...stmt,values};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...this.values).changes)}};}};return stmt;},async batch(statements){sqlite.exec('BEGIN');try{const r=statements.map(s=>s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};return {sqlite,db};}

test('operations owner validates the roster and requires the prior saved assignment',()=>{
  assert.deepEqual(parseOperationsOwner({owner:'Brendan',expectedOwner:''}),{owner:'Brendan',expectedOwner:''});
  for(const value of [null,{owner:'Unknown',expectedOwner:''},{owner:'Emily'},{owner:5,expectedOwner:''}])assert.throws(()=>parseOperationsOwner(value));
});
test('operations owner updates only the chosen account and records the authenticated actor',async()=>{
  const {sqlite,db}=await fixture();
  const other=sqlite.prepare("SELECT * FROM accounts WHERE id='qa'").get();
  const before=sqlite.prepare("SELECT * FROM accounts WHERE id='internal'").get();
  await saveOperationsOwner(db,'internal',{owner:'Brendan',expectedOwner:''},actor);
  const after=sqlite.prepare("SELECT * FROM accounts WHERE id='internal'").get();
  assert.equal(after.relationship_owner,'Brendan');
  for(const key of Object.keys(before).filter(k=>!['relationship_owner','updated_at'].includes(k)))assert.equal(after[key],before[key]);
  assert.deepEqual(sqlite.prepare("SELECT * FROM accounts WHERE id='qa'").get(),other);
  const audit=sqlite.prepare('SELECT * FROM operator_audit_events').get();
  assert.equal(audit.actor_id,actor.userId);assert.equal(audit.action,'operations.owner_updated');
  assert.deepEqual(JSON.parse(audit.detail),{previousOwner:'',owner:'Brendan'});
  await assert.rejects(()=>saveOperationsOwner(db,'internal',{owner:'Emily',expectedOwner:''},actor),/Owner not saved/);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM operator_audit_events').get().n,1);
  await saveOperationsOwner(db,'internal',{owner:'',expectedOwner:'Brendan'},actor);
  assert.equal(sqlite.prepare("SELECT relationship_owner FROM accounts WHERE id='internal'").get().relationship_owner,'');
  sqlite.close();
});
test('external, missing and archived accounts cannot be changed; failed writes roll back the audit',async()=>{
  const {sqlite,db}=await fixture();
  for(const id of ['qa','missing'])await assert.rejects(()=>saveOperationsOwner(db,id,{owner:'Brendan',expectedOwner:''},actor),/Owner not saved/);
  sqlite.exec("UPDATE accounts SET status='archived' WHERE id='internal'");
  await assert.rejects(()=>saveOperationsOwner(db,'internal',{owner:'Brendan',expectedOwner:''},actor),/Owner not saved/);
  sqlite.exec("UPDATE accounts SET status='active' WHERE id='internal';CREATE TRIGGER fail_owner BEFORE UPDATE OF relationship_owner ON accounts BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
  await assert.rejects(()=>saveOperationsOwner(db,'internal',{owner:'Brendan',expectedOwner:''},actor));
  assert.equal(sqlite.prepare('SELECT count(*) n FROM operator_audit_events').get().n,0);
  assert.equal(sqlite.prepare("SELECT relationship_owner FROM accounts WHERE id='internal'").get().relationship_owner,'');
  sqlite.close();
});
