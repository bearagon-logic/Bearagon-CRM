import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import test, { after } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ appType:'custom', configFile:false, root, cacheDir:root+'/.vite-test-cache/scoping-work', resolve:{alias:{'@':root}}, optimizeDeps:{noDiscovery:true}, server:{middlewareMode:true,hmr:false} });
after(() => vite.close());
const { readScopingWork } = await vite.ssrLoadModule('/lib/server/scoping-work.ts');
const { routeInquiry } = await vite.ssrLoadModule('/lib/server/inquiry-routing.ts');
const { newProposal } = await vite.ssrLoadModule('/lib/proposal-model.ts');
const actor = { userId:'operator', email:'operator@example.test', displayName:'Operator' };

async function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) {
    sqlite.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  }
  sqlite.exec("INSERT INTO accounts(id,name,relationship_owner,follow_up_date,relationship_next_action) VALUES('a','Example company','Emily','2026-09-20','Call the owner'); INSERT INTO contacts(id,display_name) VALUES('contact','Example owner'); INSERT INTO inquiries(id,request_key,account_id,contact_id,source,summary,status,recorded_by,updated_at) VALUES('one','r1','a','contact','phone','Help with calls','new','source','original')");
  const statement = (sql, values=[]) => ({
    bind(...args) { return statement(sql,args); },
    async all() { return { results:sqlite.prepare(sql).all(...values) }; },
    run() { return { meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)} }; },
  });
  const db = { prepare:statement, async batch(statements) { sqlite.exec('BEGIN'); try { const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results; } catch(e) { sqlite.exec('ROLLBACK');throw e; } } };
  const handoff = () => routeInquiry(db,{id:'one',accountId:'a',expectedUpdatedAt:'original',action:'workflow'},actor);
  const saveProposal = state => sqlite.prepare('INSERT INTO account_proposals(account_id,version,mutation_id,state,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET version=excluded.version,state=excluded.state').run('a',Math.max(1,state.version||1),'fixture',JSON.stringify(state),'2026-09-16T00:00:00Z');
  return {sqlite,db,handoff,saveProposal};
}

test('handoff remains visible before acceptance without creating or mutating delivery', async () => {
  const {sqlite,db,handoff}=await fixture();
  try {
    assert.deepEqual(await readScopingWork(db),[]);
    await handoff();
    const before=sqlite.prepare('SELECT * FROM accounts').all();
    const [scope]=await readScopingWork(db);
    assert.equal(scope.accountId,'a');assert.equal(scope.stage,'Prepare scope');
    assert.equal(scope.owner,'Emily');assert.equal(scope.followUpDate,'2026-09-20');
    assert.equal(scope.coordination,'Call the owner');
    assert.equal(sqlite.prepare('SELECT count(*) n FROM engagements').get().n,0);
    assert.equal(sqlite.prepare("SELECT status FROM inquiries WHERE id='one'").get().status,'closed');
    assert.deepEqual(sqlite.prepare('SELECT * FROM accounts').all(),before);
  } finally { sqlite.close(); }
});

test('qualifying a lead alone does not duplicate it into scope work',async()=>{
  const {sqlite,db}=await fixture();try {
    await routeInquiry(db,{id:'one',accountId:'a',expectedUpdatedAt:'original',action:'lead'},actor);
    assert.deepEqual(await readScopingWork(db),[]);
  } finally { sqlite.close(); }
});

test('saved revisions guide scope review and external acceptance without inventing approval',async()=>{
  const {sqlite,db,saveProposal}=await fixture();try {
    const p=newProposal('Example company',false);p.version=1;p.scopeRevision=2;saveProposal(p);
    assert.equal((await readScopingWork(db))[0].stage,'Internal review');
    p.approval={revision:1};saveProposal(p);assert.equal((await readScopingWork(db))[0].stage,'Internal review');
    p.approval.revision=2;saveProposal(p);assert.equal((await readScopingWork(db))[0].stage,'Client acceptance');
    p.acceptance={revision:2};saveProposal(p);
    const [attention]=await readScopingWork(db);assert.equal(attention.stage,'Review saved scope');assert.match(attention.nextAction,/delivery record is missing/);assert.doesNotMatch(attention.nextAction,/record client acceptance/);
    sqlite.exec("INSERT INTO engagements(id,account_id,kind,status) VALUES('accepted','a','onboarding','active')");assert.deepEqual(await readScopingWork(db),[]);
  } finally { sqlite.close(); }
});

for (const [label,sql] of [
  ['archived',"UPDATE accounts SET status='archived'"],
  ['inactive',"UPDATE accounts SET status='inactive'"],
  ['internal',"UPDATE accounts SET organization_kind='internal'"],
  ['lost',"UPDATE accounts SET sales_stage='lost'"],
  ['nurture',"UPDATE accounts SET sales_stage='nurture'"],
  ['vendor',"UPDATE accounts SET relationship_type='vendor'"],
  ...['planned','active','blocked','completed','cancelled'].map(status=>[`${status} onboarding`,`INSERT INTO engagements(id,account_id,kind,status) VALUES('eng','a','onboarding','${status}')`]),
]) test(`${label} records do not appear as pending scope`,async()=>{
  const {sqlite,db,handoff}=await fixture();try {await handoff();sqlite.exec(sql);assert.deepEqual(await readScopingWork(db),[]);} finally {sqlite.close();}
});

test('multiple handoffs deduplicate per company',async()=>{
  const {sqlite,db,handoff}=await fixture();try {
    await handoff();
    sqlite.exec("INSERT INTO operator_audit_events(id,account_id,resource_type,resource_id,action,actor_id,actor_email,actor_name,result,detail) VALUES('second','a','inquiry','old','inquiry.handed_off','operator','operator@example.test','Operator','succeeded','Earlier handoff')");
    assert.equal((await readScopingWork(db)).length,1);
  } finally {sqlite.close();}
});
