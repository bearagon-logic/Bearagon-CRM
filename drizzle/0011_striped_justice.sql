CREATE TABLE `account_proposals` (
	`account_id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`mutation_id` text NOT NULL,
	`state` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "proposal_version" CHECK("account_proposals"."version" > 0),
	CONSTRAINT "proposal_json" CHECK(json_valid("account_proposals"."state"))
);
--> statement-breakpoint
CREATE TABLE `proposal_revisions` (
	`account_id` text NOT NULL,
	`version` integer NOT NULL,
	`state` text NOT NULL,
	`action` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`account_id`, `version`),
	FOREIGN KEY (`account_id`) REFERENCES `account_proposals`(`account_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "proposal_revision_json" CHECK(json_valid("proposal_revisions"."state"))
);
--> statement-breakpoint
CREATE TRIGGER proposal_history_no_update BEFORE UPDATE ON proposal_revisions BEGIN SELECT RAISE(ABORT, 'Proposal history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER proposal_history_no_delete BEFORE DELETE ON proposal_revisions BEGIN SELECT RAISE(ABORT, 'Proposal history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER accepted_scope_immutable BEFORE UPDATE ON account_proposals
WHEN json_type(OLD.state,'$.acceptance') = 'object' AND (
 json_extract(NEW.state,'$.draft') IS NOT json_extract(OLD.state,'$.draft') OR
 json_extract(NEW.state,'$.scopeRevision') IS NOT json_extract(OLD.state,'$.scopeRevision') OR
 json_extract(NEW.state,'$.acceptance') IS NOT json_extract(OLD.state,'$.acceptance') OR
 json_extract(NEW.state,'$.approval') IS NOT json_extract(OLD.state,'$.approval') OR
 json_extract(NEW.state,'$.engagementId') IS NOT json_extract(OLD.state,'$.engagementId'))
BEGIN SELECT RAISE(ABORT, 'Accepted scope is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER proposal_delivery_guard BEFORE UPDATE OF status,stage ON engagements
WHEN (NEW.status = 'completed' OR NEW.stage = 'live') AND EXISTS (
 SELECT 1 FROM account_proposals p WHERE p.account_id=NEW.account_id AND json_extract(p.state,'$.engagementId')=NEW.id
 AND (json_type(p.state,'$.acceptance') IS NOT 'object' OR EXISTS (
   SELECT 1 FROM json_each(p.state,'$.setup.answers') a WHERE trim(a.value)=''
 ) OR json_array_length(p.state,'$.setup.answers')<>3 OR json_array_length(p.state,'$.orders')=0 OR EXISTS (
   SELECT 1 FROM json_each(p.state,'$.orders') o WHERE json_extract(o.value,'$.status')<>'tested' OR
   json_extract(o.value,'$.setupRevision')<>json_extract(p.state,'$.setup.revision') OR trim(json_extract(o.value,'$.testRef'))=''
 )))
BEGIN SELECT RAISE(ABORT, 'Complete current guided setup and external work-order evidence before launch'); END;
--> statement-breakpoint
PRAGMA optimize;
--> statement-breakpoint
CREATE TRIGGER closed_proposal_delivery_immutable BEFORE UPDATE ON account_proposals
WHEN json_type(OLD.state,'$.acceptance')='object' AND EXISTS (
 SELECT 1 FROM engagements e WHERE e.id=json_extract(OLD.state,'$.engagementId') AND e.status IN ('completed','cancelled')
) AND (json_extract(NEW.state,'$.setup') IS NOT json_extract(OLD.state,'$.setup') OR json_extract(NEW.state,'$.orders') IS NOT json_extract(OLD.state,'$.orders'))
BEGIN SELECT RAISE(ABORT, 'Closed delivery history is read-only'); END;
--> statement-breakpoint
CREATE TRIGGER accepted_service_terms_immutable BEFORE UPDATE ON account_services
WHEN (NEW.name IS NOT OLD.name OR NEW.scope IS NOT OLD.scope OR NEW.configuration IS NOT OLD.configuration OR NEW.quote_ref IS NOT OLD.quote_ref OR NEW.accepted_at IS NOT OLD.accepted_at OR NEW.monthly_fee_cents IS NOT OLD.monthly_fee_cents OR NEW.setup_fee_cents IS NOT OLD.setup_fee_cents OR NEW.currency IS NOT OLD.currency OR NEW.account_id IS NOT OLD.account_id)
AND EXISTS (SELECT 1 FROM account_proposals p, json_each(p.state,'$.orders') o WHERE p.account_id=OLD.account_id AND json_extract(o.value,'$.serviceId')=OLD.id)
BEGIN SELECT RAISE(ABORT, 'Accepted package terms require an amendment'); END;
