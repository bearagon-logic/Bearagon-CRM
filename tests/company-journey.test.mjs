import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const {companySection,journeyPhase,phaseSection,companyView,companyDestination}=await vite.ssrLoadModule('/lib/company-journey.ts');
test('old bookmarks resolve into the unified company sections',()=>{assert.equal(companySection('onboarding'),'delivery');assert.equal(companySection('automations'),'services');assert.equal(companySection('complete'),'complete');assert.equal(companySection('unknown'),'overview');});
test('journey uses saved acceptance and answers, never tab selection as progress',()=>{const c={stage:'Not started',onboardingStatus:'not_started'};assert.equal(journeyPhase(c,null),0);assert.equal(journeyPhase(c,{version:1}),1);assert.equal(journeyPhase(c,{version:2,acceptance:{},setup:{answers:['','','']}}),2);assert.equal(journeyPhase(c,{version:3,acceptance:{},setup:{answers:['a','b','c']}}),3);assert.equal(journeyPhase({stage:'Live',onboardingStatus:'active'},null),3);assert.equal(journeyPhase({stage:'Live',onboardingStatus:'completed'},null),4);});
test('every stage has one company destination; legacy delivery remains accessible',()=>{assert.deepEqual([0,1,2,3,4].map(phaseSection),['overview','services','delivery','delivery','services']);assert.equal(journeyPhase({stage:'Intake',onboardingStatus:'active'},null),2);});
test('journey renders the five approved labels and accessible current stage',async()=>{const {CompanyJourney}=await vite.ssrLoadModule('/components/company-journey.tsx');const html=renderToStaticMarkup(React.createElement(CompanyJourney,{phase:2,onNavigate:()=>{}}));for(const label of ['Inquiry','Scope','Setup','Build &amp; test','Operate'])assert.ok(html.includes(label));assert.equal((html.match(/aria-current="step"/g)||[]).length,1);});
test('production page embeds scope and delivery; completion is gated and old route redirects',async()=>{const page=await readFile(new URL('../app/clients/[id]/page.tsx',import.meta.url),'utf8');assert.match(page,/CompanyWorkspace/);assert.doesNotMatch(page,/Onboarding requirements|Open guided setup/);const workspace=await readFile(new URL('../components/company-workspace.tsx',import.meta.url),'utf8');assert.match(workspace,/mode="services"/);assert.match(workspace,/mode="delivery"/);assert.match(workspace,/closed&&client.stage==='Live'/);assert.match(workspace,/completeOnboarding:true/);assert.match(workspace,/cipher-completion.png/);const redirect=await readFile(new URL('../app/clients/[id]/scope/page.tsx',import.meta.url),'utf8');assert.match(redirect,/redirect\(/);assert.doesNotMatch(redirect,/ProposalWorkspace/);});


test('internal Overview and Automation work mount distinct content with guarded navigation',async()=>{
  const source=await readFile(new URL('../components/company-workspace.tsx',import.meta.url),'utf8');
  assert.match(source,/section==='overview'&&<InternalOverview/);
  assert.match(source,/\(section==='delivery'\|\|section==='complete'\)&&<><InternalPortfolio/);
  assert.doesNotMatch(source,/section==='overview'\|\|section==='delivery'/);
  assert.match(source,/onWork=\{\(\)=>go\('delivery'\)\}/);
  assert.match(source,/if\(dirty&&!window.confirm/);
});

test('internal overview summarizes saved work without exposing the automation editor or claiming runtime health',async()=>{
  const {InternalOverview}=await vite.ssrLoadModule('/components/internal-overview.tsx');
  const {newProposal}=await vite.ssrLoadModule('/lib/proposal-model.ts');
  const proposal=newProposal('Internal fixture',true);
  proposal.acceptance={internal:true};proposal.setup.revision=2;
  const order={setupRevision:2,buildRef:'Build',testRef:'Tests',internalRelease:null};
  proposal.orders=[{...order,key:'p',status:'to_build'},{...order,key:'b',status:'building'},{...order,key:'t',status:'tested'},{...order,key:'o',status:'tested',internalRelease:{setupRevision:2,review:'Approved'}},{...order,key:'stale',status:'tested',setupRevision:1,internalRelease:{setupRevision:1,review:'Old'}}];
  const before=structuredClone(proposal);
  const html=renderToStaticMarkup(React.createElement(InternalOverview,{proposal,owner:'Fixture owner',notes:'Keep this note.\nAnd this decision.',onWork:()=>{},onServices:()=>{},onPlan:()=>{}}));
  assert.match(html,/>Internal operations overview</);
  assert.match(html,/<b>2<\/b> Planned/);
  for(const label of ['Building','Testing','Approved for use'])assert.ok(html.includes('<b>1</b> '+label));
  assert.match(html,/Fixture owner/);assert.match(html,/Keep this note/);
  assert.match(html,/Open automation work/);assert.match(html,/separate Console observations/);
  assert.doesNotMatch(html,/Edit build &amp; test|Add automation|Shared setup, original build briefs|<textarea|<input/);
  assert.deepEqual(proposal,before);
});

test('internal overview has an honest empty state before authorization',async()=>{
  const {InternalOverview}=await vite.ssrLoadModule('/components/internal-overview.tsx');
  const html=renderToStaticMarkup(React.createElement(InternalOverview,{proposal:null,owner:'',notes:'',onWork:()=>{},onServices:()=>{},onPlan:()=>{}}));
  assert.match(html,/No internal plan has been authorized/);assert.match(html,/Establish internal plan/);
  assert.match(html,/Unassigned/);assert.match(html,/No internal notes recorded/);
  assert.doesNotMatch(html,/Approved for use|onboarding finish|Edit build/);
});

test('company profiles stay in Companies at every stage; onboarding owns progress',()=>{
  for(const phase of [0,1,2,3,4]) {
    assert.equal(companyView('overview',phase,'company'),'company');
    assert.equal(companyView('activity',phase,'company'),'company');
    assert.equal(companyView('delivery',phase,'company'),'onboarding');
    assert.equal(companyView('activity',phase,'onboarding'),'onboarding');
    assert.equal(companyDestination('a/b','overview',phase,'onboarding'),'/clients/a%2Fb?tab=overview');
    assert.equal(companyDestination('a/b','delivery',phase),'/onboarding/a%2Fb?tab=delivery');
  }
  assert.equal(companyView('services',1,'company'),'onboarding');
  assert.equal(companyView('services',4,'company'),'operations');
  assert.equal(companyView('services',4,'onboarding'),'onboarding');
  assert.equal(companyDestination('a','services',4),'/clients/a?tab=services');
  assert.equal(companyDestination('a','services',4,'onboarding'),'/onboarding/a?tab=services');
  assert.equal(companyDestination('a','delivery',4,undefined,true),'/clients/a?tab=delivery');
  assert.equal(companyDestination('a','activity',2,'onboarding'),'/onboarding/a?tab=activity');
});
