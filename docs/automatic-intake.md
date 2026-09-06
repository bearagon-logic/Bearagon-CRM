# Automatic intake: website and Retell

## Operator flow

- Website contact forms save a durable event before queuing the existing Formspree notification. Capture works independently of an open Ops session.
- Inbox opens and synchronizes automatically, then refreshes every minute while visible. **Sync now** imports another page immediately. A page contains up to 50 events.
- A complete, unambiguous new company/contact becomes a prospect inquiry. Exact email + company matches can link to the existing external account without modifying contact details. Ambiguous, missing-company, or phone-only submissions enter **Needs identity review**.
- **Review & link** opens the existing inquiry form prefilled with source data. Choose a company or supply missing details, then save. **Dismiss** requires an audit note.
- Importing never starts onboarding, accepts a quote, grants access, or subscribes a contact to marketing.

## Runtime boundary

Website Worker `cold-sunset-0857` owns a separate D1 database `bearagon-intake` and a durable outbox. This is not the Console database or the CRM database. Ops privately pulls selected, bounded fields from `https://bearagon.com/api/intake/feed`. The machine credential is feed-read-only and independent of operator authentication. No public route or access-policy change was added to Ops.

Website routes:

- `POST /api/intake/website`: same-origin form capture, per-IP limiter, honeypot, bounded body, stable event ID.
- `POST /api/intake/retell`: raw-body HMAC verification, five-minute freshness check, selected-agent allowlist, inbound phone calls with `call_analyzed` only. Call ID deduplicates retries. Audio and full transcripts are not copied.
- `GET /api/intake/feed?after=N`: dedicated bearer credential, monotonic sequence, bounded response, receipt/notification health.

The CRM keeps independent durable receipts and a cursor. A two-minute lease prevents simultaneous automatic import runs. A deterministic inquiry key prevents repeated events creating duplicate inquiries. Failures after receipt creation leave a reviewable record rather than dropping an event. Existing manual intake remains available.

## Formspree

The existing destination is unchanged. A five-minute Worker schedule retries failed notifications, up to five attempts. Records awaiting or failing email delivery are counted in Inbox. Formspree acceptance is not proof of inbox delivery. A network failure after provider acceptance can cause a repeated notification on retry; inquiry identity remains stable. When attempts are exhausted, staff can still see the original inquiry in Ops. Notification replay controls and retention policy are future improvements.

## Retell activation (not completed without credentials)

Selected agent: **Bearagon Assessment BOoking Agent**.

1. Add the Retell API key bearing the webhook badge to the website Worker's Cloudflare secret **RETELL_WEBHOOK_KEY**. Never put it in source, public JavaScript, chat, or the CRM database.
2. Set **RETELL_AGENT_IDS** to this exact agent ID, not its display name or a client agent's ID.
3. In Retell, set this agent's webhook URL to `https://bearagon.com/api/intake/retell`, subscribing to `call_analyzed`. Inspect any existing webhook first: replacing it could interrupt another integration. Retell agent-level webhooks override the account-level webhook.
4. Configure post-call analysis fields `company_name`, `contact_name` (or `caller_name`), and `email` if desired. Missing fields safely go to review; summaries are captured without requiring these fields.
5. Verify with an explicitly approved test call. Do not initiate calls or replace existing webhooks automatically.

References: [Retell verification](https://docs.retellai.com/features/secure-webhook), [Retell events](https://docs.retellai.com/features/webhook-overview), [Formspree AJAX](https://help.formspree.io/articles/building-your-form/submit-forms-with-javascript-ajax).

## Verification

- Website `node --test tests/intake.test.mjs`: SQLite-backed persistence/dedup, failed-notification preservation, private feed authentication, rate limits, payload bounds, raw-body signature and agent isolation.
- CRM `node --test tests/*.test.mjs`: migrations, matching, deterministic import identity, existing service/domain constraints.
- CRM `node scripts/verify-intake-review-local.mjs`: local-only review/import/reload with no public submission or email.
- Production feed can be checked read-only. A test submission that triggers a real Formspree email requires explicit approval.

## Operational limits

CRM synchronization is session-driven, not a closed-browser background job. Source capture and email retries run independently. Review UI currently shows the first 100 unresolved receipts. No automatic deletion/retention schedule is enabled; choose a retention policy before large-scale campaigns or call traffic. Retell is fail-closed until both the verification key and agent IDs are configured. Source health reports configuration and actual last receipt separately; an idle feed is not proof of a healthy upstream agent.
