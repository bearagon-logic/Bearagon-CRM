import { AppShell } from "@/components/app-shell";
import { serviceCatalog, guideRevision } from "@/lib/service-catalog";
import Link from 'next/link';

export default function Playbooks() {
  return (
    <AppShell activeSection="/playbooks">
      <main className="lane-page playbooks-page">
        <header className="lane-header">
          <div>
            <small>EMPLOYEE FIELD GUIDE</small>
            <h1>Playbooks</h1>
            <p>Scope thoughtfully. Build in the harness. Verify with evidence.</p>
          </div>
        </header>

        <div className="lane-body">
          <p className="lane-note">
            Guide revision {guideRevision}. These are delivery starting points, not installed automations or a promise that every service is included. The company’s accepted scope remains authoritative.
          </p>

          <section className="lane-panel playbooks-hero">
            <div className="playbooks-hero-content">
              <span className="playbooks-hero-badge">FEATURED GUIDED PLAYBOOK · CODEX READY</span>
              <h2>Guided Email assistance setup</h2>
              <p>Google Workspace and Microsoft 365 routes now include saved configuration, step-by-step instructions, work notes and evidence. Open a company’s Build & test (or internal Automation work), then choose Start guided email setup beside Email assistance.</p>
              <p className="playbooks-hero-disclaimer">This pilot guides a human builder; it does not connect accounts, send messages or deploy a workflow. Other services retain their reference guides below.</p>
              <div className="playbooks-hero-cta">
                <Link href="/companies" className="company-primary-link">Choose a company to start setup →</Link>
              </div>
            </div>
          </section>

          <div className="playbooks-catalog-header">
            <h2>Service Delivery Catalog</h2>
            <p>Reference guidance, scoping requirements, and implementation starting points across all Bearagon capabilities.</p>
          </div>

          <div className="lane-guide-grid">
            {serviceCatalog.map(service => (
              <article className="lane-panel lane-guide-card" key={service.id}>
                <div className="guide-card-head">
                  <span className={`guide-tier-badge ${service.tier === "base" ? "tier-base" : "tier-addon"}`}>
                    {service.tier === "base" ? "BASE CAPABILITY" : "OPTIONAL ADD-ON"}
                  </span>
                  <h2>{service.name}</h2>
                  <p className="guide-summary">{service.summary}</p>
                </div>
                <details className="guide-card-details">
                  <summary>Scope, safeguards & delivery steps</summary>
                  <div className="guide-details-body">
                    <p className="guide-guidance">{service.guidance}</p>
                    <div className="guide-section">
                      <h3>Establish with the company</h3>
                      <dl className="guide-dl">
                        {service.fields.map(field => (
                          <div key={field.key} className="guide-dl-row">
                            <dt>{field.label}</dt>
                            <dd>{field.hint || field.options?.join(" / ")}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <div className="guide-section">
                      <h3>Delivery starting point</h3>
                      <ol className="guide-steps">
                        {service.steps.map(step => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    <p className="lane-note">Record the actual harness/build reference and test evidence in the company’s delivery plan. This guide does not execute those steps.</p>
                  </div>
                </details>
              </article>
            ))}
          </div>
        </div>
      </main>
    </AppShell>
  );
}

