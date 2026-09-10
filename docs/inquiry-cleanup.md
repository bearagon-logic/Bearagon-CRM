# Inquiry cleanup

September 9, 2026. Adds Mark as test / spam in the inbox and work queue. Confirmation requires a classification and reason; inquiry status becomes closed with a standardized resolution prefix. Existing closed/open queue semantics are retained without a schema migration. The Test / spam view exposes these records, and ordinary inquiry status editing can reopen them.

Optional company archival is conservative: only active external prospects in new/contacted/lost/nurture qualify, with exactly this inquiry, no shared contacts and no engagement, workspace, proposal, service, automation blueprint/installation or decision. Conditions execute in the same D1 batch as inquiry closure and audit. A rejected company archive still closes the inquiry and reports that the company was retained. Archived companies are excluded from the active directory and selectors. Contacts, feed receipts and request keys are never deleted or reset, so replay does not recreate this inquiry. Company archive restoration is not yet exposed in the UI; records remain recoverable administratively.

The authenticated endpoint uses an optimistic inquiry timestamp and preserves the existing summary, next action, owner and follow-up. Audit records retain who classified it and why. This is soft cleanup, not deletion, contact marketing suppression, provider-side spam blocking, or a bulk cleanup tool. No existing live records were classified automatically.

Validation: TypeScript, production build and 68 tests passed, including actual SQLite archive safeguards against client/internal/qualified/shared-contact/other-inquiry/engagement and stale-record cases. No browser interaction QA performed.
