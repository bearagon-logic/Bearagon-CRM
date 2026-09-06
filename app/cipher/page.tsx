import { AppShell } from "@/components/app-shell";

export default function CipherPage() {
  return <AppShell><main className="cipher-page">
    <section className="cipher-hero">
      <div className="cipher-identity">
        <img src="/cipher-bearagon.png" alt="Cipher, the Bearagon sentinel" />
        <div><small>BEARAGON SENTINEL &amp; GUIDE</small><h1>Cipher</h1><p>A familiar face for helpful guidance and thoughtful automation.</p></div>
      </div>
      <div className="cipher-status"><i></i><span><b>Your Bearagon guide</b><small>Helpful, approachable, security-minded</small></span></div>
    </section>
    <div className="cipher-content cipher-sentinel-content">
      <section className="cipher-sentinel-card">
        <small>CIPHER UPDATES</small>
        <h2>Teacher. Guide. Sentinel.</h2>
        <p>Cipher makes unfamiliar technology easier to understand and reinforces thoughtful operating habits. His job is to help someone understand, remember, or do something—with a personality that feels like part of the Bearagon team.</p>
        <p>Today, Cipher is our familiar face throughout Ops. These three roles guide where we bring him next; videos, contextual help, and checkpoint guidance are planned opportunities.</p>
      </section>
      <section className="cipher-sentinel-grid" aria-label="Cipher’s three roles">
        <article><small>TEACHER</small><h3>Make the unfamiliar understandable</h3><p>Explain automation concepts through short YouTube videos, onboarding walkthroughs, and team learning materials. Give people something useful to remember and the confidence to put it into practice.</p></article>
        <article><small>GUIDE</small><h3>Offer help at the right moment</h3><p>Use optional tooltips and contextual help to explain unfamiliar steps and point out the next action. Keep Cipher’s guidance easy to dismiss and easy to find again when someone needs it.</p></article>
        <article><small>SENTINEL</small><h3>Make the safeguards understandable</h3><p>Draw attention to permission reviews, testing, launch approvals, and issues needing human review. Pair every status message with a real check, its result, and the person responsible for the next step.</p></article>
      </section>
      <section className="cipher-sentinel-card"><small>WHAT CIPHER REPRESENTS</small><h2>Operational awareness</h2><p>A consistent marker for the human review and guardrails around Bearagon’s work.</p><p>Inside Bearagon, Cipher can have personality and become part of our team culture. With clients, use a lighter touch and let the usefulness of his guidance earn their trust. His presence should help people understand our safeguards; security claims need verified evidence.</p></section>
      <section className="cipher-sentinel-note"><img src="/cipher-bearagon.png" alt="" aria-hidden="true" /><div><small>HOW CIPHER SHOWS UP</small><h2>Friendly in guidance. Precise about status. Quiet during serious work.</h2><p>Keep appearances purposeful. When money, access, or customer data is involved, use straightforward language and make the facts and controls easy to find. During an incident, give the team room to focus.</p><p>Before adding Cipher anywhere, ask: does he help someone understand, remember, or do something?</p></div></section>
    </div>
  </main></AppShell>;
}
