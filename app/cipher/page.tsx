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
        <h2>A growing role across Bearagon</h2>
        <p>Cipher gives our commitment to helpful, secure automation a recognizable face. Today, he represents Bearagon throughout Ops. Our next opportunities for Cipher include useful tooltips, YouTube explainers, onboarding guidance, and clear reminders at important automation checkpoints.</p>
        <p>These are directions we’re developing. As each one becomes available, this page will share what’s new and where to find it.</p>
      </section>
      <section className="cipher-sentinel-grid" aria-label="What Cipher represents and where he can help">
        <article><small>CIPHER REPRESENTS</small><h3>Operational awareness</h3><p>A consistent marker for the human review and guardrails around Bearagon’s work.</p></article>
        <article><small>GUIDANCE · PLANNED</small><h3>A helpful nudge</h3><p>Bring Cipher into tooltips and onboarding steps to explain unfamiliar terms, point out the next action, and make it easier to find help. Keep guidance easy to dismiss and available when someone needs it.</p></article>
        <article><small>EDUCATION · PLANNED</small><h3>Make automation approachable</h3><p>Feature Cipher in YouTube videos, short walkthroughs, and team learning materials that explain how our tools work and how to use them confidently.</p></article>
        <article><small>SAFEGUARDS · PLANNED</small><h3>A familiar face at key checkpoints</h3><p>Use Cipher to introduce permission reviews, testing reminders, and launch approvals—helping the team understand what is being checked and who makes the decision.</p></article>
        <article><small>STATUS GUIDANCE · PLANNED</small><h3>Help the team see what matters</h3><p>Pair Cipher with verified automation status and clear explanations of what needs attention, when it was last checked, and what the team can do next.</p></article>
        <article><small>OUR APPROACH</small><h3>Reassurance backed by evidence</h3><p>Cipher’s presence should make security easier to understand. A reassuring message belongs alongside a real check, a clear result, and a person responsible for the next step.</p></article>
      </section>
      <section className="cipher-sentinel-note"><img src="/cipher-bearagon.png" alt="" aria-hidden="true" /><div><small>SENTINEL PRINCIPLE</small><h2>Clear guidance. Human decisions.</h2><p>Cipher helps us explain the safeguards around our work. Permissions, approvals, and verified system checks remain visible, with our team in control. That’s how a friendly guide earns trust.</p></div></section>
    </div>
  </main></AppShell>;
}
