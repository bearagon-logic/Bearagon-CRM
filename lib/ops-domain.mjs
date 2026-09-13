export const ACCOUNT_RELATIONSHIP_TYPES = Object.freeze([
  "prospect",
  "client",
  "partner",
  "vendor",
  "other",
]);

export const ONBOARDING_STAGES = Object.freeze([
  "intake",
  "connections",
  "building",
  "testing",
  "live",
]);

export const SAFETY_LEVELS = Object.freeze([
  "automatic",
  "supervised",
  "restricted",
]);

export const DELIVERY_STAGES = Object.freeze([
  "draft",
  "building",
  "testing",
  "awaiting_approval",
  "deployed",
  "retired",
]);

export const DESIRED_STATES = Object.freeze(["paused", "active", "retired"]);

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function slugify(value) {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  return slug || "workspace";
}

export function normalizeEnum(value, allowed, fallback) {
  const normalized = String(value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return allowed.includes(normalized) ? normalized : null;
}

export function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email) return "";
  return /^\S+@\S+\.\S+$/.test(email) ? email : null;
}

export function normalizeAccountInput(input) {
  const companyName = String(input.companyName ?? input.name ?? "")
    .trim()
    .slice(0, 160);
  const contactName = String(input.contactName ?? "").trim().slice(0, 160);
  const email = normalizeEmail(input.email);
  const phone = String(input.phone ?? "").trim().slice(0, 80);
  const relationshipType = normalizeEnum(
    input.relationshipType,
    ACCOUNT_RELATIONSHIP_TYPES,
    "prospect",
  );
  const stage = normalizeEnum(input.stage, ONBOARDING_STAGES, "intake");
  const targetDate = String(input.dueDate ?? input.targetDate ?? "")
    .trim()
    .slice(0, 32);
  const startOnboarding = input.startOnboarding === true;
  const website=typeof input.website === "string" ? input.website.trim() : "";
  const notes=typeof input.notes === "string" ? input.notes.trim() : "";
  if(website.length>1000||notes.length>5000)return {error:"Keep the website within 1,000 characters and notes within 5,000 characters."};

  if (!companyName || !contactName || email === "") {
    return { error: "Company, primary contact, and email are required." };
  }
  if (email === null) return { error: "Enter a valid email address." };
  if (!relationshipType) return { error: "Invalid relationship type." };
  if (!stage) return { error: "Invalid onboarding stage." };

  return {
    value: {
      companyName,
      website,
      notes,
      contactName,
      email,
      phone,
      relationshipType,
      stage,
      targetDate,
      startOnboarding,
    },
  };
}

export function normalizeAutomationInput(input) {
  const accountId = String(input.accountId ?? input.clientId ?? "").trim();
  const name = String(input.name ?? "").trim().slice(0, 120);
  const objective = String(input.objective ?? input.description ?? "")
    .trim()
    .slice(0, 800);
  const triggerSummary = String(input.triggerSummary ?? input.trigger ?? "")
    .trim()
    .slice(0, 300);
  const actionSummary = String(input.actionSummary ?? input.action ?? "")
    .trim()
    .slice(0, 300);
  const safetyLevel = normalizeEnum(
    input.safetyLevel,
    SAFETY_LEVELS,
    "supervised",
  );
  const runnerKey = String(input.runnerKey ?? input.harness ?? "unassigned")
    .trim()
    .toLowerCase()
    .slice(0, 80) || "unassigned";
  const externalWorkflowId = String(input.externalWorkflowId ?? "")
    .trim()
    .slice(0, 200);
  const configVersion = String(input.configVersion ?? "").trim().slice(0, 120);
  const owner = String(input.owner ?? "").trim().slice(0, 160);
  const acceptanceCriteria = String(input.acceptanceCriteria ?? "")
    .trim()
    .slice(0, 1200);

  if (!accountId || !name || !triggerSummary || !actionSummary) {
    return {
      error: "Account, automation name, trigger, and action are required.",
    };
  }
  if (!safetyLevel) return { error: "Invalid safety level." };

  return {
    value: {
      accountId,
      name,
      objective,
      triggerSummary,
      actionSummary,
      safetyLevel,
      approvalRequired: input.approvalRequired !== false,
      runnerKey,
      externalWorkflowId,
      configVersion,
      owner,
      acceptanceCriteria,
    },
  };
}

export function activationBlocker(installation) {
  if (!installation.workspaceId) return "Provision a platform workspace first.";
  if (installation.workspaceLifecycle !== "active") {
    return "The platform workspace must be active before activation can be requested.";
  }
  if (
    !installation.runnerKey ||
    installation.runnerKey === "unassigned" ||
    !installation.externalWorkflowId ||
    !installation.configVersion
  ) {
    return "Link a harness workflow and configuration version first.";
  }
  if (installation.blueprintLifecycle !== "ready") {
    return "Mark the automation blueprint ready after its delivery review.";
  }
  if (installation.deliveryStage !== "deployed") {
    return "Complete harness deployment before requesting activation.";
  }
  return null;
}

export function displayLabel(value) {
  return String(value ?? "")
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}
