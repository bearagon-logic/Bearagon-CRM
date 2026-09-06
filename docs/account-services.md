# Account services and Console visibility

Accounts → company → Services & automations is the durable customer service record. Onboarding remains delivery work; completing onboarding does not remove purchased scope.

## Operator flow

1. Add a service with its purchased scope, quote reference, setup and monthly fees, maintenance, configuration, and service dates.
2. A proposed service is not a purchase. Ordered, active, and ended records require an accepted quote reference, acceptance date, and scope. Recording acceptance does not send or sign an agreement.
3. Create account automations in the existing automation delivery flow. Select them in Edit service. A service may have several installations; an installation may support several services on the same account.
4. In Connections (or Workspace connection inside the service view), choose the verified Console workspace for the account.
5. Match each CRM installation to its corresponding Console automation. Match by explicit account-scoped identity, never by title.
6. Refresh data to see current Console observations. Run history and connector health are displayed alongside service scope. Reported state differing from intended state is highlighted. Unmatched Console automations are visible without implying a purchase.

## Data and integration

- `account_services` holds commercial service records. Unknown fees are null, distinct from a zero fee. Currency is explicit. Monthly fees are recorded as billed in advance; this feature does not issue invoices or collect payment.
- `service_installations` associates purchased scope with installations. API ownership validation and SQLite triggers enforce the account boundary.
- `GET/POST/PATCH /api/clients/:id/services` uses existing authenticated operator authorization. Writes and link changes are audited.
- `GET /api/platform/connection` verifies the configured Console credential against the operator-only `/v1/fleet` endpoint and returns workspace choices plus CRM mappings.
- `PATCH /api/platform/connection` verifies a workspace before linking it. It cannot silently transfer an existing mapping. Linking confirms read access; it does not claim to provision or activate runtime systems.
- `PATCH /api/platform/automation-link` verifies an automation in the mapped workspace before saving its slug in `console_automation_id`. The reader also recognizes a previously stored Console definition ID.
- Console credentials stay in server runtime variables: `CONSOLE_API_URL` and secret `CONSOLE_READ_TOKEN`. The deployed integration currently uses an existing Console operator credential; CRM integration calls are GET-only. A separately scoped read-only Console credential can replace it when supported.
- Services & automations reads live snapshots from `/api/platform/status`. It does not rewrite the older installation observation columns or treat operator intent as execution.
- Snapshot retrieval time is distinct from run time. The UI marks snapshots older than five minutes. A failed refresh clears Console observations rather than showing stale data as current.
- Removed Connections' browser-local demo setup flows. External client integrations are configured in delivery systems and reported by Console.

## Verification

Migration-chain tests cover both new tables, fees, and account-link guards. Contract tests cover purchase validation, explicit Console matching, unavailable/missing data, state disagreement, and latest-run selection. Local HTTP checks exercise creation, persistence, updates, invalid installation IDs, and missing acceptance. Read-only live Console checks validate all three response contracts. No customer purchase or workspace mapping is inferred or seeded.
