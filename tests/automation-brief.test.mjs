import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ appType: 'custom', configFile: false, root, cacheDir: root + '/.vite-test-cache/automation-brief', resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const { buildAutomationBrief } = await vite.ssrLoadModule('/lib/automation-brief.ts');
const { newProposal, transitionProposal } = await vite.ssrLoadModule('/lib/proposal-model.ts');
const { serviceCatalog } = await vite.ssrLoadModule('/lib/service-catalog.ts');
const { emailDefaults, emailGuideVersion } = await vite.ssrLoadModule('/lib/email-playbook.ts');
const actor = { id: 'operator-fixture', name: 'Emily', email: 'operator@example.test', at: '2026-09-16T12:00:00.000Z' };
const change = (state, command) => transitionProposal(state, { expectedVersion: state.version, ...command }, actor, () => crypto.randomUUID());
function accepted(internal = false) {
  let proposal = newProposal('Fixture Company', internal);
  const draft = proposal.draft;
  Object.assign(draft, { ecosystem: 'Mixed systems', setup: '0', monthly: '75', allowance: '20', overage: '0', eligible: 'Scoped API charges', exclusions: 'Customer subscriptions', allocation: 'Per-workspace ledger' });
  draft.systems = [{ purpose: 'Lead destination', provider: 'Existing fixture CRM', status: 'Existing', owner: 'Fixture administrator', notes: 'Account alpha; access unverified' }];
  for (const service of serviceCatalog) for (const field of service.fields) draft.services[service.id].config[field.key] = field.options?.[0] || `Agreed ${field.label}`;
  draft.customServices = [{ id: 'custom_fixture', name: 'Report preparation', included: true, outcome: 'Weekly project summary', systems: 'Restricted project workspace', boundaries: 'Read-only; named reviewer before sharing', acceptance: 'Reconcile three sample reports; no sharing during tests' }];
  proposal = change(proposal, { action: 'save', draft });
  proposal = change(proposal, { action: 'approve' });
  proposal = change(proposal, { action: internal ? 'authorizeInternal' : 'accept', contact: 'Fixture buyer', reference: 'Fixture accepted quote', date: '2026-09-16' });
  return change(proposal, { action: 'setup', answers: ['Complete the saved acceptance cases', 'Use account alpha only; hand off to Taylor', 'Read access only; Taylor approves sharing'] });
}

test('brief only exposes a matching saved authorized work order and current accepted scope', () => {
  assert.equal(buildAutomationBrief(newProposal('Unaccepted', false), 'email'), null);
  const proposal = accepted();
  assert.equal(buildAutomationBrief(proposal, 'unknown'), null);
  const mismatched = structuredClone(proposal); mismatched.acceptance.revision--;
  assert.equal(buildAutomationBrief(mismatched, 'email'), null);
  const wrongAuthority = structuredClone(proposal); wrongAuthority.acceptance.internal = true;
  assert.equal(buildAutomationBrief(wrongAuthority, 'email'), null);
  const unscoped = structuredClone(proposal); unscoped.orders.push({ ...unscoped.orders[0], key: 'marketing', name: 'Unordered marketing' });
  assert.equal(buildAutomationBrief(unscoped, 'marketing'), null);
  const forgedInternal = structuredClone(proposal); forgedInternal.orders.push({ ...forgedInternal.orders[0], key: 'internal_extra', brief: 'Not an internal organization' });
  assert.equal(buildAutomationBrief(forgedInternal, 'internal_extra'), null);
});

test('catalog brief retains source revisions, saved provider responsibility and zero usage ceiling without modifying records', () => {
  const proposal = accepted(), before = structuredClone(proposal);
  const brief = buildAutomationBrief(proposal, 'followup');
  assert.equal(brief.scopeRevision, proposal.scopeRevision);
  assert.equal(brief.setupRevision, proposal.setup.revision);
  for (const value of ['Existing fixture CRM', 'Fixture administrator', 'Account alpha; access unverified', 'maximum additional usage 0', 'Scoped API charges', 'Per-workspace ledger', 'Fixture accepted quote', 'Agreed Destination CRM and matching']) assert.ok(brief.text.includes(value), value);
  assert.match(brief.text, /client’s designated CRM/);
  assert.match(brief.text, /duplicate\/replayed input/);
  assert.match(brief.text, /actual build reference and test report/);
  assert.match(brief.text, /Do not activate an automation from this prompt/);
  assert.match(brief.text, /Missing or stale observations remain unknown/);
  assert.deepEqual(proposal, before);
});

test('custom service brief includes systems, boundaries and actual acceptance criteria, excluding unselected work', () => {
  const proposal = accepted();
  proposal.draft.customServices.push({ id: 'custom_excluded', name: 'Unapproved idea', included: false, outcome: 'UNAPPROVED_CONTENT', systems: '', boundaries: '', acceptance: '' });
  const brief = buildAutomationBrief(proposal, 'custom_fixture');
  for (const value of ['Weekly project summary', 'Restricted project workspace', 'Read-only; named reviewer before sharing', 'Reconcile three sample reports; no sharing during tests']) assert.ok(brief.text.includes(value), value);
  assert.doesNotMatch(brief.text, /UNAPPROVED_CONTENT/);
  assert.equal(buildAutomationBrief(proposal, 'custom_excluded'), null);
});

test('internal added work uses its own saved brief and review without manufacturing customer fees or launch acceptance', () => {
  const proposal = change(accepted(true), { action: 'addInternalOrder', name: 'Internal report', brief: 'Read the internal roster; draft a summary for Emily; no messages.' });
  const order = proposal.orders.at(-1), brief = buildAutomationBrief(proposal, order.key);
  assert.match(brief.text, /Read the internal roster; draft a summary for Emily; no messages/);
  assert.match(brief.text, /internal plan authorization/);
  assert.match(brief.text, /separate internal-use review/);
  assert.doesNotMatch(brief.text, /Saved usage policy|customer contract|accepted quote/);
});

test('missing saved inputs remain explicit without inventing connected providers, owners or setup', () => {
  const proposal = accepted();
  proposal.draft.systems = [];
  proposal.setup.answers = ['', 'Use a scoped source', ''];
  proposal.draft.services.email.config.mailboxes = '';
  const brief = buildAutomationBrief(proposal, 'email');
  assert.ok(brief.missingInputs.includes('Mailboxes and volume'));
  assert.ok(brief.missingInputs.includes('Success criteria'));
  assert.ok(brief.missingInputs.includes('Access & guardrails'));
  assert.ok(brief.missingInputs.includes('Provider/account inventory and responsible people'));
  assert.match(brief.text, /No system inventory recorded/);
  assert.match(brief.text, /Not recorded — confirm before use/);
  assert.match(brief.text, /ecosystem name does not prove a connection/);
  assert.match(brief.text, /Resolve conflicting or missing instructions/);
});

test('saved email connection context retains chosen harness and guide snapshot, with stale setup surfaced for review', () => {
  let proposal = accepted();
  proposal = change(proposal, { action: 'emailPlaybook', key: 'email', emailUpdate: { kind: 'configure', config: { ...emailDefaults(proposal.draft), provider: 'microsoft', mailboxType: 'shared', mailboxes: 'Fixture mailbox', harness: 'Existing selected runner', owner: 'Emily', reviewer: 'Taylor', rules: 'Preserve human drafts' } } });
  const before = structuredClone(proposal), brief = buildAutomationBrief(proposal, 'email');
  for (const value of [emailGuideVersion, 'microsoft', 'shared', 'Fixture mailbox', 'Existing selected runner', 'Taylor', 'Preserve human drafts']) assert.ok(brief.text.includes(value), value);
  assert.deepEqual(proposal, before);
  proposal.orders.find(order => order.key === 'email').emailRun.setupRevision = 0;
  assert.ok(buildAutomationBrief(proposal, 'email').missingInputs.includes('Email configuration against the current setup revision'));
  proposal.orders.find(order => order.key === 'email').emailRun.config.harness = '';
  assert.ok(buildAutomationBrief(proposal, 'email').missingInputs.includes('Build tool / connection'));
});

test('Retell phone guide is source-aware, tests phone-only transfer and never assumes booked or live outcomes', () => {
  const proposal = accepted();
  const unconfirmed = buildAutomationBrief(proposal, 'calls');
  assert.ok(unconfirmed.missingInputs.includes('Confirm the phone provider/account before applying the Retell reference'));
  assert.match(unconfirmed.text,/not established as this customer’s provider/);
  proposal.draft.systems.push({purpose:'Phone reception',provider:'Retell AI',status:'To be created',owner:'Fixture phone owner',notes:'No connected number yet'});
  const before=structuredClone(proposal), brief=buildAutomationBrief(proposal,'calls');
  assert.ok(!brief.missingInputs.some(input=>input.includes('Retell reference')));
  for (const expected of ['does not prove access or a connected number','after-hours reception pilot is a starting proposal','If booking is included in the accepted order','web call cannot prove phone-transfer behavior','transfer started from transfer bridged','unresolved placeholder','live routing unchanged until launch is separately authorized','https://docs.retellai.com/build/dynamic-variables']) assert.ok(brief.text.includes(expected),expected);
  assert.deepEqual(proposal,before);
  assert.ok(!buildAutomationBrief(proposal,'email').sections.some(section=>section.id==='phone-guide'));
  proposal.draft.systems.at(-1).provider='Other provider; not Retell';
  assert.ok(buildAutomationBrief(proposal,'calls').missingInputs.some(input=>input.includes('Retell reference')));
});
