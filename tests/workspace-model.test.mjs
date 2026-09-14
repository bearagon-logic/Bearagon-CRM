import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root,
  cacheDir: path.join(root, ".vite-test-cache", "workspace"),
  resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const { workspaceDestination, isOngoing, queueItems } = await vite.ssrLoadModule("/lib/workspace-model.ts");

test("workspace routes distinguish the directory, delivery, and ongoing service", () => {
  assert.equal(workspaceDestination("/clients/account"), "/companies");
  for (const tab of ["onboarding", "delivery"]) assert.equal(workspaceDestination("/clients/account", tab, true), "/onboarding");
  for (const tab of ["services", "automations"]) {
    assert.equal(workspaceDestination("/clients/account", tab, true), "/operations");
    assert.equal(workspaceDestination("/clients/account", tab, false), "/companies");
  }
  assert.equal(workspaceDestination("/onboarding/account"), "/onboarding");
  assert.equal(workspaceDestination("/accounts/onboarding"), "/onboarding");
  assert.equal(workspaceDestination("/automations"), "/operations");
  assert.equal(workspaceDestination("/communications"), "/");
  assert.equal(workspaceDestination("/approvals"), "/");
  assert.equal(workspaceDestination("/security"), "/security");
  assert.equal(workspaceDestination("/cipher"), "/cipher");
});

test("ongoing service requires completed onboarding as well as Live", () => {
  assert.equal(isOngoing({ stage: "Live", onboardingStatus: "completed" }), true);
  assert.equal(isOngoing({ stage: "Live", onboardingStatus: "active" }), false);
  assert.equal(isOngoing({ stage: "Live", onboardingStatus: "cancelled" }), false);
  assert.equal(isOngoing({ stage: "Testing", onboardingStatus: "completed" }), false);
});

test("work queue excludes closed work and keeps exact record links and priorities", () => {
  const inquiries = [
    { id: "new & one", companyName: "Alpha", status: "new", owner: "Emily", nextAction: "Call", followUpDate: "2026-09-10" },
    { id: "closed", companyName: "Closed", status: "closed", followUpDate: "" },
    { id: "late", companyName: "Late", status: "working", owner: "", nextAction: "", followUpDate: "2026-09-07" },
  ];
  const deliveries = [
    { id: "new & one", accountId: "a/b", accountName: "Beta", status: "active", blocked: 1, targetDate: "", owner: "Derek", nextStep: "Connect email" },
    { id: "done", accountId: "x", accountName: "Done", status: "completed", blocked: 0, targetDate: "" },
  ];
  const decisions = [{ id: "review & 1", clientName: "Gamma", status: "Pending", title: "Review scope" }, { id: "approved", status: "Approved" }];
  const rows = queueItems(inquiries, deliveries, decisions, "2026-09-08");
  assert.equal(rows.length, 4);
  assert.equal(new Set(rows.map(row => row.id)).size, 4);
  assert.equal(rows[0].id, "inquiry:late");
  assert.equal(rows[0].owner, "Unassigned");
  assert.equal(rows[1].kind, "Blocked delivery");
  assert.equal(rows[1].href, "/onboarding/a%2Fb?tab=delivery");
  assert.equal(rows.find(row => row.kind === "Approval").href, "/approvals?request=review%20%26%201");
  assert.equal(rows.find(row => row.id === "inquiry:new & one").href, "/communications?inquiry=new%20%26%20one");
  assert.deepEqual(queueItems([], [], [], "2026-09-08"), []);
});

test("service guidance contains the approved base and add-on catalog", async () => {
  const { serviceCatalog, guideRevision } = await vite.ssrLoadModule("/lib/service-catalog.ts");
  assert.equal(serviceCatalog.length, 10);
  assert.equal(serviceCatalog.filter(service => service.tier === "base").length, 5);
  assert.equal(new Set(serviceCatalog.map(service => service.id)).size, 10);
  assert.ok(guideRevision);
  for (const service of serviceCatalog) assert.ok(service.guidance && service.summary && service.fields.length);
});

test("named ownership preserves saved legacy assignments without silently reassigning", async () => {
  const { OwnerSelect } = await vite.ssrLoadModule("/components/owner-select.tsx");
  const html = renderToStaticMarkup(React.createElement(OwnerSelect, { value: "Previous owner", onChange() {} }));
  for (const name of ["Brendan", "Emily", "Derek", "Unassigned"]) assert.ok(html.includes(name));
  assert.match(html, /selected="">Previous owner \(existing assignment\)/);
});

test("navigation retains the original artwork and reference resources", async () => {
  const shell = await readFile(path.join(root, "components/app-shell.tsx"), "utf8");
  assert.ok(shell.includes('/cipher-bearagon.png'));
  for (const route of ["/companies", "/onboarding", "/operations", "/playbooks", "/security", "/cipher", "/connections"]) assert.ok(shell.includes(`"${route}"`));
  const security = await readFile(path.join(root, "app/security/page.tsx"), "utf8");
  assert.ok(security.includes("Security reference"));
});

test('qualified inquiries appear as leads while keeping their original follow-up destination',()=>{
 const [row]=queueItems([{id:'lead-one',companyName:'Lead',status:'qualified',owner:'Emily',nextAction:'Call tomorrow',followUpDate:''}],[],[],'2026-09-13');
 assert.equal(row.kind,'Lead');assert.equal(row.title,'Call tomorrow');assert.equal(row.href,'/communications?inquiry=lead-one');
});
