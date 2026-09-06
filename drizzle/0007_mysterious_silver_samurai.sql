ALTER TABLE `onboarding_tasks` ADD `evidence_ref` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `onboarding_tasks` ADD `completion_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `onboarding_tasks` ADD `blocked_reason` text DEFAULT '' NOT NULL;