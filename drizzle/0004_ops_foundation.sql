CREATE TABLE `account_contacts` (
	`account_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`relationship_role` text DEFAULT 'stakeholder' NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`account_id`, `contact_id`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "account_contacts_role_check" CHECK("account_contacts"."relationship_role" in ('decision_maker', 'technical', 'billing', 'stakeholder', 'other'))
);
--> statement-breakpoint
CREATE INDEX `idx_account_contacts_contact` ON `account_contacts` (`contact_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_account_contacts_primary` ON `account_contacts` (`account_id`) WHERE "account_contacts"."is_primary" = 1;--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`relationship_type` text DEFAULT 'prospect' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "accounts_relationship_type_check" CHECK("accounts"."relationship_type" in ('prospect', 'client', 'partner', 'vendor', 'other')),
	CONSTRAINT "accounts_status_check" CHECK("accounts"."status" in ('active', 'inactive', 'archived'))
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_status_relationship` ON `accounts` (`status`,`relationship_type`);--> statement-breakpoint
CREATE INDEX `idx_accounts_name` ON `accounts` (`name`);--> statement-breakpoint
CREATE TABLE `automation_blueprints` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text,
	`scope` text DEFAULT 'bespoke' NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`objective` text DEFAULT '' NOT NULL,
	`trigger_summary` text NOT NULL,
	`action_summary` text NOT NULL,
	`safety_level` text DEFAULT 'supervised' NOT NULL,
	`approval_required` integer DEFAULT true NOT NULL,
	`default_runner` text DEFAULT 'unassigned' NOT NULL,
	`acceptance_criteria` text DEFAULT '' NOT NULL,
	`lifecycle` text DEFAULT 'draft' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "automation_blueprints_scope_check" CHECK("automation_blueprints"."scope" in ('library', 'bespoke')),
	CONSTRAINT "automation_blueprints_safety_check" CHECK("automation_blueprints"."safety_level" in ('automatic', 'supervised', 'restricted')),
	CONSTRAINT "automation_blueprints_lifecycle_check" CHECK("automation_blueprints"."lifecycle" in ('draft', 'ready', 'deprecated'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_automation_blueprints_key` ON `automation_blueprints` (`key`);--> statement-breakpoint
CREATE INDEX `idx_automation_blueprints_account` ON `automation_blueprints` (`account_id`);--> statement-breakpoint
CREATE TABLE `automation_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`workspace_id` text,
	`blueprint_id` text NOT NULL,
	`blueprint_revision` integer DEFAULT 1 NOT NULL,
	`delivery_stage` text DEFAULT 'draft' NOT NULL,
	`runner_key` text DEFAULT 'unassigned' NOT NULL,
	`external_workflow_id` text DEFAULT '' NOT NULL,
	`console_automation_id` text,
	`config_version` text DEFAULT '' NOT NULL,
	`desired_state` text DEFAULT 'paused' NOT NULL,
	`observed_state` text DEFAULT 'unregistered' NOT NULL,
	`last_observed_at` text DEFAULT '' NOT NULL,
	`last_run_at` text DEFAULT '' NOT NULL,
	`last_run_status` text DEFAULT 'No telemetry yet' NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`blueprint_id`) REFERENCES `automation_blueprints`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "automation_installations_delivery_stage_check" CHECK("automation_installations"."delivery_stage" in ('draft', 'building', 'testing', 'awaiting_approval', 'deployed', 'retired')),
	CONSTRAINT "automation_installations_desired_state_check" CHECK("automation_installations"."desired_state" in ('paused', 'active', 'retired')),
	CONSTRAINT "automation_installations_observed_state_check" CHECK("automation_installations"."observed_state" in ('unregistered', 'provisioning', 'paused', 'active', 'degraded', 'error', 'retired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_automation_installations_account_blueprint` ON `automation_installations` (`account_id`,`blueprint_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_automation_installations_runner_external` ON `automation_installations` (`runner_key`,`external_workflow_id`) WHERE "automation_installations"."external_workflow_id" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_automation_installations_console_id` ON `automation_installations` (`console_automation_id`) WHERE "automation_installations"."console_automation_id" is not null;--> statement-breakpoint
CREATE INDEX `idx_automation_installations_workspace` ON `automation_installations` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_automation_installations_states` ON `automation_installations` (`desired_state`,`observed_state`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`given_name` text DEFAULT '' NOT NULL,
	`family_name` text DEFAULT '' NOT NULL,
	`job_title` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`email_normalized` text,
	`phone` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_contacts_display_name` ON `contacts` (`display_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_contacts_email_normalized` ON `contacts` (`email_normalized`) WHERE "contacts"."email_normalized" is not null;--> statement-breakpoint
CREATE TABLE `decision_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`installation_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`risk_level` text DEFAULT 'supervised' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` text DEFAULT 'Cipher' NOT NULL,
	`decided_by` text DEFAULT '' NOT NULL,
	`decided_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`installation_id`) REFERENCES `automation_installations`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "decision_requests_status_check" CHECK("decision_requests"."status" in ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "decision_requests_risk_check" CHECK("decision_requests"."risk_level" in ('automatic', 'supervised', 'restricted'))
);
--> statement-breakpoint
CREATE INDEX `idx_decision_requests_account_status` ON `decision_requests` (`account_id`,`status`);--> statement-breakpoint
CREATE TABLE `engagements` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`kind` text DEFAULT 'onboarding' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`stage` text DEFAULT 'intake' NOT NULL,
	`next_step` text DEFAULT 'Complete discovery form' NOT NULL,
	`target_date` text DEFAULT '' NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "engagements_kind_check" CHECK("engagements"."kind" in ('discovery', 'onboarding', 'managed_service', 'renewal', 'offboarding')),
	CONSTRAINT "engagements_status_check" CHECK("engagements"."status" in ('planned', 'active', 'blocked', 'completed', 'cancelled')),
	CONSTRAINT "engagements_stage_check" CHECK("engagements"."stage" in ('intake', 'connections', 'building', 'testing', 'live'))
);
--> statement-breakpoint
CREATE INDEX `idx_engagements_account_status` ON `engagements` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_engagements_stage` ON `engagements` (`stage`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_engagements_active_onboarding` ON `engagements` (`account_id`) WHERE "engagements"."kind" = 'onboarding' and "engagements"."status" in ('planned', 'active', 'blocked');--> statement-breakpoint
CREATE TABLE `onboarding_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`engagement_id` text NOT NULL,
	`template_key` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`engagement_id`) REFERENCES `engagements`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "onboarding_tasks_status_check" CHECK("onboarding_tasks"."status" in ('pending', 'in_progress', 'blocked', 'completed', 'skipped'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_onboarding_tasks_template` ON `onboarding_tasks` (`engagement_id`,`template_key`);--> statement-breakpoint
CREATE INDEX `idx_onboarding_tasks_engagement_status` ON `onboarding_tasks` (`engagement_id`,`status`);--> statement-breakpoint
CREATE TABLE `operator_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`actor_name` text NOT NULL,
	`result` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_operator_audit_account_created` ON `operator_audit_events` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_operator_audit_resource` ON `operator_audit_events` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`lifecycle` text DEFAULT 'requested' NOT NULL,
	`console_client_id` text,
	`provisioned_at` text DEFAULT '' NOT NULL,
	`last_synced_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "workspaces_lifecycle_check" CHECK("workspaces"."lifecycle" in ('requested', 'provisioning', 'active', 'suspended', 'retired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_workspaces_slug` ON `workspaces` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_workspaces_console_client` ON `workspaces` (`console_client_id`) WHERE "workspaces"."console_client_id" is not null;--> statement-breakpoint
CREATE INDEX `idx_workspaces_account` ON `workspaces` (`account_id`);--> statement-breakpoint
PRAGMA optimize;
