import assert from "node:assert/strict";
import test from "node:test";

import {
  activationBlocker,
  normalizeAccountInput,
  normalizeAutomationInput,
  slugify,
} from "../lib/ops-domain.mjs";

test("normalizes an account without conflating it with a workspace", () => {
  const result = normalizeAccountInput({
    companyName: "  Acme Service Co  ",
    contactName: "  Avery Owner ",
    email: " AVERY@EXAMPLE.COM ",
    relationshipType: "Client",
    stage: "Connections",
  });

  assert.equal(result.error, undefined);
  assert.deepEqual(result.value, {
    companyName: "Acme Service Co",
    contactName: "Avery Owner",
    email: "avery@example.com",
    phone: "",
    relationshipType: "client",
    stage: "connections",
    targetDate: "",
    startOnboarding: false,
  });
  assert.equal("workspaceId" in result.value, false);
});

test("onboarding is an explicit account-creation choice", () => {
  const result = normalizeAccountInput({
    companyName: "Acme",
    contactName: "Avery",
    email: "avery@example.com",
    startOnboarding: true,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.value.startOnboarding, true);
});

test("rejects invalid contact and onboarding input", () => {
  assert.match(
    normalizeAccountInput({ companyName: "Acme" }).error,
    /contact.*email/i,
  );
  assert.match(
    normalizeAccountInput({
      companyName: "Acme",
      contactName: "Avery",
      email: "not-an-email",
    }).error,
    /valid email/i,
  );
  assert.match(
    normalizeAccountInput({
      companyName: "Acme",
      contactName: "Avery",
      email: "a@example.com",
      stage: "Paid",
    }).error,
    /stage/i,
  );
});

test("automation input is a blueprint plus a paused installation link", () => {
  const result = normalizeAutomationInput({
    accountId: "acct_123",
    name: "Urgent call routing",
    objective: "Get urgent calls to a human",
    trigger: "Verified urgent call",
    action: "Prepare callback task",
    safetyLevel: "Restricted",
    runnerKey: "N8N",
    externalWorkflowId: "workflow-42",
    configVersion: "1.0.0",
  });

  assert.equal(result.error, undefined);
  assert.equal(result.value.safetyLevel, "restricted");
  assert.equal(result.value.runnerKey, "n8n");
  assert.equal(result.value.approvalRequired, true);
  assert.equal("observedState" in result.value, false);
});

test("activation requires an active workspace and deployable harness state", () => {
  assert.match(
    activationBlocker({
      workspaceId: null,
      runnerKey: "n8n",
      externalWorkflowId: "one",
      configVersion: "1",
    }),
    /workspace/i,
  );
  assert.match(
    activationBlocker({
      workspaceId: "workspace_one",
      workspaceLifecycle: "active",
      runnerKey: "unassigned",
      externalWorkflowId: "",
      configVersion: "",
    }),
    /harness/i,
  );
  assert.match(
    activationBlocker({
      workspaceId: "workspace_one",
      workspaceLifecycle: "requested",
      runnerKey: "custom",
      externalWorkflowId: "one",
      configVersion: "1",
      blueprintLifecycle: "ready",
      deliveryStage: "deployed",
    }),
    /workspace.*active/i,
  );
  assert.match(
    activationBlocker({
      workspaceId: "workspace_one",
      workspaceLifecycle: "active",
      runnerKey: "custom",
      externalWorkflowId: "one",
      configVersion: "1",
      blueprintLifecycle: "draft",
      deliveryStage: "deployed",
    }),
    /blueprint ready/i,
  );
  assert.equal(
    activationBlocker({
      workspaceId: "workspace_one",
      workspaceLifecycle: "active",
      runnerKey: "custom",
      externalWorkflowId: "one",
      configVersion: "1",
      blueprintLifecycle: "ready",
      deliveryStage: "deployed",
    }),
    null,
  );
});

test("workspace slugs are stable and URL safe", () => {
  assert.equal(slugify("Crème & Sons, LLC"), "creme-sons-llc");
  assert.equal(slugify("***"), "workspace");
});
