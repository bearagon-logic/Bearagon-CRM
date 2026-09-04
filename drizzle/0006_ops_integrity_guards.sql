DROP INDEX `uq_automation_installations_runner_external`;--> statement-breakpoint
DROP INDEX `uq_automation_installations_console_id`;--> statement-breakpoint
CREATE INDEX `idx_automation_installations_blueprint` ON `automation_installations` (`blueprint_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_automation_installations_runner_external` ON `automation_installations` (`account_id`,`runner_key`,`external_workflow_id`) WHERE "automation_installations"."external_workflow_id" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_automation_installations_console_id` ON `automation_installations` (`account_id`,`console_automation_id`) WHERE "automation_installations"."console_automation_id" is not null;--> statement-breakpoint
ALTER TABLE `decision_requests` ADD `request_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `decision_requests` ADD `decision_nonce` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_decision_requests_installation` ON `decision_requests` (`installation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_decision_requests_request_key` ON `decision_requests` (`request_key`) WHERE "decision_requests"."request_key" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_decision_requests_pending_installation_type` ON `decision_requests` (`installation_id`,`type`) WHERE "decision_requests"."status" = 'pending' and "decision_requests"."installation_id" is not null;--> statement-breakpoint
CREATE TRIGGER `trg_installation_workspace_account_insert`
BEFORE INSERT ON `automation_installations`
WHEN NEW.`workspace_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `workspaces`
  WHERE `id` = NEW.`workspace_id` AND `account_id` = NEW.`account_id`
)
BEGIN
  SELECT RAISE(ABORT, 'installation workspace must belong to its account');
END;--> statement-breakpoint
CREATE TRIGGER `trg_installation_workspace_account_update`
BEFORE UPDATE OF `workspace_id`, `account_id` ON `automation_installations`
WHEN NEW.`workspace_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `workspaces`
  WHERE `id` = NEW.`workspace_id` AND `account_id` = NEW.`account_id`
)
BEGIN
  SELECT RAISE(ABORT, 'installation workspace must belong to its account');
END;--> statement-breakpoint
CREATE TRIGGER `trg_installation_blueprint_account_insert`
BEFORE INSERT ON `automation_installations`
WHEN NOT EXISTS (
  SELECT 1 FROM `automation_blueprints`
  WHERE `id` = NEW.`blueprint_id`
    AND (`account_id` = NEW.`account_id` OR (`scope` = 'library' AND `account_id` IS NULL))
)
BEGIN
  SELECT RAISE(ABORT, 'installation blueprint must belong to its account or the library');
END;--> statement-breakpoint
CREATE TRIGGER `trg_installation_blueprint_account_update`
BEFORE UPDATE OF `blueprint_id`, `account_id` ON `automation_installations`
WHEN NOT EXISTS (
  SELECT 1 FROM `automation_blueprints`
  WHERE `id` = NEW.`blueprint_id`
    AND (`account_id` = NEW.`account_id` OR (`scope` = 'library' AND `account_id` IS NULL))
)
BEGIN
  SELECT RAISE(ABORT, 'installation blueprint must belong to its account or the library');
END;--> statement-breakpoint
CREATE TRIGGER `trg_decision_installation_account_insert`
BEFORE INSERT ON `decision_requests`
WHEN NEW.`installation_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `automation_installations`
  WHERE `id` = NEW.`installation_id` AND `account_id` = NEW.`account_id`
)
BEGIN
  SELECT RAISE(ABORT, 'decision installation must belong to its account');
END;--> statement-breakpoint
CREATE TRIGGER `trg_decision_installation_account_update`
BEFORE UPDATE OF `installation_id`, `account_id` ON `decision_requests`
WHEN NEW.`installation_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `automation_installations`
  WHERE `id` = NEW.`installation_id` AND `account_id` = NEW.`account_id`
)
BEGIN
  SELECT RAISE(ABORT, 'decision installation must belong to its account');
END;--> statement-breakpoint
CREATE TRIGGER `trg_workspace_account_parent_update`
BEFORE UPDATE OF `account_id` ON `workspaces`
WHEN EXISTS (
  SELECT 1 FROM `automation_installations`
  WHERE `workspace_id` = OLD.`id` AND `account_id` <> NEW.`account_id`
)
BEGIN
  SELECT RAISE(ABORT, 'workspace account cannot invalidate an installation');
END;--> statement-breakpoint
CREATE TRIGGER `trg_blueprint_owner_parent_update`
BEFORE UPDATE OF `account_id`, `scope` ON `automation_blueprints`
WHEN EXISTS (
  SELECT 1 FROM `automation_installations`
  WHERE `blueprint_id` = OLD.`id`
    AND NOT (
      (NEW.`account_id` IS NOT NULL AND `account_id` = NEW.`account_id`)
      OR (NEW.`scope` = 'library' AND NEW.`account_id` IS NULL)
    )
)
BEGIN
  SELECT RAISE(ABORT, 'blueprint ownership cannot invalidate an installation');
END;--> statement-breakpoint
CREATE TRIGGER `trg_installation_account_parent_update`
BEFORE UPDATE OF `account_id` ON `automation_installations`
WHEN EXISTS (
  SELECT 1 FROM `decision_requests`
  WHERE `installation_id` = OLD.`id` AND `account_id` <> NEW.`account_id`
)
BEGIN
  SELECT RAISE(ABORT, 'installation account cannot invalidate a decision');
END;--> statement-breakpoint
CREATE TRIGGER `trg_account_contacts_boolean_insert`
BEFORE INSERT ON `account_contacts`
WHEN NEW.`is_primary` NOT IN (0, 1)
BEGIN
  SELECT RAISE(ABORT, 'is_primary must be boolean');
END;--> statement-breakpoint
CREATE TRIGGER `trg_account_contacts_boolean_update`
BEFORE UPDATE OF `is_primary` ON `account_contacts`
WHEN NEW.`is_primary` NOT IN (0, 1)
BEGIN
  SELECT RAISE(ABORT, 'is_primary must be boolean');
END;--> statement-breakpoint
CREATE TRIGGER `trg_blueprints_boolean_insert`
BEFORE INSERT ON `automation_blueprints`
WHEN NEW.`approval_required` NOT IN (0, 1)
BEGIN
  SELECT RAISE(ABORT, 'approval_required must be boolean');
END;--> statement-breakpoint
CREATE TRIGGER `trg_blueprints_boolean_update`
BEFORE UPDATE OF `approval_required` ON `automation_blueprints`
WHEN NEW.`approval_required` NOT IN (0, 1)
BEGIN
  SELECT RAISE(ABORT, 'approval_required must be boolean');
END;--> statement-breakpoint
PRAGMA optimize;
