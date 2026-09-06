# Bearagon Ops: intake and relationship foundation

This is an internal operating system with CRM capabilities. Console remains the source of observed runtime state; Ops owns relationships, service intent, and delivery work.

## Available now

1. **Inbox → Record inquiry:** record a website message, call, email, referral, or other inquiry. Choose an existing company or create a prospect. At least an email or callback number is required. Source describes the original channel, not an automatic integration.
2. **Triage:** keep an owner, next action, follow-up date, and status on each inquiry. Open and overdue filters support the daily queue. Closing requires a resolution. The original message is retained.
3. **Open account → Overview → Relationship:** manage the company-level relationship owner, sales stage, and next action separately from inquiry-level follow-ups and delivery tasks. Inquiry history stays with the account.
4. **Win the relationship:** selecting Won changes the relationship to client. It does not assert quote acceptance, create ordered services, start onboarding, deploy automations, or enroll marketing. Use the existing Onboarding plan and Services & automations flows explicitly.
5. **Marketing preference:** unknown by default. Subscribed requires recorded permission evidence; unsubscribed is a suppression preference. This is contact-level data shared across linked accounts, not a company-level setting. Only the primary contact is editable in this first slice. No campaign sending exists yet.
6. **Accounts → Bearagon → Set up internal profile:** idempotently creates the internal organization, separate from external directory counts and sales filters. Existing exact-name Bearagon records require review instead of silent reclassification. The same automation/installations and Console mapping capabilities remain available. Internal delivery must not convert Bearagon into a client. Commercial service ordering is still client-oriented; internal package deployment is a later slice.

Existing relationships start with the default sales stage; delivery state is not interpreted as evidence that a sale was won. Review the relationship stage on existing accounts.

## Integrity and verification

- Operator authentication remains mandatory for all new endpoints. No public webhook or new sharing access was added.
- Account/contact/link/inquiry/audit writes are one D1 batch; a failed save leaves no partial record.
- Stable request keys make retrying the same submission idempotent.
- Exact company-name and normalized-email matches request explicit account selection. Existing contact details and marketing preferences are preserved, never overwritten by intake.
- Phone-only entries are supported but are not automatically merged on phone numbers; shared business numbers are not reliable personal identity. Fuzzy company matching and phone-based suggestions remain future work.
- Inquiry and relationship changes are audit events. No third-party call-answering, delivery, or marketing behavior is fabricated.
- Migration 0009 is additive and tested against populated pre-migration data. Existing contacts, links, constraints, and triggers survive.
- `node scripts/verify-intake-local.mjs` runs a local-only API exercise: persist/reload, retry, matching, contact reuse, marketing evidence, resolution, client conversion, and internal-profile restrictions. It leaves clearly named QA data only in local D1.

## Next slices (not implemented in this release)

1. **Automatic intake adapters:** inspect the actual website form and Retell integration, establish separate machine authentication, verify signatures, rate-limit, deduplicate source event IDs, and route ambiguous matches to operator review. Keep original source evidence and surface feed health. Do not expose operator session tokens to senders. Current intake is manual only.
2. **Contacts and outreach:** multi-contact editing, explicit preference history/concurrency protection, list segmentation, suppression enforcement, and an email-provider adapter with preview/approval and delivery logging. Inquiry capture is not opt-in.
3. **Guided discovery and accepted service scope:** conditional employee-led questionnaire, proposed selections, quote acceptance, and repeatable delivery engagements. Keep purchased scope distinct from what is installed and what is currently reporting.
4. **Versioned package library:** required inputs/connections, instructions, deployable prompts/workflows, acceptance tests, and recovery instructions. Internal Bearagon installations use the same package model without customer revenue.
5. **One runner integration:** approved deploy/test/pause operations through a selected external harness, with Console reporting runtime observations. A constrained trigger/condition/action interface can follow; avoid building a general-purpose execution engine first.
