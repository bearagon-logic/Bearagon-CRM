import { AppShell } from "@/components/app-shell";

export default function CipherPage() {
  return <AppShell><main className="cipher-page">
    <section className="cipher-hero">
      <div className="cipher-identity">
        <img src="/cipher-bearagon.png" alt="Cipher, the Bearagon sentinel" />
        <div><small>BEARAGON SENTINEL</small><h1>Cipher</h1><p>A visual sentinel for thoughtful, observable operations.</p></div>
      </div>
      <div className="cipher-status"><i></i><span><b>Informational only</b><small>No autonomous service connected</small></span></div>
    </section>
    <div className="cipher-content cipher-sentinel-content">
      <section className="cipher-sentinel-card">
        <small>ROLE</small>
        <h2>A mascot, not another system</h2>
        <p>Cipher is Bearagon Ops’ sentinel: a clear visual reminder that every automation should be intentional, observable, and under human control. Cipher does not answer calls, send messages, access client data, or make decisions.</p>
      </section>
      <section className="cipher-sentinel-grid" aria-label="Cipher scope">
        <article><small>CIPHER REPRESENTS</small><h3>Operational awareness</h3><p>A consistent marker for the human review and guardrails around Bearagon’s work.</p></article>
        <article><small>THIS PAGE</small><h3>Has no controls</h3><p>There are no settings to save because Cipher is not a connected service.</p></article>
        <article><small>ACTUAL CAPABILITIES</small><h3>Live where they operate</h3><p>Voice tools, connected services, and delivery automations are configured in their respective systems.</p></article>
      </section>
      <section className="cipher-sentinel-note"><img src="/cipher-bearagon.png" alt="" aria-hidden="true" /><div><small>SENTINEL PRINCIPLE</small><h2>Make the operating boundary obvious.</h2><p>When a real capability is connected, it should show its owner, scope, status, and controls where the work happens—not behind a mascot page.</p></div></section>
    </div>
  </main></AppShell>;
}
