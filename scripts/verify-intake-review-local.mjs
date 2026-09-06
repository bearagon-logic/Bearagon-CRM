// Seeds ONLY local D1; no public form submission and no email is sent.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const eventId=`local-review-${randomUUID()}`,id=`website:${eventId}`;
const event={seq:Date.now(),eventId,source:'website',companyName:'',contactName:'Local Review QA',email:`review-${randomUUID()}@example.invalid`,phone:'',summary:'LOCAL TEST ONLY',sourceRef:'local-test',receivedAt:new Date().toISOString(),notificationStatus:'not_applicable'};
const quote=(v)=>`'${String(v).replaceAll("'","''")}'`;
const sql=`INSERT INTO intake_receipts(id,sequence,source,payload,received_at,reason) VALUES(${quote(id)},${event.seq},'website',${quote(JSON.stringify(event))},${quote(event.receivedAt)},'Missing company')`;
const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.local.jsonc','--command',sql],{env:{...process.env,WRANGLER_LOG_PATH:'.wrangler/wrangler.log'},encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
const base='http://localhost:5173';
async function call(body,expected=200){const r=await fetch(base+'/api/intake/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,expected,JSON.stringify(data));return data;}
await call({id,action:'import',data:{}},400);
const imported=await call({id,action:'import',data:{companyName:`Local Reviewed Company ${eventId}`}});
assert.ok(imported.inquiry.id);
await call({id,action:'import',data:{companyName:'Duplicate'}},409);
const inbox=await fetch(base+'/api/inquiries').then((r)=>r.json());
const inquiry=inbox.inquiries.find((i)=>i.id===imported.inquiry.id);
assert.ok(inquiry.recordedBy.startsWith('website · local-review-'));
const account=await fetch(base+`/api/clients/${inquiry.accountId}`).then((r)=>r.json());
assert.equal(account.client.relationshipType,'prospect');assert.equal(account.tasks.length,0);
const queue=await fetch(base+'/api/intake').then((r)=>r.json());assert.ok(!queue.reviews.some((r)=>r.id===id));
console.log('PASS: local receipt review → saved prospect inquiry → reload → duplicate resolution blocked. No public submission or email.');
