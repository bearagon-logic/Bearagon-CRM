# Internal operations rather than client onboarding

Bearagon's organization is an ongoing internal automation portfolio. Its availability no longer depends on reaching Live or completing the onboarding engagement. External client lifecycle and database completion gates are unchanged.

## Operator experience

- Internal company routes (including old onboarding links) open a four-section workspace: Overview, Services & monitoring, Automation work, Activity. There is no company-wide completion button.
- The internal company is excluded from the client onboarding lane and the generic delivery queue. Its unfinished automation work appears individually in Work queue under Internal automation. The Companies and Operations surfaces no longer direct it toward a stale onboarding next step.
- Original requirements and notes remain under retained checklist history, without rewriting approval claims. Shared setup and saved revisions remain available. Existing build references, test evidence, scope configurations and playbook steps remain readable.
- Add automation creates an internal backlog item and corresponding service/work-order records, not a client quote, charge or deployment. A valid internal plan authorization remains required. Portfolios are bounded to 50 work orders.

## Automation states and safeguards

Planned maps to To build; Building records work in progress; Testing includes built work awaiting evidence and tested work awaiting internal-use review. Operating requires current build/test evidence and an explicit internal-use review recording allowed actions, access boundaries, human fallback, responsibility and the authenticated reviewer. It is **authorization for ongoing use**, not observed runtime health. Console remains the source of runtime observations.

Each review is independent. Adding new work does not revoke existing reviews. Editing an automation's build/test evidence withdraws its current use approval; previous snapshots remain immutable. Changing shared setup invalidates all affected package evidence/reviews with the existing explicit reset confirmation. Withdrawal of an approval does not stop an external harness, and the UI states that limitation.

Internal-only commands require an actual internal account and an internally authorized proposal. Optimistic version checks, transactional dependent writes, immutable commercial history and closed-engagement protections remain. Previously completed/cancelled internal delivery history is not reopened by this change; an explicit amendment decision would still be required in that case. No schema migration or existing business-record mutation is part of publication.

## Verification

TypeScript and production build passed. All 91 automated tests passed, including internal/client lane separation, independent review, evidence revalidation, internal backlog persistence, stale-write isolation and no generated customer fees. Local internal-work endpoint responded successfully. No live records were changed or live/browser lifecycle testing performed in this implementation.
