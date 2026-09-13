# Ops page and workflow review — September 12, 2026

## Owner direction and reference

The owner requested a broader product/design approach on every touched page, a less bulky interface, an assessment of walkthrough flow against bearagon-onboarding, Work queue tabs, and a factual explanation of Approvals and Security. D21 records that standing direction.

References inspected: live Bearagon email walkthrough (read-only); local onboarding ui/index.html, ui/app.js and ui/styles.css; Ops source and handbook design patterns. Onboarding uses one focused content column, concise route-dependent steps, compact rail and consistent Back/Next actions. It saves local checklists; Ops needs multi-user revision/evidence/approval semantics, so those are preserved. This is a source-grounded comparison with browser inspection of Ops, not a usability study of both applications.

## Findings and implemented changes

- Work queue's three loose shortcut links had no shared selected state or return navigation. Shared route tabs now connect Next actions, Inbox, Approvals and Operations on each destination, retaining canonical routes, links and browser history. They are navigation links with aria-current, rather than pretending route changes are local tab panels.
- Work views had inconsistent, oversized headers. The four touched views now use compact sans-serif headers and a common tab treatment. Queue rows retain owner/date/type and actionable links. Narrow screens wrap controls. A legacy global mobile selector initially hid tabs; the shared selector now explicitly wins.
- Approvals has authenticated database GET/POST/PATCH endpoints, persisted request status and operator audit events with concurrency protection. It is not a static stub. However, no other current source inserts decision_requests; scope approval, launch review and internal release are recorded through their own company flows. This page is not a unified approval center and does not itself issue execution commands. The screen now says so, removes an unsupported blanket blocked-action claim, links to the company, and handles failed saves with feedback and refresh. Decision buttons are disabled while saving/loading.
- Security contained hardcoded sample names/timestamps, example permissions, local-state pause/disconnect controls and unverified protection assertions. Replaced with concise standards and links to actual recorded Connections, company Services/monitoring and approval requests. The sidebar calls it Security reference. No live security feature was removed or created; no provider settings changed.
- At a narrower live viewport, the global sidebar plus walkthrough rail squeezed instruction text into a thin column. Layout now responds to actual available content width: compact desktop rail, full-width step picker below 760px of content. Header and step card are smaller, objective text has less framing, duplicate numbering removed, owner/guide details are disclosed beneath the working content on every size, and explicit Back preserves the existing draft cache.
- The company email route previously inherited Companies highlighting. Its wrapper now reads actual proposal context and highlights Operations for internal work, Onboarding for client delivery, and Playbooks while context is loading.

## Verification

Production build and TypeScript completed; final test result recorded in Current state. Existing regression suite covers saved proposal/evidence/approval boundaries. Added server-rendered navigation coverage for canonical targets and exactly one selected view.

Browser review used real components and fictional in-memory fetch fixtures. Confirmed configuration Save & open, draft retention across Back and step selection, evidence-gated completion, successful progress advance, approval network-failure retention and successful approval queue update. Inspected work-view and walkthrough layouts at the default 1280px preview, 900px and 390px. Narrow walkthrough had no horizontal document overflow; after the mobile correction all four tabs appeared in the accessibility tree. No production records were mutated. Browser fixtures remain ignored under work and are excluded from deployment.

## Related structural work still needed

1. Make internal Overview a decision surface: real blockers, next action, owner, relevant recent changes, and concise operating context. Current summary counts and links do not fully earn a separate page. Reuse saved data and show missing information honestly; do not invent monitoring health.
2. Unify visibility of approvals across scope, launch, internal-use and generic decision requests. Preserve each review's distinct authorization and evidence requirements while exposing one actionable list and deep links.
3. Reduce the company hierarchy: distinguish the service package, automation work and runtime monitoring more clearly; review whether configuration and monitoring belong behind the same Services tab. Preserve a stable return path from a playbook to its company/work item.
4. Continue the walkthrough content pass: put the current action and required result first; disclose technical background and provide clearer handoff from copied task brief to saved evidence. This release keeps provider instructions and evidence rules unchanged.
5. Apply the compact working-surface pattern to other touched pages incrementally. Avoid adding new summary cards or duplicate dashboards simply to fill space. Global sidebar artwork and remaining legacy CSS still contribute to visual weight; the whole site has not been redesigned in this pass.

No live approval decisions, runtime commands, connection changes or business-record migrations were performed.
