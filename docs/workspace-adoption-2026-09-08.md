# Real-data workspace adoption — first slice

The approved production adoption starts by changing navigation and views over existing canonical records, not by copying the concept's sample data or replacing the database.

## Included

- Work queue: saved inquiries, active/planned/blocked onboarding engagements and pending human decisions; priority for blockers/overdue work; exact record links; separate source errors.
- Companies: the existing directory and creation dialog, now at `/companies`; legacy root creation/filter URLs redirect with their parameters.
- Onboarding: existing real delivery queue at `/onboarding`; old `/accounts/onboarding` redirects. Company Delivery tabs remain the detailed record, not a duplicate engagement.
- Operations: completed Live companies plus the internal organization; existing service configuration/Console observations and automation inventory stay reachable. Workspace linkage is not presented as runtime health.
- Playbooks: the reviewed ten-service guidance catalog, versioned independently and explicitly read-only. No deploy or sample-test action.
- Named relationship/inquiry ownership supports Brendan, Emily and Derek, preserving legacy saved owners until explicitly changed.
- Original `/cipher-bearagon.png` artwork retained. Security and Cipher remain secondary resources; Security's reference indicators are not presented as live monitoring.

## Unchanged boundaries

No API mutation rules, schema, migrations, secrets, access grants, existing business rows, intake adapters or Console execution paths changed. Company routes and existing service/delivery editors remain. This release does not implement versioned quotes, client acceptance, structured setup revisions, work-order evidence invalidation or production completion celebration. Those are the next persistence slice, not capabilities implied by the new navigation.

## Validation

- Established production build: success.
- TypeScript: success.
- Node tests: 36 passed, including migration compatibility, domain/Console contracts and six workspace tests.
- Local HTTP responses: 200 for root, Companies, Onboarding, Operations, Playbooks, Security, Cipher, legacy delivery route and legacy creation query.
- Local read-only APIs: inquiries, clients, onboardings and pending approvals returned 200 with the expected arrays.
- No browser visual/interaction QA or new live inquiry/test messages performed.
- Production audience rechecked: Brendan, Derek and Emily only; no external visitors or groups. Publishing uses this unchanged audience under the user's rollout approval.

Previous application source: `8963bf9961bf10ad311c2ba5b61cfdbfdec1d70a`, Sites version 14. No migration rollback is required by this slice because no migrations changed. A deployment result belongs in the handbook after terminal confirmation.
