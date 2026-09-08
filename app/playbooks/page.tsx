import { AppShell } from "@/components/app-shell";
import { serviceCatalog, guideRevision } from "@/lib/service-catalog";

export default function Playbooks() {
  return <AppShell><main className="lane-page"><header className="lane-header"><div><small>EMPLOYEE FIELD GUIDE</small><h1>Playbooks</h1><p>Scope thoughtfully. Build in the harness. Verify with evidence.</p></div></header><div className="lane-body">
    <p className="lane-note">Guide revision {guideRevision}. These are delivery starting points, not installed automations or a promise that every service is included. The company’s accepted scope remains authoritative.</p>
    <div className="lane-guide-grid">{serviceCatalog.map(service => <article className="lane-panel lane-guide" key={service.id}><small>{service.tier === "base" ? "BASE CAPABILITY" : "OPTIONAL ADD-ON"}</small><h2>{service.name}</h2><p>{service.summary}</p><details><summary>Scope, safeguards & delivery steps</summary><p>{service.guidance}</p><h3>Establish with the company</h3><dl>{service.fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{field.hint || field.options?.join(" / ")}</dd></div>)}</dl><h3>Delivery starting point</h3><ol>{service.steps.map(step => <li key={step}>{step}</li>)}</ol><p className="lane-note">Record the actual harness/build reference and test evidence in the company’s delivery plan. This guide does not execute those steps.</p></details></article>)}</div>
  </div></main></AppShell>;
}
