// Read-only delivery guidance adopted from the approved concept (2026-09-08).
// Version the guide independently of company installations and accepted scope.
export const guideRevision = '2026-09-08';
type ConfigField = {
  key: string;
  label: string;
  hint: string;
  options?: readonly string[];
};
const field = (
  key: string,
  label: string,
  hint: string,
  options?: readonly string[],
): ConfigField => ({ key, label, hint, options });
export const serviceCatalog = [
  {
    id: 'email',
    name: 'Email assistance',
    tier: 'base',
    summary: 'Triage agreed inboxes and compose useful replies.',
    tools: 'Client email platform',
    guidance:
      'Start with draft-only assistance. Define the inboxes, volume, urgency rules, tone, exclusions, and review owner. Narrow automatic replies need an approved scenario and escalation rule; permission to read email is not business authority to send it.',
    fields: [
      field(
        'mailboxes',
        'Mailboxes and volume',
        'Name inboxes, user count, and expected daily volume.',
      ),
      field(
        'detail',
        'Reply tone and detail',
        'Brief or detailed; brand tone; topics to exclude.',
      ),
      field('mode', 'Reply authority', '', [
        'Draft for human review',
        'Approved narrow auto-replies',
      ]),
      field(
        'rules',
        'Routing and reply boundaries',
        'Urgency rules, reviewer, exclusions, and any approved auto-reply scenarios.',
      ),
    ],
    steps: [
      'Connect only agreed mailboxes with scoped access.',
      'Configure routing and approved response boundaries.',
      'Test sensitive, ambiguous, duplicate, and failed-send cases.',
    ],
  },
  {
    id: 'brief',
    name: 'Daily brief',
    tier: 'base',
    summary: 'Bring priorities and exceptions into Bearagon Console.',
    tools: 'Approved sources + Console',
    guidance:
      'A brief synthesizes available evidence; it does not make every source connected or complete. Select recipients, sections, delivery time and time zone. Label missing data. Posting a brief does not grant permission to perform the actions it recommends.',
    fields: [
      field(
        'sources',
        'Sources and sections',
        'Mail, calendar, unanswered inquiries, automation exceptions; only approved sources.',
      ),
      field(
        'schedule',
        'Recipients and delivery schedule',
        'Who receives it, local time, time zone, and weekdays.',
      ),
      field('detail', 'Level of detail', '', [
        'Concise priorities',
        'Detailed with supporting links',
      ]),
    ],
    steps: [
      'Map approved source data and recipient visibility.',
      'Configure schedule and sections.',
      'Verify missing-source handling and Console delivery.',
    ],
  },
  {
    id: 'calls',
    name: 'Phone reception',
    tier: 'base',
    summary: 'Answer inbound calls, capture the need, and hand off safely.',
    tools: 'Retell + client phone system',
    guidance:
      'Scope a bounded reception flow, not unlimited custom call-center work. Define approved knowledge, hours, volume, escalation, and failed-transfer behavior. Booking is a separate configured responsibility. Recording/transcript handling needs an agreed notice, access, and retention process. Forwarding itself can cost money: cost and test the fallback.',
    fields: [
      field(
        'coverage',
        'Numbers, coverage and volume',
        'Numbers, hours/time zone, expected monthly minutes, languages.',
      ),
      field(
        'knowledge',
        'Approved answers and booking scope',
        'FAQ source, prohibited promises, whether booking is included.',
      ),
      field(
        'handoff',
        'Human handoff and failure path',
        'Human destinations, urgent calls, no-answer and budget-limit fallback.',
      ),
      field(
        'records',
        'Call records and retention',
        'Summary/transcript/recording choices, notice, access and retention.',
      ),
    ],
    steps: [
      'Configure a client-scoped agent and approved knowledge.',
      'Map contact capture and human escalation.',
      'Test urgent calls, failed transfers, privacy handling, and budget fallback.',
    ],
  },
  {
    id: 'followup',
    name: 'Contact funnel',
    tier: 'base',
    summary: 'Capture website and phone inquiries in the client’s CRM.',
    tools: 'Website / phone + designated CRM',
    guidance:
      'Persist before notifying, deduplicate safely, and send ambiguous identities to review. A receipt acknowledgment is not a meaningful response or marketing consent. Client leads belong in the client’s designated CRM, not Bearagon’s sales pipeline. Social lead forms, messages, and comments are separate connector scopes.',
    fields: [
      field(
        'sources',
        'Intake sources',
        'Website forms, chatbot handoff and phone sources; identify each.',
      ),
      field(
        'destination',
        'Destination CRM and matching',
        'Client CRM, required fields, duplicate rules and identity-review owner.',
      ),
      field('response', 'Receipt acknowledgment', '', [
        'Store + assign human follow-up',
        'Acknowledge + assign human follow-up',
      ]),
      field(
        'ownership',
        'Assignment and follow-up rules',
        'Who follows up, by when, and which incomplete entries need review.',
      ),
    ],
    steps: [
      'Connect approved intake sources to the client CRM.',
      'Configure identity review, attribution and assignment.',
      'Test persistence, duplicate events, acknowledgment and notification failures.',
    ],
  },
  {
    id: 'intel',
    name: 'Weekly market pulse',
    tier: 'base',
    summary: 'A bounded, source-linked market and competitor digest.',
    tools: 'Approved research sources + Console',
    guidance:
      'Agree a small competitor/topic list and report depth. Separate observed facts from inference and label coverage gaps. Public mention monitoring cannot promise access to every social platform. Deep research and campaign execution are add-ons; a report never authorizes a campaign send.',
    fields: [
      field(
        'watchlist',
        'Competitors, topics and geography',
        'Named watchlist, relevant market and source boundaries.',
      ),
      field(
        'schedule',
        'Report depth and delivery',
        'Weekly day/time zone, recipients, length and supporting links.',
      ),
    ],
    steps: [
      'Define watchlist and accessible sources.',
      'Produce a source-linked report separating inference from fact.',
      'Verify relevance, coverage labels and scheduled delivery.',
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing operations',
    tier: 'addon',
    summary: 'Prepare and publish approved social and email campaigns.',
    tools: 'Selected social platforms + email provider',
    guidance:
      'Scope channels separately. Posting, inbox intake, lead ads and mention monitoring are different integrations. Define content ownership, cadence, audience permission and suppression. Require preview/approval unless specific autonomous publishing boundaries are explicitly agreed.',
    fields: [
      field(
        'channels',
        'Channels and cadence',
        'Named social accounts, email lists, frequency; any social intake connectors.',
      ),
      field(
        'authority',
        'Content, consent and approval',
        'Content owner, permission evidence, suppression rules, reviewer and allowed publishing actions.',
      ),
    ],
    steps: [
      'Validate selected channel access and audience permissions.',
      'Prepare content and approval queue.',
      'Test suppression, scheduling, publishing and failure recovery.',
    ],
  },
  {
    id: 'research',
    name: 'Deep research & strategy',
    tier: 'addon',
    summary: 'Commission focused investigations beyond the weekly pulse.',
    tools: 'Scoped research sources',
    guidance:
      'Sell defined questions, depth and deliverables, not unlimited web research. Identify evidence requirements and research budget. Recommendations may inform campaign drafts; marketing execution needs its own scope and authority.',
    fields: [
      field(
        'brief',
        'Research questions and deliverables',
        'Questions, source boundaries, depth, cadence and research budget.',
      ),
    ],
    steps: [
      'Agree research questions and source standards.',
      'Gather and assess evidence.',
      'Deliver a cited brief with limitations and recommendations.',
    ],
  },
  {
    id: 'finance',
    name: 'Financial operations support',
    tier: 'addon',
    summary: 'QuickBooks-connected reporting and month-end preparation.',
    tools: 'QuickBooks + approved reporting sources',
    guidance:
      'Support close preparation, summaries and missing-information flags. Do not promise autonomous accounting close or financial decisions. Define the accountant/client reviewer, periods and source access. Bookkeeping writes, payments and filings are not implicitly authorized.',
    fields: [
      field(
        'reporting',
        'Accounts, reports and periods',
        'QuickBooks company, requested reports, cadence and exclusions.',
      ),
      field(
        'review',
        'Accountant / client review',
        'Who verifies the reports and signs off on close decisions.',
      ),
    ],
    steps: [
      'Connect approved financial sources read-first.',
      'Map reports and exception checks.',
      'Reconcile samples and obtain accountant/client review.',
    ],
  },
  {
    id: 'website',
    name: 'Website & AI integration',
    tier: 'addon',
    summary: 'A bespoke website, chatbot, or existing-site integration.',
    tools: 'Client website + selected AI tools',
    guidance:
      'Distinguish a new website from modifying an existing one. Define pages, content, chatbot knowledge, intake/booking integration, hosting responsibility and maintenance. Do not migrate hosting or replace working intake as an incidental setup step.',
    fields: [
      field(
        'deliverables',
        'Website deliverables and boundaries',
        'New/existing site, pages, content, chatbot, booking, integration and maintenance responsibility.',
      ),
    ],
    steps: [
      'Inventory existing hosting and working intake.',
      'Build the approved site/integration in isolation.',
      'Verify contact capture and rollback before a controlled launch.',
    ],
  },
  {
    id: 'chief',
    name: 'Chief of Staff assistant',
    tier: 'addon',
    summary: 'Coordinate priorities, meetings and delegated follow-up.',
    tools: 'Approved company systems',
    guidance:
      'A coordination layer, not an unrestricted agent running the company. Define who it serves, what systems it can consult and which actions need approval. Start with recommendations, meeting preparation and drafts. Named people retain decision ownership.',
    fields: [
      field(
        'remit',
        'Responsibilities and connected systems',
        'Priorities, meeting preparation, commitments, delegated work and recipients.',
      ),
      field(
        'authority',
        'Allowed actions and escalation',
        'Draft-only actions, explicit execution permissions, spending boundaries and human owner.',
      ),
    ],
    steps: [
      'Agree remit, source visibility and authority.',
      'Configure priorities, preparation and follow-up routines.',
      'Test conflicting instructions, missing data and approval boundaries.',
    ],
  },
] as const;
