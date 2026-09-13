import Link from 'next/link';
import { AppShell } from '@/components/app-shell';

export default function SecurityCenter() {
  return <AppShell><main className="lane-page work-view security-reference-page">
    <header className="lane-header"><div><small>RESOURCES & SETTINGS</small><h1>Security reference</h1><p>Working standards and where to review actual configuration.</p></div></header>
    <div className="lane-body">
      <p className="lane-note">This page documents standards. It does not monitor security or control running automations.</p>
      <section className="lane-panel security-destinations" aria-labelledby="security-tools"><h2 id="security-tools">Review your configuration</h2>
        <Link href="/connections"><strong>Connections</strong><span>Review the connection setup recorded in Ops. Confirm provider access with the account owner.</span></Link>
        <Link href="/operations"><strong>Services & monitoring</strong><span>Open a company’s Services page for installation details and available Console reports.</span></Link>
        <Link href="/approvals"><strong>Approval requests</strong><span>Review saved requests and decision history. Approving a request does not execute it.</span></Link>
      </section>
      <section className="lane-panel security-standards" aria-labelledby="security-standards"><h2 id="security-standards">Implementation standards</h2>
        <dl>
          <div><dt>Minimum access</dt><dd>Confirm the intended company, account and required permissions before connecting a provider.</dd></div>
          <div><dt>Human review</dt><dd>Define who reviews drafts, approves changes and handles exceptions for each implementation.</dd></div>
          <div><dt>Recorded evidence</dt><dd>Keep build, test and approval references with the company’s automation work. Distinguish recorded decisions from observed runtime results.</dd></div>
          <div><dt>Pause and recovery</dt><dd>Use the implementation’s documented stop procedure. A recorded pause request needs acknowledgement from the system running the automation.</dd></div>
        </dl>
      </section>
    </div>
  </main></AppShell>;
}
