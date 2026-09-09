# Implementation evidence editing

September 8, 2026. Requested correction to the Build & test → Implementation experience.

Every saved work order now exposes **Edit evidence** (with the module name in its accessible label). The dialog prefills the current status, build reference and test reference. Save changes uses the existing revision-checked proposal order command. No new service, work order or onboarding record is created.

Only changed fields make the editor dirty. Cancel, Escape and closing the dialog protect unsaved changes; failed saves keep the draft available. Pending saves prevent duplicate submission/dismissal. Fields have persistent accessible labels, and long evidence keeps line breaks and wraps in the module summary. The editor scrolls within the viewport.

The existing status semantics are preserved: To build clears current references; Built clears the current test reference; Tested requires both. The UI now disables fields that cannot be retained for the selected state and explains clearing before save. Earlier saved evidence remains in immutable proposal revision history. Completed/closed delivery remains read-only and now explains that restriction; this change does not introduce post-launch amendments or bypass launch controls.

Validation: deployment build, TypeScript, and all 56 automated tests passed, including three added regression checks for correction isolation/stale saves, persistence with retained prior snapshot, and rendered prefilled editor/error/pending states. Local preview returned HTTP 200. No live company records were edited, browser interaction QA was not performed, and publication is tracked separately in the handbook.
