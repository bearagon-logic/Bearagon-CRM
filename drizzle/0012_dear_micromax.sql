ALTER TABLE `decision_requests` ADD `requester_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `decision_requests` ADD `requester_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `decision_requests` ADD `reviewer_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `decision_requests` ADD `removal_kind` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pending_company_removal` ON `decision_requests` (`account_id`) WHERE "decision_requests"."type" = 'Company removal' and "decision_requests"."status" = 'pending';