# ADR 0001: Two surfaces, one platform contract

- Status: Accepted
- Date: 2026-09-03

## Context

Bearagon has two useful but different products. Bearagon Console is a client-facing operational view with automation events, runs, metrics, connector health, exceptions, and decisions. Bearagon CRM has the stronger internal workflow for contacts, onboarding, and organizing delivery work.

Combining their current source trees or making them peer systems of record would conflate personas, duplicate client and automation state, and introduce synchronization work before the business needs it. Replacing either application wholesale would discard valuable domain work.

## Decision

Retain two role-specific surfaces behind one explicit platform contract:

| Concern | Canonical owner |
| --- | --- |
| Accounts, contacts, commercial relationship | Bearagon Ops |
| Onboarding engagement and checklist | Bearagon Ops |
| Workspace provisioning request | Bearagon Ops |
| Automation blueprint and delivery intent | Bearagon Ops |
| Desired runtime state | Bearagon Ops as canonical operator intent; command and acknowledgement state remain separate |
| Internal delivery decisions | Bearagon Ops; never treated as execution authority |
| Runs, events, evidence, metrics, connector health | Console/runtime platform |
| Observed runtime state | Console/runtime platform |
| Client/runtime decisions | Bearagon Console |
| Client-facing status and exceptions | Bearagon Console |
| Privileged execution | External harness behind a scoped command gateway |

Bearagon Ops is the new name and role of the CRM application. Console stays independently deployable and client-facing. The first integration is read-only from Ops to Console through a server-side adapter. Console credentials must never be sent to browser code.

This is a logical boundary, not a commitment to microservices. The platform kernel may later become a modular monolith with shared identity and a canonical tenant ID. Until then, workspace mapping is explicit and cross-database foreign keys are forbidden.

## Automation state model

An automation is not a single Boolean:

1. A blueprint specifies the objective, trigger, action, safety level, runner type, and acceptance criteria.
2. An installation associates a blueprint with an account workspace and harness reference.
3. `desired_state` records an operator request.
4. A future command gateway submits an idempotent, authorized command to the harness.
5. Runner acknowledgement and Console telemetry determine `observed_state`.

The `observed_state` and `last_observed_at` columns in Ops are read-model projections, not a second runtime authority. Only the future reconciliation service may update them. Until a projection has a timestamp, the interface must label it as unreconciled; after reconciliation, the interface must show the observation time so operators can judge freshness. Direct operator routes never write those fields.

The UI must never present a requested state, a simulated response, or stale local state as proof that an automation is running.

## Consequences

Benefits:

- each persona gets a focused interface;
- contacts and onboarding can evolve without weakening runtime telemetry;
- no dual-write or brittle database sharing is required;
- the harness can vary by client or automation;
- activation, testing, and approvals have an honest path to real execution.

Costs:

- identity, tenant mapping, and API contracts must be formalized;
- summaries can be temporarily unavailable when Console is unavailable;
- two frontends remain until there is evidence that merging their shells is valuable.

## Incremental migration

1. Establish the canonical Ops schema and cut CRM routes over without backfilling demo data.
2. Add the read-only Console adapter and explicit workspace mapping.
3. Repair Console's fresh-deployment migration chain and credential boundaries.
4. Define versioned platform contracts and shared tenant identifiers.
5. Implement a scoped, idempotent harness command gateway with acknowledgements.
6. Reconcile Console telemetry into Ops projections without transferring runtime ownership.
7. Move one privileged action at a time behind authorization, audit, and rollback controls.
8. Reassess frontend consolidation only after real operator and client usage provides evidence.

## Non-goals for the first slice

- building automations inside the Ops web process;
- exposing Console or harness credentials to the browser;
- treating approval as execution;
- seeding fake runs or health records;
- sharing a D1 database across independently deployed applications;
- migrating the roughly three HubSpot contacts automatically when manual entry is safer and cheaper.
