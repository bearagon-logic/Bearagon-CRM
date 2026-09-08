# Production scope, quote and guided setup

## Operator entry points

Company → Services → **Establish service package, pricing & quote** opens `/clients/:id/scope`. Delivery → **Open guided setup & service work orders** opens the same record at setup. Canonical `scope:` work-order tasks link back to that editor instead of exposing a competing checklist editor.

1. Select ecosystem and configure included catalog/custom services. Base services start selected; optional services start off. Existing legacy services are not silently imported or changed. Google/Microsoft may be scoped without inventing a system inventory row; actual users, systems and handoffs remain required during setup. Mixed/new ecosystems require explicit inventory at scope time.
2. Save incomplete drafts. Enter individually quoted USD fees (commas supported), optional reconciled monthly line allocations, pooled allowance, additional spend ceiling, eligible/excluded charges, attribution and continuity/recovery instructions.
3. Review the customer-style proposal. Internal allocation and provider recovery instructions remain outside that preview. Approval references the saved scope revision and the authenticated operator, not an editable roster selection. A changed draft clears approval; a no-op preserves it.
4. Record actual external client acceptance: client decision maker, real nonfuture date and evidence reference. No quote is sent and no signature or payment is collected here. Internal organizations use an explicitly labeled internal authorization path with no client fees/revenue requirement.
5. Acceptance atomically creates account service rows and one canonical onboarding task per included service, reusing an active engagement or starting its standard checklist. It never creates an automation installation or launches a harness. Closed prior engagements require a future amendment/new-engagement decision and are not silently reopened.
6. Save three guided setup answers, then record external build/test evidence per service. Changing setup requires impact confirmation when evidence exists and returns this package's work to To build; old evidence remains in immutable version history. Setup changes return the delivery stage to Intake for revalidation rather than leaving it apparently Live. Other legacy tasks and agreed scope are preserved.
7. Continue to existing delivery requirements and launch review. Current package evidence must pass in addition to the existing checklist. Finishing setup or entering a test reference does not prove execution or runtime health.

## Persistence and security

`account_proposals` stores one current package aggregate per company with a monotonically increasing compare-and-swap version. `proposal_revisions` stores an immutable snapshot per successful mutation. Scope revision is separate from the aggregate version (which also advances for approval, acceptance, setup and evidence). History can be read account-scoped through `?revision=N` and inspected in the UI.

Every API operation checks the existing operator allowlist. Requests are JSON-only, bounded to 120 KB, and reject a mismatched Origin. Reviewer/recorder identities come from server context. Prepared D1 statements run in an atomic batch. All dependent writes check the unique mutation marker of the successful version update; a stale writer cannot append history, create services/tasks, or change another operator's work. Failed dependent writes roll back the entire batch. No secrets are copied to forms or browser code.

The additive, schema-only `0011_striped_justice.sql` creates the two new tables, immutable-history/accepted-terms guards, closed-delivery protection and a database launch guard. Existing migrations, IDs, rows and integrations are unchanged. Accepted package services retain immutable commercial fields while installation mapping and operational status remain separate. Package-mode service rows have unallocated prices rather than fabricated per-service allocations; the accepted quote holds the authoritative package totals and usage terms.

## Verification

- Existing deployment build and TypeScript pass.
- 47 automated checks pass: existing domain/Console/UI tests plus proposal validation, real SQLite migration and transactional store tests.
- Local Worker API lifecycle passes: save, stale rejection, authenticated approval, external acceptance, duplicate prevention, saved setup, work-order evidence, invalidation, reload and historical evidence.
- Built Worker rejects unauthenticated GET/POST with 401 and rejects an unconfigured spoofed identity. No production credentials or real customer decisions were used.
- `0011` applied successfully to local D1. Non-browser HTTP check of the new page returns 200.
- Browser visual/interaction testing was not requested or performed. The API lifecycle is not a claim of browser acceptance testing.
- Clearly labeled QA fixtures exist only in local development data. No emails, phone calls, invoices, signatures or harness operations were sent/executed.

## Remaining work and rollback

This implements the first production quote → accepted scope → guided setup → external work-evidence flow. Repeat proposals/amendments, fine-grained evidence dependency graphs, automatic harness execution, billing, quote sending/export, customer signing and the celebratory completion screen remain separate work. Existing checklist requirements still apply; this does not claim the full prototype-to-production adoption is complete.

The prior production source is `a3c40ec494c9c9c18d1bfb15c93acd5d08ce92df` (Sites version 15). This migration is additive, with no backfill. Reverting application code does not remove accepted proposals or reverse migrations. The old UI lacks the new package editor, so restoring the forward-compatible editor is preferable after package use begins. Never delete proposal history to make rollback appear complete.

Implementation references: [Cloudflare D1 transactional batches](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch), the Sites persistence guidance, the approved concept's scope/quote helpers, and the canonical Bearagon handbook decisions D10–D15.
