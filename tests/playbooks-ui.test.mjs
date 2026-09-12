import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({
  appType: 'custom',
  configFile: false,
  root,
  cacheDir: path.join(root, '.vite-test-cache', 'playbooks-ui'),
  resolve: { alias: { '@': root } },
  server: { middlewareMode: true, hmr: { port: 24681 } },
});

after(async () => {
  await vite.close();
});

const { EmailWalkthrough } = await vite.ssrLoadModule('/components/email-walkthrough.tsx');
const { emailSteps, emailGuideVersion } = await vite.ssrLoadModule('/lib/email-playbook.ts');
const { newProposal } = await vite.ssrLoadModule('/lib/proposal-model.ts');
const { default: Playbooks } = await vite.ssrLoadModule('/app/playbooks/page.tsx');
const { serviceCatalog, guideRevision } = await vite.ssrLoadModule('/lib/service-catalog');

const config = {
  provider: 'google',
  mailboxType: 'individual',
  mailboxes: 'test@example.com',
  harness: 'Codex',
  owner: 'Brendan',
  reviewer: 'Emily',
  mode: 'draft',
  rules: 'Draft responses only.',
};

function createTestRun() {
  return {
    version: emailGuideVersion,
    config: { ...config },
    steps: emailSteps(config),
    progress: {},
    setupRevision: 1,
  };
}

function createTestProposal(run) {
  const p = newProposal('Acme Corp', false);
  p.acceptance = { reference: 'Approved agreement' };
  p.orders = [{ key: 'email', name: 'Email assistance', emailRun: run }];
  return p;
}

test('email walkthrough renders structured stepper rail with distinct step badges and metadata', () => {
  const run = createTestRun();
  run.progress[run.steps[0].id] = { status: 'completed', notes: 'Done', evidence: 'Ref 1' };
  run.progress[run.steps[1].id] = { status: 'blocked', notes: 'Blocked', blocker: 'Need admin permissions' };
  const proposal = createTestProposal(run);

  const html = renderToStaticMarkup(
    React.createElement(EmailWalkthrough, {
      accountId: 'test-account',
      initialData: { proposal },
      initialStep: run.steps[2].id,
    })
  );

  // Stepper rail items exist with proper structure
  assert.ok(html.includes('walkthrough-rail-btn'));
  assert.ok(html.includes('rail-btn-icon'));
  assert.ok(html.includes('rail-btn-title'));
  assert.ok(html.includes('rail-btn-sub'));

  // Active step has aria-current="step" and active styling
  assert.ok(html.includes('aria-current="step"'));

  // Completed step has checkmark indicator and completed styling
  assert.ok(html.includes('is-completed'));

  // Blocked step has alert indicator and blocked styling
  assert.ok(html.includes('is-blocked'));

  // Rail metadata displays assigned owner and steward information
  assert.ok(html.includes('Owner: Brendan'));
  assert.ok(html.includes('Guide steward: Bearagon delivery team'));
});

test('email walkthrough enforces distinct primary and secondary action button hierarchy', () => {
  const run = createTestRun();
  const proposal = createTestProposal(run);

  // 1. Configuration view: primary "Save & open walkthrough", secondary "Save configuration"
  const configHtml = renderToStaticMarkup(
    React.createElement(EmailWalkthrough, {
      accountId: 'test-account',
      initialData: { proposal },
      initialStep: 'configuration',
    })
  );
  assert.ok(configHtml.includes('walkthrough-btn-primary'));
  assert.ok(configHtml.includes('Save &amp; open walkthrough'));
  assert.ok(configHtml.includes('walkthrough-btn-secondary'));
  assert.ok(configHtml.includes('Save configuration'));

  // 2. Step view: primary "Complete step & continue", secondary "Save progress"
  const stepHtml = renderToStaticMarkup(
    React.createElement(EmailWalkthrough, {
      accountId: 'test-account',
      initialData: { proposal },
      initialStep: run.steps[0].id,
    })
  );
  assert.ok(stepHtml.includes('walkthrough-btn-primary'));
  assert.ok(stepHtml.includes('Complete step &amp; continue'));
  assert.ok(stepHtml.includes('walkthrough-btn-secondary'));
  assert.ok(stepHtml.includes('Save progress'));
});

test('playbooks page renders featured guided card and all catalog services with tier badges', () => {
  const html = renderToStaticMarkup(React.createElement(Playbooks));

  // Featured hero section
  assert.ok(html.includes('playbooks-hero'));
  assert.ok(html.includes('FEATURED GUIDED PLAYBOOK · CODEX READY'));
  assert.ok(html.includes('Guided Email assistance setup'));
  assert.ok(html.includes('Choose a company to start setup'));
  assert.ok(html.includes(`Guide revision ${guideRevision}`));

  // All service catalog items rendered
  for (const service of serviceCatalog) {
    const escapedName = service.name.replace(/&/g, '&amp;');
    assert.ok(html.includes(escapedName), `Expected catalog to contain ${service.name}`);
  }

  // Tier badges exist for base and add-on services
  assert.ok(html.includes('BASE CAPABILITY'));
  assert.ok(html.includes('OPTIONAL ADD-ON'));
  assert.ok(html.includes('tier-base'));
  assert.ok(html.includes('tier-addon'));
});
