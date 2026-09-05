# Bearagon Ops CRM onboarding usability audit

Date: 2026-09-05  
Method: Live browser walkthrough on `https://ops.bearagon.com`  
Perspective: Functional CRM design, delivery operations, and workflow integrity

## Test record

- Account: `Bearagon QA Onboarding 2026-09-05`
- Account ID: `acct_0fc456bd-4fc2-4d46-bf48-e3237ae3011e`
- Contact: `Jordan Tester`
- Email: `qa-onboarding-20260905@example.com`
- Final test state: Live, 8/8 checklist items complete, workspace requested, Console telemetry not linked, no automation installations
- Internal note: The record is marked as QA-only and states that no real client delivery occurred.

The record was intentionally left in the CRM so the team can inspect the exact state described below. The product currently offers no clear archive or test-record cleanup action.

## Executive assessment

The account creation and checklist mechanics work, but the current implementation is a progress tracker rather than a reliable onboarding workflow. It records operator intent well enough for an early prototype, but it does not enforce delivery truth.

The most important failure is that an account can be moved to **Live** and have **Launch approved** marked complete while discovery, connections, guardrails, automation build, and client testing remain incomplete. It can also claim that an automation was built while the same account shows zero automation installations.

This should be fixed before treating onboarding state as operationally authoritative.

## What worked

### Account creation

- The form clearly separates creating a relationship from starting onboarding.
- Enabling **Start onboarding now** automatically changes the relationship from Prospect to Client and reveals starting stage and target date.
- Required company, primary contact, and email inputs were straightforward.
- The new account and its standard eight-item checklist were created successfully.
- The account appeared immediately in the directory with the correct stage, next step, and target date.

### Checklist interaction

- Checklist items save immediately when toggled.
- Progress updates immediately and consistently: 1/8 displayed as 13%, 4/8 as 50%, and 8/8 as 100%.
- The UI provides a short success message after a task is changed.
- Completed state persisted across a reload.
- Reopening is supported by the same checkbox interaction.

### Delivery queue and account navigation

- Accounts now contains a clearly separated Directory and Delivery queue.
- Selecting a row in the Delivery queue opens the corresponding account's Onboarding plan.
- The queue displays useful operational fields: stage, checklist progress, next action, and target date.

### Notes, workspace requests, and audit foundation

- Internal notes save successfully and provide clear feedback.
- Requesting a workspace records a requested state and explicitly says Console provisioning remains separate.
- Operator activity is persisted with actor, timestamp, action, result, and detail fields.
- The data model already supports richer onboarding task statuses, descriptions, due dates, engagement owners, and engagement completion status. Several missing capabilities can therefore be added without replacing the domain model.

## Findings and fix instructions

### P0 — Stage and launch gates are not enforced

**How it failed**

1. Create an account and start onboarding at Intake.
2. Complete only Agreement signed.
3. Complete Launch approved while every intermediate requirement remains pending.
4. Change Current stage from Intake directly to Live.
5. Save the delivery plan.
6. Reload the page.

The CRM persists Live with only 2/8 tasks complete. There is no warning, override reason, or validation failure.

**Why this matters**

CRM stage is used for prioritization, reporting, staffing, and client communication. If it can contradict readiness evidence, dashboards and handoffs cannot be trusted.

**Fix instructions**

- Define server-side transition rules for every stage.
- Do not rely on disabled controls in the browser; reject invalid transitions in the API.
- Treat Launch approved as the final approval, dependent on all required prerequisites.
- Allow exceptional overrides only for an authorized role, with a required reason and audit event.
- Support conditional requirements. For example, a payment-system task may be waived when it is not part of scope, but the waiver must be explicit and audited.
- Present the unmet requirements in the error message and link the operator to them.

**Suggested default gates**

| Destination | Minimum evidence |
|---|---|
| Connections | Agreement and discovery complete |
| Building | Required connections complete or explicitly waived; workspace requested |
| Testing | Guardrails approved; automation installation linked to a harness build |
| Live | Workspace active; required tests passed; launch approved; required runtime link present |

**Acceptance criteria**

- An ordinary operator cannot save Live while any required gate is unmet.
- Launch approved cannot be completed before its prerequisites.
- An override records the actor, previous state, requested state, reason, and timestamp.

### P0 — Checklist completion is disconnected from operational evidence

**How it failed**

- **Automations built in the delivery harness** was marked complete.
- The account's Automations tab simultaneously reported **No automation installations for this account yet**.
- **Email and calendar connected** and **Accounting or payment system connected** could be marked complete without any account-scoped connection records.
- The operational workspace was still not provisioned when the entire checklist reached 100%.

The current Connections page is a browser-local demonstration, not a source of account connection truth. It must not satisfy or imply satisfaction of a production onboarding requirement.

**Fix instructions**

- Give each evidence-based template task a verification strategy.
- Derive connection, workspace, automation-build, test, and runtime tasks from their owning records rather than manual checkboxes.
- Keep manual completion only for genuinely human evidence such as an executed agreement or approval.
- Add an evidence link or reference on every completed task: document, connection ID, installation ID, test run, approval ID, or waiver.
- Visually distinguish **Verified**, **Manually attested**, **Waived**, and **Blocked**.
- Put demo-only modules behind an explicit Sandbox label and never mix their state into production metrics.

**Acceptance criteria**

- The automation-build task cannot be verified when the account has no linked installation.
- A connection task reflects an account-scoped provider connection, not local browser state.
- Removing or invalidating evidence reopens or flags the dependent requirement.

### P0 — Onboarding has no completion lifecycle

**How it failed**

- At 8/8, the account says it is ready to launch but the onboarding engagement remains active.
- The completed Live account remains in the Active Onboardings count and Onboarding queue.
- The next action remains **Complete discovery form**.
- There is no **Complete onboarding**, **Close onboarding**, or closeout review action.

The database supports engagement statuses and a completion timestamp, but the UI/API do not perform the transition.

**Fix instructions**

- Add a server-side `complete onboarding` command.
- Validate all required tasks, workspace state, approvals, and required runtime evidence in one transaction.
- Set engagement status to completed and record `completedAt`.
- Replace the stale next action with the next lifecycle action, such as first value review or managed-service handoff.
- Remove completed engagements from the active queue and add a Recently completed or All view.
- Record a specific completion event in the audit trail.

**Acceptance criteria**

- Completing the last checkbox does not silently close delivery.
- A clearly labeled closeout review shows readiness and blockers.
- A successfully completed engagement leaves Active Onboardings and retains a permanent audit history.

### P1 — Overview duplicates the Onboarding plan

**How it failed**

The account Overview and Onboarding plan both display the same progress, checklist, stage, and next action. Operators have two places to perform the same work.

**Fix instructions**

- Make Overview a compact account health summary.
- Show relationship data, primary contact, current stage, next action, owner, risks, recent activity, and a small progress summary.
- Put the editable checklist, task details, stage gates, target date, and closeout controls only in Onboarding plan.
- Add a single **Open onboarding plan** call to action from the Overview summary.

### P1 — Account tabs and URLs drift apart

**How it failed**

- Delivery queue links correctly open `?tab=onboarding`.
- Clicking Overview, Automations, or Activity changes the visible panel without changing the URL.
- Reloading can therefore open a different panel from the one the operator was viewing.

**Fix instructions**

- Make each tab a real link or update the `tab` query parameter with the router.
- Ensure browser back/forward, reload, copy link, and deep links preserve the selected panel.
- Add tests for all valid and invalid tab query values.

### P1 — Post-create handoff is incomplete

**How it failed**

After **Create account**, the dialog closes and the operator returns to the directory. There is no success message or direct continuation into the account just created. The operator must find and open the new row.

**Fix instructions**

- When onboarding is selected, redirect to the new account's Onboarding plan.
- When onboarding is not selected, redirect to the new account's Overview.
- Display a persistent success message with Undo/Archive only if those actions are implemented safely.
- Consider two explicit actions: **Save account** and **Save & start onboarding**.
- Explain that starting onboarding changes the relationship to Client.

### P1 — Tasks are too shallow for team delivery

**How it failed**

The interface exposes each task only as a binary checkbox. There is no task owner, due date, description, dependency, evidence, blocker reason, discussion, or related record. The database already supports pending, in-progress, blocked, completed, and skipped statuses, but the UI collapses them into incomplete/complete.

**Fix instructions**

- Open a task detail drawer when a task row is selected.
- Expose status, owner, due date, description, dependency, evidence/reference, notes, and last update.
- Add **Blocked** with a required blocker reason and owner.
- Add **Waived/Skipped** with a required rationale and approval when the task is normally required.
- Display overdue and blocked work in the Delivery queue.
- Support configurable templates or optional requirements by engagement type.

### P1 — Ownership and dates are incomplete

**How it failed**

- No onboarding owner is assigned or shown even though the engagement model includes an owner field.
- Target date can be set during account creation but is read-only afterward.
- Individual task due dates exist in the model but are not exposed.

**Fix instructions**

- Require or default an onboarding owner when delivery begins.
- Allow target-date editing with a visible dirty state and save result.
- Add task due dates and derive default dates relative to the engagement target.
- Surface owner, due date, and overdue status in the queue.

### P1 — Save behavior is inconsistent

**How it failed**

- Checkboxes auto-save.
- Notes use Save notes.
- Stage and next action use Save delivery plan on one tab.
- The header always shows Save changes, including when the visible account identity is read-only.
- There is no dirty indicator explaining what the general save button will save.

**Fix instructions**

- Pick one interaction model per object.
- Recommended: auto-save task status; explicit Save for the delivery-plan form; explicit Save for account/contact editing.
- Remove the global Save changes button unless it controls a visible account edit mode.
- Disable explicit save buttons until their form is dirty.
- Show field-level errors and a persistent save result near the action that caused it.

### P1 — Activity is generic and stale until data is reloaded

**How it failed**

- Checklist audit rows say only **Onboarding checklist status changed**, without the task name or old/new status.
- The workspace request was written by the API but did not appear in the already-loaded Activity tab because the client did not refresh or append activity after the mutation.

**Fix instructions**

- Store and display the exact task title, template key, old status, new status, and any evidence or reason.
- Refresh the account activity query—or append the returned audit event—after every mutation.
- Return the created audit event from mutation endpoints.
- Add resource links from audit rows to the related task, workspace, connection, automation, or approval.

### P1 — Core contact management is missing from the UI

**How it failed**

The create form captures one primary contact, but the account workspace does not allow the operator to edit the account identity, update contact details, add another contact, change the primary contact, or assign relationship roles. The underlying model already supports multiple contacts and roles.

**Fix instructions**

- Add an Account details edit action for name, website, relationship type, and status.
- Add a Contacts section with create, edit, associate, remove, make primary, and relationship-role actions.
- Preserve one-primary-contact integrity in the API and database.
- Show contact-specific activity and communication history.

### P2 — Test records and inactive relationships cannot be managed

**How it failed**

There is no visible archive action for the QA account or an obvious lifecycle action for inactive/cancelled relationships.

**Fix instructions**

- Add Archive account with a confirmation and reason.
- Prefer archival over deletion so audit history and referential integrity remain intact.
- Add filters for Active, Inactive, and Archived.
- Exclude archived and completed records from active workload metrics.

### P2 — Directory metrics can misrepresent delivery

**How it failed**

Active Delivery is derived from having a delivery stage. A Live, 100%-complete onboarding still counts as active because its engagement was never closed.

**Fix instructions**

- Drive active metrics from engagement status, not stage alone.
- Separate **Active onboarding**, **Live managed clients**, **Blocked**, and **Recently completed**.
- Make every metric clickable into the exact filtered records it counts.

## Recommended build order

### Phase 1: Make delivery state trustworthy

1. Add server-side stage transition and launch gates.
2. Add evidence-backed completion for workspace, connections, automations, tests, and approvals.
3. Add a transactional onboarding completion command and completed queue state.
4. Improve audit detail and refresh activity after mutations.

### Phase 2: Make the operator flow coherent

1. Redirect account creation into the new record.
2. Remove checklist duplication from Overview.
3. Make account tabs URL-addressable.
4. Unify save behavior and expose editable target date and owner.
5. Add task details, blockers, due dates, waivers, and evidence.

### Phase 3: Complete the minimum CRM foundation

1. Add account editing and archival.
2. Add multi-contact management and roles.
3. Add general follow-up tasks and next-touch dates outside onboarding.
4. Add real activity associations for communications, meetings, approvals, connections, and delivery work.

### Phase 4: Replace demonstrations with integrations

1. Keep demo experiences in a labeled Sandbox.
2. Build account-scoped connection records and provider adapters.
3. Link automation installation state to the delivery harness.
4. Treat Console telemetry as observed state and use it to verify readiness without letting Ops invent runtime truth.

## Product design principle

The CRM should be the system of record for **who the client is, what was agreed, who owns the work, what must happen next, and whether delivery is ready**. The harness should remain the system that builds and runs automations. The Console should remain the source of observed runtime status. Onboarding should coordinate those systems with links and evidence; it should not duplicate or simulate their capabilities.
