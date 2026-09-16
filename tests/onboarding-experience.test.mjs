import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,cacheDir:root+'/.vite-test-cache/onboarding-experience',resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {CompanyJourney}=await vite.ssrLoadModule('/components/company-journey.tsx');
const {AutomationBrief}=await vite.ssrLoadModule('/components/automation-brief.tsx');
const {newProposal}=await vite.ssrLoadModule('/lib/proposal-model.ts');
const {scopingQueueItems,onboardingStageOptions}=await vite.ssrLoadModule('/lib/workspace-model.ts');
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));
const buttons=html=>[...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(match=>match[0]);

test('journey distinguishes available navigation from completion and gates build and operations',()=>{
  const html=render(CompanyJourney,{phase:2,deliveryAvailable:true,buildAvailable:false,onNavigate:()=>{}}),controls=buttons(html);
  assert.equal(controls.length,5);
  assert.doesNotMatch(html,/✓|completed|class="done"/);
  assert.doesNotMatch(controls[2],/disabled/);
  assert.match(controls[2],/Current/);
  assert.match(controls[3],/disabled/);assert.match(controls[3],/Later/);assert.match(controls[3],/setup answers are saved/);
  assert.match(controls[4],/disabled/);assert.match(controls[4],/saved onboarding handoff/);
  assert.doesNotMatch(buttons(render(CompanyJourney,{phase:4,onNavigate:()=>{}}))[4],/disabled/);
});

test('scope queue retains owner/due date and sends review work to saved review, without creating delivery records',()=>{
  const records=[{id:'scope-one',accountId:'a/b',accountName:'Fixture',owner:'',followUpDate:'2026-09-10',nextAction:'Approve saved scope',stage:'Internal review'},{id:'scope-two',accountId:'b',accountName:'Second',owner:'Emily',followUpDate:'',nextAction:'Set up package',stage:'Prepare scope'}];
  const before=structuredClone(records),items=scopingQueueItems(records,'2026-09-16');
  assert.equal(items[0].kind,'Scope');assert.equal(items[0].owner,'Unassigned');assert.equal(items[0].priority,0);
  assert.equal(items[0].href,'/onboarding/a%2Fb?tab=services&step=review');assert.equal(items[1].href,'/onboarding/b?tab=services');assert.deepEqual(records,before);
});

test('delivery stage filters retain normal labels and every observed external stage without internal-only values',()=>{
  const stages=onboardingStageOptions([{readiness:{stageLabel:'Scope'}},{readiness:{stageLabel:'Earlier delivery review'}},{readiness:{stageLabel:'Setup'}},{organizationKind:'internal',readiness:{stageLabel:'Internal-only stage'}}]);
  for(const stage of ['Scope','Setup','Build & test','Blocked','Handoff review','Earlier delivery review'])assert.ok(stages.includes(stage));
  assert.equal(stages.filter(stage=>stage==='Setup').length,1);
  assert.ok(!stages.includes('Internal-only stage'));
});

function savedPhone(){const proposal=newProposal('Fixture company',false);proposal.version=4;proposal.scopeRevision=2;proposal.setup.revision=1;proposal.acceptance={revision:2,internal:false,reference:'Saved agreement'};proposal.draft.services.calls.choice='Include';proposal.draft.systems=[{purpose:'Phone reception',provider:'Retell',status:'Existing',owner:'Fixture owner',notes:''}];proposal.orders=[{key:'calls',name:'Phone reception',status:'to_build',setupRevision:1,buildRef:'',testRef:''}];return proposal;}
test('automation brief renders saved source, unresolved inputs and provider guide, with copy and manual fallback',()=>{
  const proposal=savedPhone(),before=structuredClone(proposal),html=render(AutomationBrief,{proposal,orderKey:'calls'});
  for(const text of ['Saved accepted scope','revision 2','setup 1','Inputs still needed','Copy prompt','Select prompt','Full prompt','Retell','Inputs','Build','Verify'])assert.ok(html.includes(text),text);
  assert.match(html,/readOnly=""/);assert.match(html,/Unsaved setup or scope edits are excluded/);
  const build=html.slice(html.indexOf('>Build</summary>'),html.indexOf('>Verify</summary>'));
  assert.match(build,/Retell/);
  assert.deepEqual(proposal,before);
});
test('automation brief never exposes unaccepted or mismatched scope as an executable-looking prompt',()=>{
  const proposal=savedPhone();proposal.acceptance.revision=1;
  assert.equal(render(AutomationBrief,{proposal,orderKey:'calls'}),'');
  assert.equal(render(AutomationBrief,{proposal:newProposal('Draft',false),orderKey:'calls'}),'');
});
