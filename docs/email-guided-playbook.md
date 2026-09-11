# Email assistance: guided implementation pilot

Implemented September 10, 2026 (Mountain); guide ID `email-2026-09-11.1` uses the UTC date. Source/local preview only; not published by this task.

## Employee path

Company → Build & test / internal Automation work → Email assistance → Start guided email setup. The shared Playbooks page explains how to find it. The company route is `/clients/[id]/playbooks/email`.

Configuration reuses the scoped provider, mailboxes and routing/detail. Mailbox arrangement, harness/connector, delivery owner (Brendan/Emily/Derek), human reviewer and fallback need confirmation. Default authority is draft-only, even if narrow automatic replies were purchased. The server rejects automatic reply configuration unless that exact authority is in accepted scope. This pilot supports one Google or Microsoft route per scoped `email` work order, not inferred custom services or simultaneous provider installations.

The six steps cover authorization, provider-specific connection, triage/draft build, send boundaries, acceptance tests, and delivery/Console handoff. Provider and mailbox arrangement change instructions; reply authority changes the review step. The harness remains a named input, not an assertion that every connector supports every action. A harness-specific installation recipe is still to be agreed with the owner and validated in that environment. This is not an automatic deployment package.

## Persistence and safety

- `WorkOrder.emailRun` stores the configuration, guide version, full instruction snapshot, per-step status/notes/evidence/blocker, attributed saves and setup revision inside the existing proposal JSON. No schema change or migration.
- `emailPlaybook` uses the existing authenticated, same-origin, bounded proposal endpoint and transactional compare-and-swap/history/audit path. Missing scope, archived accounts and closed delivery records cannot be modified. Client/internal accounts share the guide without inventing customer contracts.
- Partial configuration and step notes can be saved. Step completion needs complete configuration, prior steps and nonblank observed evidence. It does not mark work orders tested, approve use, enable sending or fabricate Console health.
- Changed technical inputs require explicit confirmation when recorded work is affected; relevant guide completion is withdrawn but notes remain. Existing build/test status on that email work order is reset for revalidation, and its use approval withdrawn. Prior build/test references remain in immutable proposal history; unrelated work orders/task timestamps remain untouched. Reassignment alone does not invalidate technical work.
- Changing shared setup retains guide notes but returns completed guide steps to In progress, matching the existing shared-setup revalidation rule. Reopening a prerequisite similarly withdraws later guide completion without deleting notes. Previously selected provider/reply branches retain their notes separately.
- Errors retain fields. Conflict reload retains unsaved fields and displays latest saved values for comparison; it never automatically retries a stale mutation. Read-only snapshots retain their instructions. An unknown older guide version is read-only until a deliberate future upgrade path exists.
- Secrets and private message bodies must not be entered in the guide. Connection/secret management stays with the approved external systems. A copied brief contains company scope information: employees should use it only in the authorized company harness.

## Guide stewardship

This guide adapts the conditional walkthrough approach inspected in `../bearagon-onboarding/ui/phases.js` and `ui/app.js`, not its outdated README's stub description. The desktop app is unchanged. No assumption was made that old vendor instructions or endpoint deployment claims remain accurate.

Guide steward: Bearagon delivery team. No individual author/reviewer approval or live field validation is invented. Provider references checked during implementation:

- [Google Workspace application access controls](https://support.google.com/a/answer/7281227)
- [Microsoft Graph permission reference](https://learn.microsoft.com/en-us/graph/permissions-reference)

The instructions deliberately avoid claiming that scope permissions alone prevent every send action. Mailbox/provider/harness compatibility and sensitive-data handling need verification in each real delivery. Other services retain the existing reference guides.

## Validation

TypeScript, production build, and 96 automated tests passed. Added checks cover Google/Microsoft branching, draft-only authority, malformed/bounded input, partial saves, prerequisite completion, notes preservation, per-order resets, owner-only changes, preserved retired-branch evidence, immutable version/history and closed delivery protections. Rendered-component checks establish saved notes prefill, prerequisites before inputs, disabled completion and read-only fields. Local new route returned HTTP 200 after restarting the preview to register its new client component.

No browser interaction/screenshot QA, live mailbox access, external messages, deployment, provider consent, actual automation tests or production business-record edits were performed. Full operator acceptance and a selected-harness recipe validation remain next work.
