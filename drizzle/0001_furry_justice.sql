CREATE TABLE `workflows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`trigger` text NOT NULL,
	`action` text NOT NULL,
	`safety_level` text DEFAULT 'Automatic' NOT NULL,
	`approval_required` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`last_run_status` text DEFAULT 'Never run' NOT NULL,
	`last_run_at` text DEFAULT '' NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
