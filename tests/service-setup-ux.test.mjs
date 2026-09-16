import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,cacheDir:root+'/.vite-test-cache/service-setup',resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {deliveryReadiness}=await vite.ssrLoadModule('/lib/delivery-readiness.ts');
const {DeliveryNextAction}=await vite.ssrLoadModule('/components/delivery-next-action.tsx');
const {queueItems}=await vite.ssrLoadModule('/lib/workspace-model.ts');
const {journeyPhase}=await vite.ssrLoadModule('/lib/company-journey.ts');
const {newProposal}=await vite.ssrLoadModule('/lib/proposal-model.ts');
const {emailSteps,emailGuideVersion}=await vite.ssrLoadModule('/lib/email-playbook.ts');
const {emailResumeStep,emailResumeLabel,entryFrom,rememberDraft,withoutSavedDraft}=await vite.ssrLoadModule('/lib/email-walkthrough-state.ts');
const {EmailWalkthrough}=await vite.ssrLoadModule('/components/email-walkthrough.tsx');
const {EmailWalkthroughLink}=await vite.ssrLoadModule('/components/email-walkthrough-link.tsx');
const tasks=['agreement','discovery','communications','business_system','guardrails','automation_build','client_test','launch'].map(key=>({id:key,templateKey:key,title:key,status:'completed'}));
const config={provider:'google',mailboxType:'individual',mailboxes:'Test mailbox',harness:'Codex',owner:'Emily',reviewer:'Test reviewer',mode:'draft',rules:'Draft only'};
function run(){return {version:emailGuideVersion,config:{...config},steps:emailSteps(config),progress:{},setupRevision:1};}
function proposal(r){const p=newProposal('Fixture company',false);p.acceptance={reference:'Fixture'};p.orders=[{key:'email',name:'Email assistance',emailRun:r}];return p;}

test('legacy completion produces the same next action in delivery and queues, retaining coordination separately',()=>{
  const p=newProposal('Existing company',false),readiness=deliveryReadiness('active',tasks,p);
  assert.equal(readiness.ready,true);assert.equal(readiness.legacy,true);assert.equal(readiness.complete,8);
  assert.equal(readiness.stageLabel,'Handoff review');
  const stale='Complete discovery form';
  const html=renderToStaticMarkup(React.createElement(DeliveryNextAction,{readiness,coordination:stale}));
  assert.ok(html.indexOf('Ready for final handoff review')<html.indexOf('Saved coordination note:'));
  assert.match(html,/Saved coordination note:<\/b> Complete discovery form/);
  const [queue]=queueItems([],[{id:'e',accountId:'a',accountName:'Fixture',status:'active',nextStep:stale,readiness,targetDate:'',blocked:0}],[],'2026-09-11');
  assert.equal(queue.title,readiness.label);assert.notEqual(queue.title,stale);
  // Saving an exploratory package draft must not lock an existing delivery plan.
  p.version=1;assert.equal(deliveryReadiness('active',tasks,p).ready,true);
  assert.equal(journeyPhase({stage:'Testing',onboardingStatus:'active'},p),3);
});
test('blocked, incomplete, missing and new unaccepted plans never advertise final readiness',()=>{
  for(const status of ['pending','in_progress','blocked']){
    const changed=tasks.map(t=>t.id==='discovery'?{...t,status}:t);
    const r=deliveryReadiness('active',changed,null);assert.equal(r.ready,false);assert.match(r.label,/discovery/);
  }
  assert.equal(deliveryReadiness('blocked',tasks,null).ready,false);
  const p=newProposal('New company',false);p.version=1;
  assert.equal(deliveryReadiness('active',[],p).kind,'scope');
  assert.equal(deliveryReadiness('completed',tasks,null).kind,'complete');
});
test('accepted plans require complete setup and current work-order evidence even at 8/8 requirements',()=>{
  const p=proposal(run());p.setup={answers:['','',''],revision:2};
  assert.equal(deliveryReadiness('active',tasks,p).kind,'setup');
  p.setup.answers=['Outcome','Systems','Authority'];
  Object.assign(p.orders[0],{status:'tested',setupRevision:1,buildRef:'Build reference',testRef:'Old evidence'});
  assert.equal(deliveryReadiness('active',tasks,p).kind,'work');
  p.orders[0].setupRevision=2;p.orders[0].testRef='';assert.equal(deliveryReadiness('active',tasks,p).ready,false);
  assert.equal(deliveryReadiness('active',tasks,p).stageLabel,'Build & test');
  p.orders[0].testRef='Current evidence';assert.equal(deliveryReadiness('active',tasks,p).ready,true);
  p.orders[0].buildRef='';assert.equal(deliveryReadiness('active',tasks,p).ready,false);
  assert.equal(deliveryReadiness('active',tasks,p).kind,'work');
  p.orders[0].buildRef='Build reference';
  assert.equal(deliveryReadiness('active',[...tasks,{id:'scope',templateKey:'scope:email',title:'Email',status:'in_progress'}],p).ready,false);
});
test('resume resolves earliest unfinished prerequisite and rendering opens that step without configuration',()=>{
  const r=run();r.progress[r.steps[0].id]={...entryFrom(),status:'completed',evidence:'Recorded'};
  r.progress[r.steps[2].id]={...entryFrom(),status:'in_progress',notes:'Later work'};
  assert.equal(emailResumeStep(r),r.steps[1].id);
  const p=proposal(r),html=renderToStaticMarkup(React.createElement(EmailWalkthrough,{accountId:'fixture',initialData:{proposal:p}}));
  assert.ok(html.includes(r.steps[1].title));assert.doesNotMatch(html,/Confirm the implementation route/);
  const link=renderToStaticMarkup(React.createElement(EmailWalkthroughLink,{accountId:'fixture',order:p.orders[0]}));
  assert.ok(link.includes(emailResumeLabel(r)));assert.ok(link.includes('Continue:'));
  r.progress[r.steps[0].id].status='blocked';assert.equal(emailResumeStep(r),r.steps[0].id);
});
test('resume distinguishes incomplete configuration, recorded completion and read-only history',()=>{
  assert.equal(emailResumeStep(), 'configuration');
  const r=run();r.config.reviewer='';assert.equal(emailResumeStep(r),'configuration');r.config.reviewer=config.reviewer;
  for(const s of r.steps)r.progress[s.id]={...entryFrom(),status:'completed',evidence:'Recorded'};
  assert.equal(emailResumeStep(r),'summary');
  let html=renderToStaticMarkup(React.createElement(EmailWalkthrough,{accountId:'fixture',initialData:{proposal:proposal(r)}}));
  assert.match(html,/Review recorded walkthrough/);assert.match(html,/Ready for the delivery review/);assert.doesNotMatch(html,/Confirm the implementation route/);
  r.progress={};assert.equal(emailResumeStep(r,true),'summary');
  html=renderToStaticMarkup(React.createElement(EmailWalkthrough,{accountId:'fixture',initialData:{proposal:proposal(r),closed:true}}));
  assert.match(html,/read-only history/);assert.match(html,/Saved walkthrough progress/);assert.doesNotMatch(html,/Ready for the delivery review/);
  r.version='unsupported';assert.equal(emailResumeStep(r),'summary');
});
test('independent configuration and prerequisite drafts retain exact values until their own successful save',()=>{
  const saved=entryFrom(),base=JSON.stringify(saved);
  const paragraph='First line.\n\nDetailed notes with punctuation & a follow-up.';
  const notes={...saved,notes:paragraph,evidence:'Restricted reference',blocker:'Waiting for access'};
  const changedConfig={...config,reviewer:'Revised reviewer'};
  let drafts={configuration:rememberDraft(changedConfig,JSON.stringify(config)),entries:{test:rememberDraft(notes,base)}};
  drafts.entries.authority=rememberDraft({...saved,notes:'Prerequisite notes'},base);
  // Navigation and a failed save do not clear drafts; a fresh server snapshot
  // remains a separate comparison baseline rather than replacing typed values.
  const fresh={...saved,notes:'Another operator saved here'};
  assert.notEqual(drafts.entries.test.base,JSON.stringify(fresh));assert.equal(drafts.entries.test.value.notes,paragraph);
  drafts=withoutSavedDraft(drafts,'authority');
  assert.deepEqual(drafts.entries.test.value,notes);assert.deepEqual(drafts.configuration.value,changedConfig);assert.equal(drafts.entries.authority,undefined);
  drafts=withoutSavedDraft(drafts,'configuration');assert.deepEqual(drafts.entries.test.value,notes);
  // A provider switch can remove a step from the route without deleting its draft.
  assert.equal(emailSteps({...config,provider:'microsoft'}).some(s=>s.id==='connect-google'),false);
  drafts.entries['connect-google']=rememberDraft(notes,base);assert.deepEqual(drafts.entries['connect-google'].value,notes);
  drafts=withoutSavedDraft(drafts,'test');assert.equal(drafts.entries.test,undefined);assert.ok(drafts.entries['connect-google']);
  assert.equal(rememberDraft(saved,base),undefined);
});
