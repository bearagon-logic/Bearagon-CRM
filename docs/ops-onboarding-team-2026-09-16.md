# Ops onboarding team — implementation and review

Date: September 15–16, 2026. Branch: `codex/ops-onboarding-team`.

## Goal and acceptance

Make the internal journey from inquiry through scope, onboarding and automation delivery easier to navigate, understand and complete. The owner prioritized navigation, page layout and finding information; Gestal's desktop application is a visual reference for compact navigation and aligned working areas. Public app screenshots were inspected by the user-facing coordinator; this is not a full Gestal product audit or a claim of CRM feature parity.

Preserve company/profile separation, canonical records, saved and unsaved work, commercial amounts and acceptance, approval/evidence gates, and the distinction between Ops delivery intent, external execution and Console observations. Preserve the original logo and Light/Dark/Plaid appearances.

## Team and work board

The user-facing coordinator owns reusable role installation, handbook updates and Sites publication. This project's management agent owns the application integration, scopes and acceptance. Workers report to that manager.

| Role | Contribution | State |
| --- | --- | --- |
| UI | Audited ingestion → onboarding; identified handoff queue gap, indistinct stage destinations, generic build instructions and passive next actions | Complete |
| Backend | Saved-order brief generator and current evidence readiness | Implemented and reviewed |
| Graphic design | Scoped semantic CSS, hierarchy, spacing, icons and responsive handoff | Complete |
| Frontend | Directed journey navigation, scope/delivery lists, brief presentation, next actions and history recovery | Implemented, tested and browser checked within fixture limits |
| Reviewer | Independent backend and integrated workflow review | Complete; all actionable findings resolved on final source |
| Project manager | Scope continuity read model, Retell reference, synthetic fixtures, integration, regression checks and handoff | Integrated and handed to root for final build/publication |

Four total concurrent agents allowed two worker slots alongside root and manager. Roles ran in waves. The graphic-design worker was explicitly reassigned to frontend implementation after its design handoff when fresh-thread creation hit the session limit. The independent reviewer authored no application changes. The six reusable named role definitions are separate from this staged execution.

## Changes

### Scope remains discoverable after intake handoff

`GET /api/scoping` returns a separate authenticated, uncached read model. It selects active external prospect/client accounts with saved scope or an actual handoff audit, excludes lost/nurture and any prior onboarding engagement, and does not create or modify records. A qualified inquiry alone remains in lead follow-up rather than duplicating into scope work.

Saved revision and internal approval determine the suggested scope action. Any prior onboarding, including cancelled delivery, is excluded because repeat engagement/amendment acceptance is not implemented. Legacy/damaged accepted scope without its expected delivery record stays visible as an explicit repair task; it is never invited to accept again. Normal acceptance creates its engagement in a guarded transactional batch.

### Company-specific automation instructions

The read-only brief generator consumes the saved accepted/authorized proposal and its matching included order. It includes full selected/custom scope, shared setup, system/provider inventory, responsible people, permissions, ordered boundaries, synthetic tests, actual evidence and handoff. Missing values remain explicit. Saved email guide/configuration remains available. Copying a brief does not authorize or execute external actions, create a schedule, or establish Console runtime health.

### Readiness matches evidence requirements

Final handoff presentation now requires the current tested order to include both a build reference and test reference, consistent with server-side gates. Existing setup revision and completion requirements remain.

### Navigation and working layout

The five-stage map distinguishes current, available and later stages without implying that visiting a stage completes evidence. Setup and Build & test have stable focused destinations; Build requires saved setup and Operate requires saved completion. The primary delivery action opens the appropriate requirement, setup, work order or handoff review. Same-section focus retains drafts. Scope and accepted delivery occupy distinct compact searchable lists with separate source failures/retries. The Work queue incorporates scope work and reduces its complete supplied artwork to an 88px strip. Shared brief panels expose Inputs / Build / Verify, missing values, source revisions, clipboard feedback and manual-copy fallback; the email walkthrough remains.

### First phone reference: Retell

The owner selected phone with Retell as the first non-email service. Phone orders now include a bounded Retell reference: saved provider/account confirmation, accepted coverage, proposed missed/after-hours pilot, approved knowledge, conditional calendar booking, controlled phone transfer/no-answer tests, unresolved variables, recording choices and source event reporting. An exact saved Retell inventory entry distinguishes confirmed provider choice from the reference requiring confirmation; neither proves actual access. A web call cannot prove phone transfer, and transfer started is not transfer bridged. No provider settings, phone numbers, accounts, live routing or automations were changed.

Primary product references: [transfer](https://docs.retellai.com/build/single-multi-prompt/transfer-call), [functions](https://docs.retellai.com/build/single-multi-prompt/function-calling), [webhooks](https://docs.retellai.com/features/webhook-overview), [dynamic variables](https://docs.retellai.com/build/dynamic-variables). Root and independent reviewer verified the relevant documentation; this is procedural guidance, not a deployed integration.

### Drafts survive history navigation without stale writes

One shared navigation guard prompts once for cancelable Back/Forward traversal. Noncancelable or older-browser traversal retains account/editor-specific drafts in tab memory before teardown and restores them on return. Latest server records remain the authoritative saved view; original proposal versions and company/relationship baselines remain separate. Changed, accepted/closed or archived records block stale writes and expose exact recovered values for keyboard selection/copying. A stale evidence draft is kept outside the disabled evidence modal so it remains accessible.

Successful saves reconcile only the fields actually saved; explicit discard/reload and manual reversion clear the relevant snapshot, and failed saves retain it. Saving requirement B while requirement A remains unsaved preserves A and its original conflict baseline, removes the saved B edit, and preserves any newer edit made to B. Context, owner and coordination saves likewise reconcile only their field group. A late save cannot recreate an explicitly discarded snapshot. Returning during a pending save waits for that reconciliation. Request generations/unmount cancellation prevent duplicate initial GETs from consuming and then overwriting recovered work. No history entry rewriting, persistent local storage, server auto-save or permission bypass is introduced.

Coverage includes company context/coordination/requirement drafts, relationship fields, and proposal scope/setup/acceptance/evidence. Other independent editors are outside this new recovery coverage. The independent reviewer caught and drove corrections for acceptance-only dirtiness, repeated-recovery stale baseline, saved-versus-draft summary labeling, archive recovery, stale evidence access, inactive-child dirty indicators and partial-save preservation before publication.

## Questions

- Owner answered first priority: navigation, page layout and finding the right information.
- Owner supplied Gestal Raid app as a clean-interface reference; preserve Bearagon branding while adapting density and hierarchy.
- Owner answered first non-email service/provider: phone with Retell. The manager incorporated explicit provider-aware reference instructions; the actual customer scope remains authoritative.

## Automated and independent verification

- Backend brief/readiness focused suite: 12 passed at the initial backend handoff. The final brief file contains seven regressions including the later Retell addition; an existing six-step email fixture was corrected to the current three-step guide.
- Scope continuity: 15 synthetic in-memory SQLite regressions passed, using the actual migration chain and inquiry handoff function. Covers scope handoff, lead distinction, approval revision, accepted scope with missing delivery, archived/inactive/internal/lost/nurture/vendor exclusion, every existing onboarding status, and deduplication.
- Frontend: 31 targeted tests passed at the initial UI handoff. The final onboarding file contains five navigation/source/rendered-brief regressions.
- Final full suite including history refinement and partial-save correction: **217 tests passed**, run serially. Twelve focused history tests plus five onboarding tests also passed in the independent final source review. Nonfatal Vite dependency-scan warnings remain in existing test harnesses; no assertions failed.
- Final TypeScript check and whitespace diff check passed.
- Main slice production `npm run build` passed, including generated theme coverage and `/api/scoping`. The Windows process PATH needed the installed Git `usr/bin` and `bin`; repository build scripts were unchanged.
- Initial full run exposed two existing rendering-fixture gaps after earlier appearance work: Playbooks lacked pathname context and metadata lacked the `@` alias. Corrected those test harnesses; no application behavior changed for those fixes.
- Reviewer independently ran 44 earlier focused tests and checked the full code diff against baseline `87241d5`. The initial cancelled-delivery dead end and omitted visible phone-guide panel were corrected; regression coverage passes. Provider docs were checked independently. The final source recheck ran 12 history plus five onboarding tests (17/17 passed), confirmed partial-save reconciliation, and found no remaining actionable findings within the reviewed scope.
- Back/Forward protection is implemented and its event/cache regressions pass. Browser actual-traversal checks with the fixture-only confirmation response passed as recorded below. Independent source review is complete; the reviewer did not independently verify production routing, live saves or provider execution.

## Browser fixture and boundaries

Ignored `work/ops-team-preview.html`, `ops-team-review.jsx` and `ops-team-preview.config.mjs` render actual changed components/styles with fictional records and intercept every fetch. The standalone React/Vite preview uses explicit fixture-only Next navigation/link adapters. Views include pipeline, queue, scope, setup, build, phone, handoff and ongoing; `failSave`, `missing` and `long` options expose difficult states. Proposal mutations use the pure domain transition in memory. Browser results demonstrate interface behavior rather than production router/API integration or account isolation. No production records, messages, providers, schedules or automations are changed.

Initial standard-app fixture URLs conflicted with extensionless routing and did not render reliably. The isolated configuration on port 5175 resolved the fixture issue. Root verified:

- Desktop pipeline/search and Work queue Scope filtering; first actual queue row moved from about y500 in the prior live view to about y390 in the fixture, retaining the complete 88px banner.
- Next-action opening a blocked requirement and Build focusing its section; failed setup save retained typed fields and same-section Setup navigation retained drafts.
- Phone provider warning, visible Retell reference in expanded Build and a populated 8,743-character prompt with current accepted revision and provider guidance.
- Light/Dark desktop and Plaid desktop/narrow readability. A long phone-company name and panels wrapped at 390px; measured document/client widths were equal (no horizontal page overflow).
- Handoff with 8/8 requirements and current order evidence stayed disabled until the authorization checkbox; successful in-memory completion opened `tab=complete`, showed Operate current and retained-history copy.

The 72px mobile sticky header initially obscured part of the focused Build heading because its scroll margin was 24px. The shared mobile delivery-target margin is now 96px. Root rechecked Setup at 390px: target top 96.2px beneath the 72px header, with heading/label visible and document/client widths both 375px. The shared selector also covers Build.

Dirty navigation invoked a native confirmation; the CUA modal backend could not read/dismiss it, so its chosen response is not claimed browser-verified. Copy showed successful feedback; the tool's separate clipboard buffer did not verify OS clipboard contents. Full-prompt fallback remains visible. These are fictional local interface checks, not production business mutations or end-to-end provider execution.

For bounded history interaction tests, ignored fixture query options `confirm=stay` / `confirm=leave` substitute only the native confirmation response and display the actual prompt/decision. Root exercised actual browser Back/Forward against the real component guard: Stay produced one prompt, kept the delivery/setup route and exact typed value, then a save succeeded; Leave navigated to Scope and subsequent Forward showed the original saved answer with no discarded draft revived. The native dialog control itself remains unverified by CUA. No production confirmation behavior was substituted.

Implementation, independent review and the bounded browser checks above are complete. The user-facing coordinator owns the final Sites build, source publication and release checks. Actual publication status, release identifiers and post-release evidence are maintained in `C:/Code/bearagon-handbook/CURRENT-STATE.md`; this application report is the completed implementation handoff, not proof of deployment.
