# Bearagon Ops

Bearagon Ops is the internal operator surface for Bearagon's consulting business. It owns accounts, contacts, onboarding engagements, workspaces, delivery specifications, and human decisions. Bearagon Console remains the client-facing surface and the source of truth for automation runs, connector health, evidence, and observed runtime state.

The product boundary is deliberate:

- Ops records what Bearagon intends to deliver.
- An external automation harness builds and executes workflows.
- Console records what the runtime actually did.
- Ops reads Console status through a server-side adapter; browser code never receives Console credentials.

See [ADR 0001](docs/architecture/0001-two-surfaces-one-platform.md) for the decision and migration sequence.

## Current milestone

September 8, 2026: the first real-data adoption slice of the approved Ops concept adds Work queue (`/`), Companies (`/companies`), Onboarding (`/onboarding`), Operations (`/operations`) and read-only Playbooks (`/playbooks`). The queue combines saved inquiries, active delivery and pending decisions; intake sync/review and approvals remain accessible through its shortcuts. Old account bookmarks and delivery links remain compatible. Company detail retains the existing Services and Delivery editors. The original Cipher sidebar artwork is unchanged.

The next production increment adds revisioned scope, customer-style quote previews, authenticated internal approval, recorded external acceptance, guided setup and external work-order evidence. Open a company → Services → Establish service package, pricing & quote. Migration 0011 is additive; existing records are not backfilled. See [implementation and validation](docs/proposal-delivery-2026-09-08.md).

This is not a full concept cutover. The guarded completion presentation and fuller ongoing-service layout remain outstanding. No quote sending, signature collection, billing, automatic deployment or provider spending enforcement is enabled by these screens. See the canonical handbook's `OPS-PRODUCTION-ROLLOUT.md`.

The first production-oriented vertical slice includes:

- canonical UUID-based accounts and reusable contacts;
- account and contact capture without automatic onboarding or tenant creation;
- explicit, atomic conversion into a client onboarding engagement and checklist;
- optional workspaces, so a prospect is not silently provisioned as a tenant;
- automation blueprints separated from account installations;
- delivery stage, desired state, and observed state as different facts;
- idempotent decision requests and actor-attributed audit events;
- authenticated APIs, with a local-development operator fallback only;
- a read-only, server-side adapter for Console status;
- migration and domain tests that start from an empty database.

Legacy prototype tables remain in the migration chain for rollback, but the rewritten application routes do not dual-write to them.

Connections provides integration configuration/status, and Communications uses saved inquiries and intake receipts. Connections, Security and Cipher remain under Resources & settings. Security is explicitly labeled as a reference, not live monitoring; Cipher remains the employee-facing mascot/reference page.

## Local development

Requirements: Node.js 22.13 or newer.

```powershell
npm ci
npm run db:migrate:local
$env:WRANGLER_WRITE_LOGS = "false"
$env:WRANGLER_LOG_PATH = ".wrangler/logs"
npx vite
```

Open `http://localhost:5173`. Vite development builds use a fixed local operator identity that is compiled out of production builds. Hosted requests require the identity headers supplied by Sites, an explicit `BEARAGON_OPERATOR_EMAILS` allowlist, and an owner/operator access policy.

Useful verification commands:

```powershell
node --test tests/*.test.mjs
npx tsc --noEmit
npx vinext build
```

## Console read adapter

Configure these as server-side runtime variables; do not expose them with a `NEXT_PUBLIC_` prefix:

- `BEARAGON_OPERATOR_EMAILS`: comma-separated allowlist for API access. Hosted APIs deny access when this is unset.
- `CONSOLE_API_URL`: base URL of the Console API, without a trailing slash.
- `CONSOLE_READ_TOKEN`: a read-only operator credential.

Link an Ops workspace to the matching Console client by setting `workspaces.console_client_id`. Until that link and the server variables exist, the UI reports an explicit `not_linked` or `not_configured` state rather than inventing health data.

Console payloads are runtime-validated before the UI receives them. Ops labels its stored observed state as a timestamped projection; operator routes cannot update that projection.

## Safety boundary

Requesting activation changes `desired_state`; it never changes `observed_state`. Activation requires an active workspace, a ready blueprint, a deployed delivery stage, and a complete harness reference. A “safe test” is rejected until a real harness adapter exists, so the application cannot record a fabricated successful run.

The next vertical slice is the harness command/acknowledgement contract: scoped credentials, idempotent commands, runner acknowledgement, and telemetry reconciliation. It should be implemented before enabling live activation, pause, retry, or approved-action execution.
