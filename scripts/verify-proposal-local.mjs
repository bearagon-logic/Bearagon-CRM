// Integration verification against local development only. Never target production.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const base='http://127.0.0.1:5173';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,server:{middlewareMode:true,hmr:false}});
try {
 const {serviceCatalog}=await vite.ssrLoadModule('/lib/service-catalog.ts');
 async function request(path,body,expected=200,headers={}){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={error:text};}assert.equal(response.status,expected,JSON.stringify(data));return data;}
 const created=await request('/api/clients',{companyName:'LOCAL QA - Proposal lifecycle',contactName:'Local verification',email:`proposal-${crypto.randomUUID()}@example.test`,startOnboarding:false},201);
 const id=created.client.id,path=`/api/clients/${id}/proposal`;
 let {proposal}=await request(path);
 const draft=proposal.draft;draft.ecosystem='Google Workspace';
 for(const s of serviceCatalog){draft.services[s.id].choice=s.id==='email'?'Include':'Not needed';for(const f of s.fields)draft.services[s.id].config[f.key]=f.options?.[0]||`Fixture: ${f.label}`;}
 Object.assign(draft,{setup:'2,000',monthly:'250',allowance:'100',overage:'50',eligible:'Local test scope',exclusions:'Local test exclusions',allocation:'Local test allocation'});
 ({proposal}=await request(path,{action:'save',expectedVersion:0,draft}));assert.equal(proposal.scopeRevision,1);
 await request(path,{action:'approve',expectedVersion:0},409);
 await request(path,{action:'approve',expectedVersion:proposal.version},403,{origin:'https://wrong.example'});
 ({proposal}=await request(path,{action:'approve',expectedVersion:proposal.version,reviewer:'Spoofed employee'}));assert.equal(proposal.approval.email,'local@bearagon.invalid');
 const preAcceptance=proposal.version;
 ({proposal}=await request(path,{action:'accept',expectedVersion:proposal.version,reference:'LOCAL TEST ONLY - no real contract',contact:'Local fixture',date:new Date().toISOString().slice(0,10)}));
 await request(path,{action:'accept',expectedVersion:preAcceptance,reference:'Duplicate',contact:'Local fixture',date:new Date().toISOString().slice(0,10)},409);
 const service=(await request(`/api/clients/${id}/services`)).services;assert.equal(service.length,1);assert.equal(service[0].name,'Email assistance');
 ({proposal}=await request(path,{action:'setup',expectedVersion:proposal.version,answers:['Fixture outcome','Fixture systems','Fixture authority']}));
 ({proposal}=await request(path,{action:'order',expectedVersion:proposal.version,key:'email',status:'tested',buildRef:'LOCAL build evidence',testRef:'LOCAL test evidence'}));
 assert.equal((await request(`/api/clients/${id}`)).tasks.find(t=>t.id===proposal.orders[0].taskId).status,'completed');
 const evidenceVersion=proposal.version;
 await request(path,{action:'setup',expectedVersion:proposal.version,answers:['Revised outcome','Fixture systems','Fixture authority']},409);
 ({proposal}=await request(path,{action:'setup',expectedVersion:proposal.version,answers:['Revised outcome','Fixture systems','Fixture authority'],confirmReset:true}));
 assert.equal(proposal.orders[0].status,'to_build');
 assert.equal((await request(`${path}?revision=${evidenceVersion}`)).proposal.orders[0].testRef,'LOCAL test evidence');
 const reopened=await request(`/api/clients/${id}`);assert.equal(reopened.tasks.find(t=>t.id===proposal.orders[0].taskId).status,'pending');
 assert.equal((await request(path)).proposal.setup.answers[0],'Revised outcome');
 await request(`${path}?revision=9999`,undefined,404);
 await request('/api/clients/not-a-real-company/proposal',undefined,404);
 const html=await fetch(`${base}/clients/${id}/scope`);assert.equal(html.status,200);
 console.log(`Local lifecycle passed. Fixture account: ${id}. No production calls or external messages.`);
} finally {await vite.close();}
