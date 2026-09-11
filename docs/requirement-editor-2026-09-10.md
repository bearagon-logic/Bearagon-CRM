# Delivery requirement editor correction

The completion API already enforced dependencies, but the editor exposed all fields before the operator knew a requirement could not be completed. Blocker reason was always shown.

## Behavior

- Refresh account requirements before opening an editor. If the refresh fails, do not invite data entry against unknown readiness.
- Use the same dependency template as the server. Show unfinished prerequisites and direct open buttons before showing inputs. Missing template requirements remain blocking rather than silently passing.
- Offer **Record progress instead**. This edits an in-progress record that the existing API permits saving without certifying completion. Completed is unavailable until prerequisites resolve; approved exceptions retain their existing semantics.
- Show Blocker reason only for Blocked. Labels distinguish progress, verification and approved-exception notes. Match input length limits to the API and validate required evidence before submitting.
- Preserve typed fields on failures. Offer retry or **Save as in progress**; never silently downgrade a completion attempt. Refresh readiness after a rejected save without overwriting the draft.
- Retain unsaved requirement drafts in component memory when switching to prerequisites. Rows identify these drafts; users must return and save them before leaving. Navigation/unload warnings remain. This is not persistent browser or server draft storage.
- Cancel and dialog dismissal use the same discard protection. Completed onboarding remains read-only. No approval gate, backend schema or live data was changed.

## Validation

TypeScript, production build and automated tests cover template parity, completion gating before fields render, missing prerequisites, progress/exception/evidence validation, conditional blocker fields, preserved rendered paragraph after errors, read-only review, and integration source contracts. No live business records were edited; browser interaction QA was not performed for this correction.
