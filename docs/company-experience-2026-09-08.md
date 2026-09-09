# Unified company experience — September 8, 2026

The user clarified that the refined concept is the frontend specification, not inspiration for additions behind links in the old interface. This release replaces the company-detail page with one workspace and retains production APIs and records.

## What changed

- Company journey: Inquiry → Scope → Setup → Build & test → Operate, above Overview / Services / Delivery / Activity. Saved facts determine progress; selecting a tab cannot advance a company.
- Services embeds the revisioned ecosystem/service/pricing/review form directly. Acceptance opens Delivery in that same company context.
- Delivery opens guided questions, then retained answer cards with editing and impact confirmation, service work orders, and existing verification/launch requirements. No separate competing checklist route. Pre-package engagements retain their requirements with an explicit legacy-data notice rather than invented acceptance or discovery answers.
- Successful final handoff opens the reused Cipher completion artwork and an explicit ongoing-service destination. Direct milestone navigation is gated by saved completed + Live state. Ongoing Services displays the existing account-scoped Console observations before the expandable commercial form.
- Companies uses compact record-directory presentation and All relationships / Prospects / Clients / Internal filters. Onboarding uses the concept's cards, owners, progress, blockers and next-action layout, with real requirement counts rather than fictional sample milestones.
- Old `?tab=onboarding` and `?tab=automations` bookmarks resolve to Delivery/Services. `/clients/:id/scope` redirects to the same company record. Original sidebar logo, Security, Cipher, integration configuration, inquiry history and marketing preferences remain.
- Qualification uses the existing authenticated relationship endpoint. The detail response now includes existing saved ownership/follow-up fields; there is no new table, schema change or backfill.

## Deliberate production differences

Sample tests, fixed demo identities and fake observations are not copied. Operators record actual external test references. Existing requirement dependencies, documented exceptions and launch approval still apply. Handoff uses the established stage-to-Live and complete-onboarding API operations; if completion fails after stage save, the engagement remains active and the error is shown, not a success screen. This is not automatic deployment, email, signing or billing. Repeat proposals/amendments remain unsupported. Existing standalone operational tools are preserved, not replaced by the demo's simulated controls.

## Validation

TypeScript and deployment build pass. The automated suite has 52 checks, including bookmark aliases, saved-state phase mapping, one destination per phase, rendered journey labels and completion/redirect source contracts. The local-only lifecycle script now additionally resolves the fixture's requirements, completes handoff, rejects repeat completion and rejects editing closed setup. No production records, messages or external execution were used in verification. Local page compile/HTTP check returned 200. The reused completion asset was inspected. Browser visual/interaction QA was not requested or performed; this is not a pixel-identical browser acceptance claim.

Prior production: Sites version 16, source `17d2d424b0f57eda62802c7a7e0b3657c9d80219`. This release does not alter the schema or runtime access configuration. Rollback restores that UI, not database history.
