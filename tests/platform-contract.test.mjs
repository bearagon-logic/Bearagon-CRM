import assert from "node:assert/strict";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  cacheDir: path.join(root, ".vite-test-cache", "contracts"),
  server: { middlewareMode: true, hmr: { port: 24681 } },
});

after(async () => {
  await vite.close();
});

const contracts = await vite.ssrLoadModule("/lib/contracts/platform.ts");
const { serviceInput } = await vite.ssrLoadModule("/lib/service-input.ts");
const { serviceObservation } = await vite.ssrLoadModule("/lib/service-observation.ts");
const { inquiryCreateInput, inquiryUpdateInput, relationshipInput } = await vite.ssrLoadModule("/lib/inquiry-input.ts");
const { automaticMatch, eventRequestKey } = await vite.ssrLoadModule("/lib/intake-feed.ts");
test("intake identity matching never guesses a company from shared phone or conflicting email",async()=>{
  const e={companyName:"One",contactName:"A Person",email:"one@example.com"};
  assert.equal(automaticMatch(e,[],[]).reason,"");
  assert.ok(automaticMatch({...e,email:""},[],[]).reason);
  assert.ok(automaticMatch(e,[{id:"one"}],[]).reason);
  const linked={id:"one",name:"One",organizationKind:"external",status:"active"};
  assert.equal(automaticMatch(e,[{id:"one"}],[linked]).accountId,"one");
  assert.ok(automaticMatch(e,[{id:"one"}],[{...linked,name:"Other"}]).reason);
  assert.ok(automaticMatch(e,[{id:"one"}],[{...linked,organizationKind:"internal"}]).reason);
  assert.ok(automaticMatch(e,[{id:"one"}],[linked,{...linked,id:"two"}]).reason);
  assert.equal(await eventRequestKey("website:one"),await eventRequestKey("website:one"));
  assert.notEqual(await eventRequestKey("website:one"),await eventRequestKey("retell:one"));
});

test("inquiries require contactability, source and valid follow-up without accepting status injection", () => {
  const inquiry = { requestKey: "00000000-0000-4000-8000-000000000001", companyName: "One", contactName: "Person", email: " PERSON@EXAMPLE.COM ", source: "website", summary: "Needs help", status: "qualified" };
  const parsed = inquiryCreateInput.parse(inquiry);
  assert.equal(parsed.email, "person@example.com");
  assert.equal(parsed.status, undefined);
  assert.equal(inquiryCreateInput.safeParse({ ...inquiry, email: "" }).success, false);
  assert.equal(inquiryCreateInput.safeParse({ ...inquiry, email: "", phone: "+1 555 0100" }).success, true);
  assert.equal(inquiryCreateInput.safeParse({ ...inquiry, companyName: "" }).success, false);
  assert.equal(inquiryCreateInput.safeParse({ ...inquiry, followUpDate: "2026-02-30" }).success, false);
  assert.equal(inquiryCreateInput.safeParse({ ...inquiry, source: "cipher" }).success, false);
});

test("closing inquiries requires a resolution; subscriptions require evidence", () => {
  const update = { id: "one", status: "closed", owner: "", nextAction: "", followUpDate: "", resolution: "" };
  assert.equal(inquiryUpdateInput.safeParse(update).success, false);
  assert.equal(inquiryUpdateInput.safeParse({ ...update, resolution: "Duplicate request; linked to current delivery." }).success, true);
  const relationship = { relationshipOwner: "", salesStage: "won", relationshipNextAction: "", followUpDate: "", marketingStatus: "unknown", marketingEvidence: "" };
  assert.equal(relationshipInput.safeParse(relationship).success, true);
  assert.equal(relationshipInput.safeParse({ ...relationship, marketingStatus: "subscribed" }).success, false);
  assert.equal(relationshipInput.safeParse({ ...relationship, marketingStatus: "subscribed", marketingEvidence: "Requested newsletter on form, 2026-09-06" }).success, true);
});

test("purchased services require evidence of acceptance and valid fees and dates", () => {
  const service = { name: "Lead follow-up", status: "proposed", quoteRef: "", acceptedAt: "", setupFeeCents: null, monthlyFeeCents: null, currency: "USD", scope: "", maintenance: "", configuration: "", startDate: "", endDate: "", installationIds: [] };
  assert.equal(serviceInput.safeParse(service).success, true);
  assert.equal(serviceInput.safeParse({ ...service, status: "ordered" }).success, false);
  const ordered = { ...service, status: "ordered", quoteRef: "Q-104", acceptedAt: "2026-09-06", scope: "Follow up on incoming leads", monthlyFeeCents: 0 };
  assert.equal(serviceInput.safeParse(ordered).success, true);
  assert.equal(serviceInput.safeParse({ ...ordered, monthlyFeeCents: -1 }).success, false);
  assert.equal(serviceInput.safeParse({ ...ordered, acceptedAt: "2026-02-30" }).success, false);
  assert.equal(serviceInput.safeParse({ ...ordered, startDate: "2026-09-07", endDate: "2026-09-06" }).success, false);
  assert.equal(serviceInput.safeParse({ ...ordered, status: "active" }).success, false);
});

test("Console observations never infer matches from names or intent", () => {
  const installation = { consoleAutomationId: "lead", desiredState: "active" };
  const overview = { automations: [{ slug: "lead", title: "Lead", lifecycle: "paused", health: { state: "paused", label: "Paused" } }], runs: [{ id: "old", automation_slug: "lead", started_at: "2026-09-01T00:00:00Z" }, { id: "new", automation_slug: "lead", started_at: "2026-09-06T00:00:00Z" }] };
  assert.equal(serviceObservation(installation).label, "No Console data");
  assert.equal(serviceObservation({ ...installation, consoleAutomationId: null }, overview).label, "Not matched to Console");
  assert.equal(serviceObservation({ ...installation, consoleAutomationId: "missing" }, overview).label, "Missing from Console");
  assert.equal(serviceObservation(installation, overview).mismatch, true);
  assert.equal(serviceObservation(installation, overview).run.id, "new");
  assert.equal(serviceObservation({ ...installation, desiredState: "paused" }, overview).mismatch, false);
});

test("accepts the Console automation response contract", () => {
  const rows = contracts.validatedPlatformList(
    {
      automations: [
        {
          slug: "intake-router",
          title: "Intake router",
          lifecycle: "active",
          health: { state: "healthy", label: "Healthy" },
        },
      ],
    },
    "automations",
    contracts.platformAutomationSchema,
  );

  assert.equal(rows[0].health.state, "healthy");
});

test("accepts array and wrapped Console list payloads", () => {
  const run = {
    id: "run_1",
    automation_id: "automation_1",
    automation_slug: "intake-router",
    status: "succeeded",
    started_at: "2026-09-04T12:00:00.000Z",
    finished_at: "2026-09-04T12:00:05.000Z",
  };

  assert.equal(
    contracts.validatedPlatformList(
      [run],
      "runs",
      contracts.platformRunSchema,
    )[0].id,
    "run_1",
  );
  assert.equal(
    contracts.validatedPlatformList(
      { runs: [run] },
      "runs",
      contracts.platformRunSchema,
    )[0].automation_slug,
    "intake-router",
  );
});

test("rejects malformed Console status instead of inventing runtime truth", () => {
  assert.throws(
    () =>
      contracts.validatedPlatformList(
        {
          connectors: [
            {
              name: "gmail",
              label: "Gmail",
              lifecycle: "live",
              state: "definitely_working",
            },
          ],
        },
        "connectors",
        contracts.platformConnectorSchema,
      ),
    /platform_contract_invalid:connectors/,
  );
});
