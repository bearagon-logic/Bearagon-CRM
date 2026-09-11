# Service setup review corrections

Implemented September 11, 2026 after the owner accepted the Design Partner's three recommendations.

## Delivery next action

`lib/delivery-readiness.ts` derives the next action from saved requirements, accepted setup and current work-order evidence. The Onboarding API, Onboarding cards, Work queue and company Delivery summary use it. Manually entered next-step text remains a separately labeled coordination note; no stored notes are rewritten.

Existing delivery plans without accepted package history keep their requirements and final-review path, including when an exploratory package draft exists. Their Delivery page no longer starts with the new-package prerequisite. New packages without an existing checklist still require recorded acceptance. Final review remains explicit; missing, blocked or stale work is not presented as ready. This is presentation and navigation work, with no API mutation-rule or schema changes.

## Walkthrough drafts and resume

The email walkthrough opens the first unfinished saved step, with incomplete configuration taking precedence. Completed and read-only guides open a progress review. The entry link names the next step; saved instructions and configuration remain accessible in the step rail.

Configuration and step drafts are retained in component memory while navigating prerequisites. Unsaved markers and the departure warning cover all drafts. Saving clears only the saved draft; failed requests and conflict refreshes keep the others. Navigation cannot dismiss the stale-version save gate. Drafts outside a changed provider route remain readable until explicitly discarded. No browser storage or automatic saves are introduced, and drafts do not survive leaving/reloading the page.

## Validation

- TypeScript and the established production build passed.
- All 108 automated tests passed, including six new regression cases covering legacy/blocked/new-package readiness, current work evidence, resume destinations and rendering, and independent draft preservation.
- Local development root returned HTTP 200. The authenticated development Onboarding API returned computed readiness for existing local fixtures.
- No live record mutations, provider operations or browser interaction testing were performed. Publication is recorded separately in the handbook; a successful build is not deployment evidence.

No dependencies, permissions, schema, accepted scope, launch approval rules, or runtime execution controls were changed.
