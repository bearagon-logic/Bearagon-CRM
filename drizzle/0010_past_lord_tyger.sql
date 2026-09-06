CREATE TABLE `intake_feed_state` (
	`id` text PRIMARY KEY NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`lease_token` text DEFAULT '' NOT NULL,
	`last_synced_at` text DEFAULT '' NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`health` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `intake_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence` integer NOT NULL,
	`source` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'review' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`inquiry_id` text,
	`received_at` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`inquiry_id`) REFERENCES `inquiries`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "intake_receipt_status" CHECK("intake_receipts"."status" in ('review','imported','dismissed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intake_receipts_sequence_unique` ON `intake_receipts` (`sequence`);--> statement-breakpoint
CREATE INDEX `idx_intake_receipts_status` ON `intake_receipts` (`status`);
--> statement-breakpoint
PRAGMA optimize;
