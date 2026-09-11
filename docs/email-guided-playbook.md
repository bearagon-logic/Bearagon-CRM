# Email assistance: guided implementation pilot

Implemented September 10, 2026 (Mountain); current guide ID `email-2026-09-11.2` uses the UTC date. Source/local preview only; not published by this task.

## Codex preference follow-up

The owner selected Codex as the preferred harness. Fresh guides now default to Codex; saved alternatives remain unchanged. A harness name beginning with Codex selects project/account preflight, Gmail or conditional Outlook Email plugin checks, reusable project instructions, synthetic-first test preparation, a copyable no-send Codex task prompt, and a separately verified recurring runtime. It does not create Codex tasks, install plugins, connect accounts or enable schedules from Ops.

The original `.1` instruction snapshots remain available and editable. Saving configuration upgrades to `.2`; recorded work requires explicit revalidation confirmation and notes remain. Unknown versions are still read-only. This is not a silent rewrite of existing installation instructions.

Official sources checked: [plugins](https://learn.chatgpt.com/docs/plugins), [project instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [scheduled tasks](https://learn.chatgpt.com/docs/automations). Available tool metadata in this session confirms Gmail read/draft actions, but no real mailbox identity or operation was tested. Outlook Email availability/actions are explicitly conditional. Client/account isolation, mailbox permissions and scheduled-host availability require real verification.

Validation for the follow-up: TypeScript, production build and 98 automated tests, including Codex prompt/branching and explicit older-guide upgrade behavior. No live changes or actual email/automation execution. Codex is now chosen; end-to-end recipe field validation remains outstanding.

## Employee path

Company → Build & test / internal Automation work → Email assistance → Start guided email setup. The shared Playbooks page explains how to find it. The company route is `/clients/[id]/playbooks/email`.

Configuration reuses the scoped provider, mailboxes and routing/detail. Mailbox arrangement, harness/connector, delivery owner (Brendan/Emily/Derek), human reviewer and fallback need confirmation. Default authority is draft-only, even if narrow automatic replies were purchased. The server rejects automatic reply configuration unless that exact authority is in accepted scope. This pilot supports one Google or Microsoft route per scoped `email` work order, not inferred custom services or simultaneous provider installations.

The six steps cover authorization, provider-specific connection, triage/draft build, send boundaries, acceptance tests, and delivery/Console handoff. Provider and mailbox arrangement change instructions; reply authority changes the review step. Codex-specific instructions apply to the preferred harness; alternatives retain general guidance. The named harness is not an assertion that every connector supports every action. Real recipe validation in the selected account/runtime remains required. This is not an automatic deployment package.

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
