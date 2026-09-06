CREATE TABLE `account_services` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`quote_ref` text DEFAULT '' NOT NULL,
	`accepted_at` text DEFAULT '' NOT NULL,
	`setup_fee_cents` integer,
	`monthly_fee_cents` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`scope` text DEFAULT '' NOT NULL,
	`maintenance` text DEFAULT '' NOT NULL,
	`configuration` text DEFAULT '' NOT NULL,
	`start_date` text DEFAULT '' NOT NULL,
	`end_date` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "account_services_status" CHECK("account_services"."status" in ('proposed','ordered','active','ended')),
	CONSTRAINT "account_services_fees" CHECK(("account_services"."setup_fee_cents" is null or "account_services"."setup_fee_cents" >= 0) and ("account_services"."monthly_fee_cents" is null or "account_services"."monthly_fee_cents" >= 0))
);
--> statement-breakpoint
CREATE INDEX `idx_account_services_account` ON `account_services` (`account_id`);--> statement-breakpoint
CREATE TABLE `service_installations` (
	`service_id` text NOT NULL,
	`installation_id` text NOT NULL,
	PRIMARY KEY(`service_id`, `installation_id`),
	FOREIGN KEY (`service_id`) REFERENCES `account_services`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`installation_id`) REFERENCES `automation_installations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TRIGGER service_installations_account_insert BEFORE INSERT ON service_installations
WHEN NOT EXISTS (SELECT 1 FROM account_services s JOIN automation_installations i ON i.account_id = s.account_id WHERE s.id = NEW.service_id AND i.id = NEW.installation_id)
BEGIN SELECT RAISE(ABORT, 'service and automation must belong to the same account'); END;
--> statement-breakpoint
CREATE TRIGGER service_installations_account_update BEFORE UPDATE ON service_installations
WHEN NOT EXISTS (SELECT 1 FROM account_services s JOIN automation_installations i ON i.account_id = s.account_id WHERE s.id = NEW.service_id AND i.id = NEW.installation_id)
BEGIN SELECT RAISE(ABORT, 'service and automation must belong to the same account'); END;
--> statement-breakpoint
CREATE TRIGGER service_account_transfer BEFORE UPDATE OF account_id ON account_services
WHEN EXISTS (SELECT 1 FROM service_installations l JOIN automation_installations i ON i.id = l.installation_id WHERE l.service_id = OLD.id AND i.account_id <> NEW.account_id)
BEGIN SELECT RAISE(ABORT, 'linked service cannot transfer accounts'); END;
--> statement-breakpoint
CREATE TRIGGER service_installation_account_transfer BEFORE UPDATE OF account_id ON automation_installations
WHEN EXISTS (SELECT 1 FROM service_installations l JOIN account_services s ON s.id = l.service_id WHERE l.installation_id = OLD.id AND s.account_id <> NEW.account_id)
BEGIN SELECT RAISE(ABORT, 'service automation cannot transfer accounts'); END;
--> statement-breakpoint
PRAGMA optimize;
