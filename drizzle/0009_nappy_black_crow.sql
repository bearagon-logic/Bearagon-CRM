-- Additive changes preserve every existing account, contact, foreign key, and integrity trigger.
ALTER TABLE accounts ADD COLUMN organization_kind text NOT NULL DEFAULT 'external' CONSTRAINT accounts_organization_kind_check CHECK (organization_kind IN ('external', 'internal'));
--> statement-breakpoint
ALTER TABLE accounts ADD COLUMN relationship_owner text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE accounts ADD COLUMN sales_stage text NOT NULL DEFAULT 'new' CONSTRAINT accounts_sales_stage_check CHECK (sales_stage IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost', 'nurture'));
--> statement-breakpoint
ALTER TABLE accounts ADD COLUMN follow_up_date text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE accounts ADD COLUMN relationship_next_action text NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE UNIQUE INDEX uq_internal_organization ON accounts(organization_kind) WHERE organization_kind = 'internal';
--> statement-breakpoint
ALTER TABLE contacts ADD COLUMN marketing_status text NOT NULL DEFAULT 'unknown' CONSTRAINT contacts_marketing_status_check CHECK (marketing_status IN ('unknown', 'subscribed', 'unsubscribed'));
--> statement-breakpoint
ALTER TABLE contacts ADD COLUMN marketing_evidence text NOT NULL DEFAULT '' CONSTRAINT contacts_marketing_evidence_check CHECK (marketing_status != 'subscribed' OR length(trim(marketing_evidence)) > 0);
--> statement-breakpoint
CREATE TABLE inquiries (
  id text PRIMARY KEY NOT NULL,
  request_key text NOT NULL,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  contact_id text NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  source text NOT NULL CONSTRAINT inquiries_source_check CHECK(source IN ('website', 'phone', 'email', 'referral', 'other')),
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'new' CONSTRAINT inquiries_status_check CHECK(status IN ('new', 'working', 'qualified', 'closed')),
  owner text NOT NULL DEFAULT '',
  next_action text NOT NULL DEFAULT '',
  follow_up_date text NOT NULL DEFAULT '',
  resolution text NOT NULL DEFAULT '',
  recorded_by text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT inquiries_resolution_check CHECK(status != 'closed' OR length(trim(resolution)) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX inquiries_request_key_unique ON inquiries(request_key);
--> statement-breakpoint
CREATE INDEX idx_inquiries_account ON inquiries(account_id);
--> statement-breakpoint
CREATE INDEX idx_inquiries_status_followup ON inquiries(status, follow_up_date);
--> statement-breakpoint
PRAGMA optimize;
