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

## Correction — a recorded blocker survives the gate

The gate above withheld every field until the operator chose **Record progress instead**, and that
button forced `status` to `in_progress`. For a requirement that was already **Blocked** with unmet
prerequisites this was destructive: the recorded blocker reason was shown nowhere (the checklist row
printed `Waiting on: …` in its place, and the gate screen printed nothing), the reason field renders
only for `blocked`, and the save payload clears `blockedReason` for any other status. Opening a
blocked requirement, clicking the only available button and saving therefore erased the audited
reason without ever displaying it.

- The gate no longer downgrades a status that is already recorded. `editableStatus` advances only
  `pending` to `in_progress`; `blocked`, `completed`, `skipped` and `in_progress` are preserved. The
  button reads **Record progress instead** only when that is what it does, and **Update this
  requirement** otherwise.
- A blocked requirement shows its recorded reason on the gate screen, before anything is mutated.
- `requirementRowDetail` prints the blocker alongside anything still outstanding, so the checklist
  row no longer hides one behind the other.
- Choosing a status that discards a recorded blocker now says so, quoting the reason, before saving.

The payload rule is unchanged: a non-blocked status still clears `blockedReason`, but reaching that
now requires an explicit status choice made against a visible warning. The labelled **Save as in
progress** escape hatch after a failed save still clears it as before.

TypeScript, the production build and all 88 tests passed (four new: status preservation, gate
readability, the discard warning and row detail). No schema, access, approval-gate or API change; no
live business records were edited; browser interaction QA was not performed.
