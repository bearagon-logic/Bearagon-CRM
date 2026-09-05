"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppShell } from "@/components/app-shell";

type Service = { name: string; icon: string; description: string; defaultState: string; trigger: string; action: string; draftOnly?: boolean; draftProduct?: string; permissionName?: string };
const services: Service[] = [
  { name: "Bearagon.com", icon: "B", description: "Receive verified website intake submissions.", defaultState: "Ready to configure", trigger: "A visitor submits the onboarding form", action: "Create a client record for review" },
  { name: "Google Workspace", icon: "G", description: "Create Gmail drafts for welcome emails and follow-ups.", defaultState: "Draft only selected", trigger: "A client moves into onboarding", action: "Prepare a Gmail draft for Derek to review and send", draftOnly: true, draftProduct: "Gmail", permissionName: "Gmail draft scope" },
  { name: "Microsoft 365", icon: "M", description: "Create Outlook drafts with sending explicitly disabled.", defaultState: "Permission plan ready", trigger: "A Microsoft 365 client moves into onboarding", action: "Prepare an Outlook draft for an authorized person to review and send", draftOnly: true, draftProduct: "Outlook", permissionName: "Mail.ReadWrite (delegated)" },
  { name: "Calendar", icon: "□", description: "Coordinate discovery calls and launch dates.", defaultState: "Not connected", trigger: "A discovery call is approved", action: "Offer approved meeting times" },
  { name: "Accounting", icon: "$", description: "Track onboarding payment milestones.", defaultState: "Not connected", trigger: "An onboarding payment is recorded", action: "Update the client payment milestone" },
];
const stepNames = ["Purpose", "Permissions", "Safe test", "Complete"];

export default function Connections() {
  const [states, setStates] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Service | null>(null);
  const [step, setStep] = useState(0);
  const [testing, setTesting] = useState(false);
  const [testPassed, setTestPassed] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("bearagon-connection-states");
      if (saved) setStates(JSON.parse(saved));
    } catch {}
  }, []);

  function openSetup(service: Service) {
    setSelected(service);
    setStep(0);
    setTesting(false);
    setTestPassed(false);
  }
  function runTest() {
    setTesting(true);
    window.setTimeout(() => {
      setTesting(false);
      setTestPassed(true);
      setStep(3);
    }, 700);
  }
  function finish() {
    if (!selected) return;
    const next = { ...states, [selected.name]: selected.draftOnly ? "Draft only configured" : "Demo configured" };
    setStates(next);
    try { window.localStorage.setItem("bearagon-connection-states", JSON.stringify(next)); } catch {}
    setSelected(null);
  }

  return <AppShell><main className="connections-page">
    <section className="connections-hero">
      <div><small>SECURE CONNECTIONS</small><h1>Connected services</h1><p>Open any service and walk through its complete guarded setup.</p></div>
      <a href="/automations">View automations →</a>
    </section>
    <div className="connections-content">
      <section className="connection-grid" id="service-connections">
        {services.map((service) => {
          const configured = Boolean(states[service.name]?.includes("configured"));
          return <article className="connection-card" key={service.name}>
            <i>{service.icon}</i>
            <div><h2>{service.name}</h2><p>{service.description}</p></div>
            <span className={configured ? "configured" : ""}>{states[service.name] || service.defaultState}</span>
            <button className="connection-action" onClick={() => openSetup(service)}>{configured ? "Review setup" : "Build connection"} →</button>
          </article>;
        })}
      </section>
      <section className="connection-safety" id="connection-safety"><img src="/cipher-bearagon.png" alt="" aria-hidden="true"/><div><small>CIPHER SECURITY</small><h2>Nothing connects without review</h2><p>Each connection receives only the minimum permissions needed for its approved workflow.</p></div></section>
    </div>

    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
      <DialogContent className="connection-dialog">
        {selected && <>
          <DialogHeader>
            <small>DEMO CONNECTION BUILDER</small>
            <DialogTitle>Connect {selected.name}</DialogTitle>
            <DialogDescription>This guided preview does not request credentials or contact an outside service.</DialogDescription>
          </DialogHeader>
          <div className="setup-progress" aria-label={`Step ${step + 1} of 4`}>
            {stepNames.map((name, index) => <span key={name} className={index <= step ? "current" : ""}><i>{index < step ? "✓" : index + 1}</i><b>{name}</b></span>)}
          </div>
          <div className="setup-step">
            {step === 0 && <><small>WHAT THIS CONNECTION DOES</small><h3>{selected.trigger}</h3><p>When this happens, Bearagon will <b>{selected.action.toLowerCase()}</b>. No action is sent automatically during this demo.</p><div className="flow-preview"><span>Trigger</span><i>→</i><span>Approval</span><i>→</i><span>Action</span></div></>}
            {step === 1 && <><small>PERMISSION REVIEW</small><h3>{selected.draftOnly ? `${selected.draftProduct} draft access only` : "Minimum access only"}</h3><p>{selected.draftOnly ? `Bearagon may prepare onboarding drafts using ${selected.permissionName}. An authorized person must review and press Send inside ${selected.draftProduct}.` : "The production connection will be restricted to onboarding activity and reviewed before activation."}</p><div className="permission-checks"><label><input type="checkbox" checked readOnly/> {selected.draftOnly ? `Create ${selected.draftProduct} drafts` : "Read onboarding events"}</label><label><input type="checkbox" checked readOnly/> Record activity in the audit log</label><label className="denied"><input type="checkbox" disabled/> {selected.draftOnly ? "Request sending permission" : "Broad account access"}</label><label className="denied"><input type="checkbox" disabled/> {selected.draftOnly ? "Delete, move, or edit unrelated messages" : "Unapproved outside actions"}</label></div></>}
            {step === 2 && <><small>SAFE CONNECTION TEST</small><h3>{selected.draftOnly ? `Create a simulated ${selected.draftProduct} draft` : "Test without changing client data"}</h3><p>{selected.draftOnly ? "The test confirms the workflow stops at a draft. It cannot send an email." : "A simulated event will verify the trigger, approval gate, and action path. Nothing leaves this CRM."}</p><button className="run-connection-test" onClick={runTest} disabled={testing}>{testing ? "Running safe test…" : "Run safe test"}</button></>}
            {step === 3 && <><small>TEST RESULT</small><div className="connection-success">✓</div><h3>{testPassed ? "All guardrails passed" : "Setup ready for review"}</h3><p>{testPassed ? "The simulated trigger reached the approval gate and stopped before an external action." : "This saved demo can be reopened whenever you want to review it."}</p></>}
          </div>
          <DialogFooter className="connection-footer">
            <button className="secondary-action" onClick={() => step === 0 ? setSelected(null) : setStep(step - 1)}>{step === 0 ? "Cancel" : "Back"}</button>
            {step < 2 && <button className="primary-action" onClick={() => setStep(step + 1)}>Continue</button>}
            {step === 3 && <button className="primary-action" onClick={finish}>Save demo setup</button>}
          </DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </main></AppShell>;
}
