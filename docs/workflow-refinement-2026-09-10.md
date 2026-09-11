# Workflow refinement — September 10, 2026

Implements the six priority improvements from the live lifecycle audit. This is an implementation record, not proof of production deployment.

## Changes

- **Inquiry handoff:** qualification can explicitly resolve one selected intake. The default keeps conversations open. The authenticated handoff checks company, inquiry and revision together, records an audit event, and preserves contact/history/follow-up fields. An ongoing account can reconcile a completed intake without closing unrelated conversations. Acceptance moves external sales stage to won; internal accounts are unchanged.
- **Evidence reuse:** checklist review can use saved acceptance, complete setup answers, and current build/test references. Suggestions fill empty fields only. Employees still choose status and verify evidence; saved implementation testing is not automatic client acceptance or launch approval. Revised setup keeps historical evidence and requires retesting through an explicit confirmation dialog.
- **Operational visibility:** a service summary places work-order readiness, linked installations and Console observations together. Unknown or stale telemetry stays explicit. Accepted scope is associated by service ID; no installation or healthy runtime is invented.
- **Commercial clarity:** accepted package totals are shown, and included service pricing is identified as included rather than presented as missing. Internal services are distinguished from customer charges. No prices or billing events are generated.
- **Navigation and queue:** medium-width navigation retains labels; queue rows have owner/due filters and compact action disclosures. Loading integration status is distinct from disconnected status. Scope progression validates basic required fields and USD amounts while draft saving remains permissive.
- **Completed-record review:** completed requirements remain readable in a centered read-only dialog. Saved notes are visible in rows. Historical quote details collapse so delivery evidence is easier to find. Version history refreshes from persisted server records after saves.

## Verification

- TypeScript and production build passed.
- All 76 automated tests passed, including SQLite-backed handoff concurrency/isolation checks and evidence/pricing contracts.
- `scripts/workflow-local-smoke.mjs` is hardcoded to localhost. It exercised two-inquiry handoff isolation, stale-write rejection, external acceptance, package prices, setup revision, retained historical evidence, retesting and simulated onboarding completion using local-only fixtures.
- Focused browser checks verified the medium-width labeled sidebar, compact queue, service summary and read-only completed-requirement modal. This was not exhaustive mobile, zoom or assistive-technology testing.
- Live business records were not changed during implementation. Local simulated checklist completion does not represent real delivered services.

## Boundaries and follow-up

No schema migration, access change, automation execution, provisioning, email, invoice or retrospective inquiry cleanup. Existing logo, artwork, Security and Cipher remain. Ops owns intent; Console owns observed runtime facts; harnesses execute.

The two-step relationship save and optional inquiry handoff are intentionally separate: a failed handoff leaves the saved relationship intact and reports the error. Final approval retains existing full validation beyond the basic Continue checks. General sandbox mode, deployable playbook execution and comprehensive mobile/accessibility testing remain separate work.

Publication to the existing shared audience requires approval. Rollback is a prior saved Sites version; no database rollback is required by this change.
