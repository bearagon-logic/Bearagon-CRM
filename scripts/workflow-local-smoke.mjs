// Explicit local-only integration fixture. No sends, provisioning or execution.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const base='http://127.0.0.1:5175';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
async function api(path,body,method='POST'){const r=await fetch(base+path,{headers:{'content-type':'application/json'},...(body?{method,body:JSON.stringify(body)}:{})});const d=await r.json();assert.ok(r.ok,`${path}: ${r.status} ${d.error}`);return d;}
try {
 const stamp=crypto.randomUUID(),companyName=`LOCAL ONLY — workflow regression ${stamp.slice(0,8)}`;
 const a=await api('/api/inquiries',{requestKey:crypto.randomUUID(),companyName,contactName:'Local fixture',email:`fixture-${stamp}@example.com`,source:'other',summary:'LOCAL ONLY simulated intake',owner:'Brendan',nextAction:'Review local fixture'});
 const id=a.inquiry.accountId;
 const b=await api('/api/inquiries',{requestKey:crypto.randomUUID(),accountId:id,contactName:'Local fixture',email:`fixture-${stamp}@example.com`,source:'other',summary:'Separate callback must stay open'});
 await api(`/api/clients/${id}/relationship`,{relationshipOwner:'Brendan',salesStage:'qualified',relationshipNextAction:'Review service scope',followUpDate:'',marketingStatus:'unknown',marketingEvidence:''},'PATCH');
 await api('/api/inquiries',{action:'handoff',id:a.inquiry.id,accountId:id,expectedUpdatedAt:a.inquiry.updatedAt},'PATCH');
 const stale=await fetch(base+'/api/inquiries',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'handoff',id:b.inquiry.id,accountId:id,expectedUpdatedAt:'stale'})});assert.equal(stale.status,409);
 const inquiries=(await api(`/api/inquiries?accountId=${id}`)).inquiries;
 assert.equal(inquiries.find(i=>i.id===a.inquiry.id).status,'closed');assert.equal(inquiries.find(i=>i.id===b.inquiry.id).status,'new');
 const {serviceCatalog}=await vite.ssrLoadModule('/lib/proposal-scope.ts');
 let p=(await api(`/api/clients/${id}/proposal`)).proposal;
 async function action(body){const d=await api(`/api/clients/${id}/proposal`,{...body,expectedVersion:p.version});p=d.proposal;assert.ok(d.history.some(h=>h.version===p.version),'history includes committed version');}
 const draft=p.draft;draft.ecosystem='Google Workspace';draft.setup='2,000';draft.monthly='500';draft.allowance='100';draft.overage='50';draft.eligible='Local test costs';draft.exclusions='All real spending excluded';draft.allocation='Local fixture ledger';
 for(const s of serviceCatalog){draft.services[s.id].choice=s.id==='email'?'Include':'Not needed';for(const f of s.fields)draft.services[s.id].config[f.key]=f.options?.[0]||'LOCAL ONLY sample requirement';}
 await action({action:'save',draft});await action({action:'approve'});await action({action:'accept',reference:'LOCAL ONLY simulated acceptance, no contract',contact:'Local fixture',date:new Date().toISOString().slice(0,10)});
 assert.equal((await api(`/api/clients/${id}/relationship`)).account.salesStage,'won');
 await action({action:'setup',answers:['LOCAL success','LOCAL systems','LOCAL authority']});await action({action:'order',key:'email',status:'tested',buildRef:'LOCAL simulated build paragraph',testRef:'LOCAL simulated test paragraph'});const prior=p.version;
 await action({action:'setup',answers:['LOCAL revised success','LOCAL systems','LOCAL authority'],confirmReset:true});assert.equal(p.orders[0].status,'to_build');
 const historic=(await api(`/api/clients/${id}/proposal?revision=${prior}`)).proposal;assert.equal(historic.orders[0].testRef,'LOCAL simulated test paragraph');
 await action({action:'order',key:'email',status:'tested',buildRef:'LOCAL simulated re-build',testRef:'LOCAL simulated retest'});
 const service=(await api(`/api/clients/${id}/services`)).services[0];assert.equal(service.delivery.monthly,50000);assert.equal(service.delivery.setup,200000);assert.equal(service.delivery.order.status,'tested');assert.equal(service.installationIds.length,0);
 const detail=await api(`/api/clients/${id}`);
 for(const key of ['agreement','discovery','communications','business_system','guardrails','automation_build','client_test','launch']){const task=detail.tasks.find(t=>t.templateKey===key);await api(`/api/clients/${id}`,{taskId:task.id,status:['communications','business_system'].includes(key)?'skipped':'completed',evidenceRef:'LOCAL ONLY simulated evidence',completionNote:'LOCAL ONLY approved simulation/exception; no external systems or client approvals.'},'PATCH');}
 await api(`/api/clients/${id}`,{stage:'Live'},'PATCH');await api(`/api/clients/${id}`,{completeOnboarding:true},'PATCH');
 assert.equal((await api(`/api/clients/${id}`)).client.onboardingStatus,'completed');assert.equal((await api(`/api/clients/${id}/proposal`)).closed,true);
 console.log(JSON.stringify({passed:true,companyId:id,companyName,checks:['selected inquiry only','relationship won on acceptance','history freshness','evidence preserved after revalidation','accepted package pricing','no invented installation','requirements and closed handoff']}));
} finally {await vite.close();}
