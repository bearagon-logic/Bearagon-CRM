# Inquiry provenance and manual account creation

The Inbox now identifies exact aisprawlcleanup.com/www origins as **AI Sprawl Cleanup**, and bearagon.com/www as **Bearagon website**, while retaining the underlying website channel. Identity-review cards, imported inquiry cards, history and selected details use the same label. Follow-up search includes source labels and source addresses. The selected inquiry shows its source page as plain text.

Existing imported inquiries retrieve provenance from their retained intake receipt, so no backfill, record rewrite or database migration is needed. The authenticated inquiry query correlates the receipt to its inquiry ID; unlinked review receipts do not leak into another inquiry. Historical references that are missing or malformed retain the generic channel. Domain matching uses parsed HTTP(S) URLs and exact hostnames, not substring matching. This is reported form provenance, not an authentication assertion.

The reported manual account-creation error was reproduced locally using the actual POST handler and Drizzle D1 driver with a 100-bound-parameter ceiling. The previous eight-task onboarding insert produced 104 parameters and returned the screenshot's generic 500 error. Each task now uses its own insert within the existing atomic batch, in both new-account creation and starting onboarding on an existing account. Contacts, account links, engagement, checklist and audit still commit or roll back together. Existing contact details and marketing preferences remain intact.

Validation: 42 focused source/account/inquiry/migration tests passed, including seven new regression cases. Coverage includes exact-origin labels, historical provenance isolation, onboarding enabled/disabled, existing-contact reuse, rollback after a late task failure, and repeat-safe onboarding start. TypeScript, whitespace checks and the production build passed. No live inquiry, email or company record was created by the agent. The owner/Derek can retry the real entry after refreshing the deployed Ops application.

Platform limit reference: https://developers.cloudflare.com/d1/platform/limits/ (100 bound parameters per query).
