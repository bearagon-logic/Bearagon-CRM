DROP INDEX `uq_automation_installations_runner_external`;--> statement-breakpoint
DROP INDEX `uq_automation_installations_console_id`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_automation_installations_runner_external` ON `automation_installations` (`workspace_id`,`runner_key`,`external_workflow_id`) WHERE "automation_installations"."external_workflow_id" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_automation_installations_console_id` ON `automation_installations` (`workspace_id`,`console_automation_id`) WHERE "automation_installations"."console_automation_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_workspaces_account` ON `workspaces` (`account_id`);--> statement-breakpoint
PRAGMA optimize;
