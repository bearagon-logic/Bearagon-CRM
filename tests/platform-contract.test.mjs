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
