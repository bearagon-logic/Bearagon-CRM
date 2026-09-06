import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  stage: text("stage").notNull().default("Intake"),
  nextStep: text("next_step").notNull().default("Complete discovery form"),
  dueDate: text("due_date").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: text("due_date").notNull().default(""),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workflows = sqliteTable("workflows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  trigger: text("trigger").notNull(),
  action: text("action").notNull(),
  safetyLevel: text("safety_level").notNull().default("Automatic"),
  approvalRequired: integer("approval_required", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
  lastRunStatus: text("last_run_status").notNull().default("Never run"),
  lastRunAt: text("last_run_at").notNull().default(""),
  failureCount: integer("failure_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const approvals = sqliteTable("approvals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  riskLevel: text("risk_level").notNull().default("Supervised"),
  status: text("status").notNull().default("Pending"),
  requestedBy: text("requested_by").notNull().default("Cipher"),
  decidedBy: text("decided_by").notNull().default(""),
  decidedAt: text("decided_at").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const auditEvents = sqliteTable("audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  approvalId: integer("approval_id").references(() => approvals.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  result: text("result").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Canonical Bearagon Ops domain. The tables above are retained temporarily so
// an existing prototype deployment can be rolled back without a destructive
// migration. New product work should use the tables below.

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    relationshipType: text("relationship_type").notNull().default("prospect"),
    status: text("status").notNull().default("active"),
    website: text("website").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_accounts_status_relationship").on(
      table.status,
      table.relationshipType,
    ),
    index("idx_accounts_name").on(table.name),
    check(
      "accounts_relationship_type_check",
      sql`${table.relationshipType} in ('prospect', 'client', 'partner', 'vendor', 'other')`,
    ),
    check(
      "accounts_status_check",
      sql`${table.status} in ('active', 'inactive', 'archived')`,
    ),
  ],
);

export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    givenName: text("given_name").notNull().default(""),
    familyName: text("family_name").notNull().default(""),
    jobTitle: text("job_title").notNull().default(""),
    email: text("email").notNull().default(""),
    emailNormalized: text("email_normalized"),
    phone: text("phone").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_contacts_display_name").on(table.displayName),
    uniqueIndex("uq_contacts_email_normalized")
      .on(table.emailNormalized)
      .where(sql`${table.emailNormalized} is not null`),
  ],
);

export const accountContacts = sqliteTable(
  "account_contacts",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    relationshipRole: text("relationship_role")
      .notNull()
      .default("stakeholder"),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.contactId] }),
    index("idx_account_contacts_contact").on(table.contactId),
    uniqueIndex("uq_account_contacts_primary")
      .on(table.accountId)
      .where(sql`${table.isPrimary} = 1`),
    check(
      "account_contacts_role_check",
      sql`${table.relationshipRole} in ('decision_maker', 'technical', 'billing', 'stakeholder', 'other')`,
    ),
  ],
);

export const engagements = sqliteTable(
  "engagements",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("onboarding"),
    status: text("status").notNull().default("active"),
    stage: text("stage").notNull().default("intake"),
    nextStep: text("next_step")
      .notNull()
      .default("Complete discovery form"),
    targetDate: text("target_date").notNull().default(""),
    owner: text("owner").notNull().default(""),
    notes: text("notes").notNull().default(""),
    startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_engagements_account_status").on(table.accountId, table.status),
    index("idx_engagements_stage").on(table.stage),
    uniqueIndex("uq_engagements_active_onboarding")
      .on(table.accountId)
      .where(
        sql`${table.kind} = 'onboarding' and ${table.status} in ('planned', 'active', 'blocked')`,
      ),
    check(
      "engagements_kind_check",
      sql`${table.kind} in ('discovery', 'onboarding', 'managed_service', 'renewal', 'offboarding')`,
    ),
    check(
      "engagements_status_check",
      sql`${table.status} in ('planned', 'active', 'blocked', 'completed', 'cancelled')`,
    ),
    check(
      "engagements_stage_check",
      sql`${table.stage} in ('intake', 'connections', 'building', 'testing', 'live')`,
    ),
  ],
);

export const onboardingTasks = sqliteTable(
  "onboarding_tasks",
  {
    id: text("id").primaryKey(),
    engagementId: text("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    templateKey: text("template_key").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("pending"),
    evidenceRef: text("evidence_ref").notNull().default(""),
    completionNote: text("completion_note").notNull().default(""),
    blockedReason: text("blocked_reason").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    dueDate: text("due_date").notNull().default(""),
    completedAt: text("completed_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("uq_onboarding_tasks_template").on(
      table.engagementId,
      table.templateKey,
    ),
    index("idx_onboarding_tasks_engagement_status").on(
      table.engagementId,
      table.status,
    ),
    check(
      "onboarding_tasks_status_check",
      sql`${table.status} in ('pending', 'in_progress', 'blocked', 'completed', 'skipped')`,
    ),
  ],
);

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    lifecycle: text("lifecycle").notNull().default("requested"),
    consoleClientId: text("console_client_id"),
    provisionedAt: text("provisioned_at").notNull().default(""),
    lastSyncedAt: text("last_synced_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("uq_workspaces_account").on(table.accountId),
    uniqueIndex("uq_workspaces_slug").on(table.slug),
    uniqueIndex("uq_workspaces_console_client")
      .on(table.consoleClientId)
      .where(sql`${table.consoleClientId} is not null`),
    index("idx_workspaces_account").on(table.accountId),
    check(
      "workspaces_lifecycle_check",
      sql`${table.lifecycle} in ('requested', 'provisioning', 'active', 'suspended', 'retired')`,
    ),
  ],
);

export const automationBlueprints = sqliteTable(
  "automation_blueprints",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    scope: text("scope").notNull().default("bespoke"),
    key: text("key").notNull(),
    name: text("name").notNull(),
    objective: text("objective").notNull().default(""),
    triggerSummary: text("trigger_summary").notNull(),
    actionSummary: text("action_summary").notNull(),
    safetyLevel: text("safety_level").notNull().default("supervised"),
    approvalRequired: integer("approval_required", { mode: "boolean" })
      .notNull()
      .default(true),
    defaultRunner: text("default_runner").notNull().default("unassigned"),
    acceptanceCriteria: text("acceptance_criteria").notNull().default(""),
    lifecycle: text("lifecycle").notNull().default("draft"),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("uq_automation_blueprints_key").on(table.key),
    index("idx_automation_blueprints_account").on(table.accountId),
    check(
      "automation_blueprints_scope_check",
      sql`${table.scope} in ('library', 'bespoke')`,
    ),
    check(
      "automation_blueprints_safety_check",
      sql`${table.safetyLevel} in ('automatic', 'supervised', 'restricted')`,
    ),
    check(
      "automation_blueprints_lifecycle_check",
      sql`${table.lifecycle} in ('draft', 'ready', 'deprecated')`,
    ),
  ],
);

export const automationInstallations = sqliteTable(
  "automation_installations",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    blueprintId: text("blueprint_id")
      .notNull()
      .references(() => automationBlueprints.id, { onDelete: "restrict" }),
    blueprintRevision: integer("blueprint_revision").notNull().default(1),
    deliveryStage: text("delivery_stage").notNull().default("draft"),
    runnerKey: text("runner_key").notNull().default("unassigned"),
    externalWorkflowId: text("external_workflow_id").notNull().default(""),
    consoleAutomationId: text("console_automation_id"),
    configVersion: text("config_version").notNull().default(""),
    desiredState: text("desired_state").notNull().default("paused"),
    observedState: text("observed_state").notNull().default("unregistered"),
    lastObservedAt: text("last_observed_at").notNull().default(""),
    lastRunAt: text("last_run_at").notNull().default(""),
    lastRunStatus: text("last_run_status").notNull().default("No telemetry yet"),
    lastError: text("last_error").notNull().default(""),
    failureCount: integer("failure_count").notNull().default(0),
    owner: text("owner").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("uq_automation_installations_account_blueprint").on(
      table.accountId,
      table.blueprintId,
    ),
    uniqueIndex("uq_automation_installations_runner_external")
      .on(table.accountId, table.runnerKey, table.externalWorkflowId)
      .where(sql`${table.externalWorkflowId} <> ''`),
    uniqueIndex("uq_automation_installations_console_id")
      .on(table.accountId, table.consoleAutomationId)
      .where(sql`${table.consoleAutomationId} is not null`),
    index("idx_automation_installations_workspace").on(table.workspaceId),
    index("idx_automation_installations_blueprint").on(table.blueprintId),
    index("idx_automation_installations_states").on(
      table.desiredState,
      table.observedState,
    ),
    check(
      "automation_installations_delivery_stage_check",
      sql`${table.deliveryStage} in ('draft', 'building', 'testing', 'awaiting_approval', 'deployed', 'retired')`,
    ),
    check(
      "automation_installations_desired_state_check",
      sql`${table.desiredState} in ('paused', 'active', 'retired')`,
    ),
    check(
      "automation_installations_observed_state_check",
      sql`${table.observedState} in ('unregistered', 'provisioning', 'paused', 'active', 'degraded', 'error', 'retired')`,
    ),
  ],
);

export const decisionRequests = sqliteTable(
  "decision_requests",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    installationId: text("installation_id").references(
      () => automationInstallations.id,
      { onDelete: "set null" },
    ),
    type: text("type").notNull(),
    requestKey: text("request_key").notNull().default(""),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    riskLevel: text("risk_level").notNull().default("supervised"),
    status: text("status").notNull().default("pending"),
    requestedBy: text("requested_by").notNull().default("Cipher"),
    decidedBy: text("decided_by").notNull().default(""),
    decidedAt: text("decided_at").notNull().default(""),
    decisionNonce: text("decision_nonce").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_decision_requests_account_status").on(
      table.accountId,
      table.status,
    ),
    index("idx_decision_requests_installation").on(table.installationId),
    uniqueIndex("uq_decision_requests_request_key")
      .on(table.requestKey)
      .where(sql`${table.requestKey} <> ''`),
    uniqueIndex("uq_decision_requests_pending_installation_type")
      .on(table.installationId, table.type)
      .where(
        sql`${table.status} = 'pending' and ${table.installationId} is not null`,
      ),
    check(
      "decision_requests_status_check",
      sql`${table.status} in ('pending', 'approved', 'rejected', 'cancelled')`,
    ),
    check(
      "decision_requests_risk_check",
      sql`${table.riskLevel} in ('automatic', 'supervised', 'restricted')`,
    ),
  ],
);

export const accountServices = sqliteTable("account_services", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("proposed"),
  quoteRef: text("quote_ref").notNull().default(""),
  acceptedAt: text("accepted_at").notNull().default(""),
  setupFeeCents: integer("setup_fee_cents"),
  monthlyFeeCents: integer("monthly_fee_cents"),
  currency: text("currency").notNull().default("USD"),
  scope: text("scope").notNull().default(""),
  maintenance: text("maintenance").notNull().default(""),
  configuration: text("configuration").notNull().default(""),
  startDate: text("start_date").notNull().default(""),
  endDate: text("end_date").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_account_services_account").on(table.accountId),
  check("account_services_status", sql`${table.status} in ('proposed','ordered','active','ended')`),
  check("account_services_fees", sql`(${table.setupFeeCents} is null or ${table.setupFeeCents} >= 0) and (${table.monthlyFeeCents} is null or ${table.monthlyFeeCents} >= 0)`),
]);

export const serviceInstallations = sqliteTable("service_installations", {
  serviceId: text("service_id").notNull().references(() => accountServices.id, { onDelete: "cascade" }),
  installationId: text("installation_id").notNull().references(() => automationInstallations.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.serviceId, table.installationId] })]);

export const operatorAuditEvents = sqliteTable(
  "operator_audit_events",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    action: text("action").notNull(),
    actorId: text("actor_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    actorName: text("actor_name").notNull(),
    result: text("result").notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_operator_audit_account_created").on(
      table.accountId,
      table.createdAt,
    ),
    index("idx_operator_audit_resource").on(
      table.resourceType,
      table.resourceId,
    ),
  ],
);
