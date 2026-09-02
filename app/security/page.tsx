"use client";

import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const auditEvents = [
  { time: "Today, 9:42 AM", event: "Gmail draft-only policy selected", actor: "Derek Manchego", result: "Approved" },
  { time: "Today, 9:39 AM", event: "Safe connection test completed", actor: "Cipher", result: "Passed" },
  { time: "Yesterday, 4:15 PM", event: "Automation Center guardrails reviewed", actor: "Derek Manchego", result: "Approved" },
  { time: "Yesterday, 3:58 PM", event: "Owner-only access confirmed", actor: "Bearagon", result: "Passed" },
];

export default function SecurityCenter() {
  const [paused, setPaused] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(true);
  return <main className="security-page">
    <header className="detail-top">
      <a href="/" className="detail-brand"><img src="/cipher-bearagon.png" alt="Cipher, the Bearagon bear"/><span><b>BEARAGON</b><small>SECURITY CENTER</small></span></a>
      <a href="/" className="back-link">← Back to dashboard</a>
    </header>
    <section className="security-hero">
      <div><small>SECURITY & PERMISSIONS</small><h1>Every action stays inside its guardrails.</h1><p>Review access, approval rules, and activity from one place.</p></div>
      <button className={paused ? "resume-all" : "pause-all"} onClick={() => setPaused(!paused)}>{paused ? "Resume guarded workflows" : "Emergency pause"}</button>
    </section>
    {paused && <div className="security-paused"><b>All workflows are paused.</b><span>No automated action can run until an administrator resumes them.</span></div>}
    <div className="security-content">
      <section className="security-metrics">
        <article><small>SECURITY POSTURE</small><strong>Protected</strong><span>Owner-only access</span></article>
        <article><small>CONNECTED APPS</small><strong>{gmailConnected ? "1" : "0"}</strong><span>Minimum permissions</span></article>
        <article><small>AUTOMATIC SENDING</small><strong>Off</strong><span>Draft-only policy</span></article>
        <article><small>OPEN WARNINGS</small><strong>0</strong><span>No action required</span></article>
      </section>
      <section className="security-grid" id="permissions">
        <article className="security-card permissions-panel">
          <div className="security-card-title"><div><small>APPLICATION ACCESS</small><h2>Connections & permissions</h2></div><a href="/connections">Manage connections →</a></div>
          {gmailConnected ? <div className="permission-app">
            <div className="permission-app-head"><i>G</i><span><b>Google Workspace</b><small>Configured for Gmail drafts</small></span><em>Draft only</em></div>
            <div className="scope-list"><span><i>✓</i>Create Gmail drafts</span><span><i>✓</i>Log approved onboarding activity</span><span className="blocked"><i>×</i>Send email automatically</span><span className="blocked"><i>×</i>Delete or reorganize messages</span></div>
            <div className="permission-meta"><span><small>OWNER</small><b>Derek Manchego</b></span><span><small>APPROVAL MODE</small><b>Human sends in Gmail</b></span><span><small>LAST REVIEW</small><b>Today</b></span></div>
            <AlertDialog>
              <AlertDialogTrigger asChild><button className="disconnect-action">Disconnect access</button></AlertDialogTrigger>
              <AlertDialogContent className="security-alert">
                <AlertDialogHeader><AlertDialogTitle>Disconnect Google Workspace?</AlertDialogTitle><AlertDialogDescription>This demonstration will remove Google Workspace from the security view and stop its draft workflow. It will not change your real Google account.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Keep connected</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => setGmailConnected(false)}>Disconnect demo</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div> : <div className="security-empty"><b>Google Workspace demo disconnected</b><span>No Gmail permissions are shown as active.</span><a href="/connections">Return to Connections</a></div>}
        </article>
        <aside className="security-card protection-panel">
          <small>CORE PROTECTIONS</small><h2>Always enforced</h2>
          <div className="protection-item"><i>01</i><span><b>Minimum access</b><small>Every app receives only the scopes its workflow requires.</small></span></div>
          <div className="protection-item"><i>02</i><span><b>Human approval</b><small>High-impact actions stop until an authorized person approves.</small></span></div>
          <div className="protection-item"><i>03</i><span><b>Activity history</b><small>Tests, approvals, and configuration changes are recorded.</small></span></div>
          <div className="protection-item"><i>04</i><span><b>Immediate control</b><small>Administrators can pause workflows and disconnect apps.</small></span></div>
        </aside>
      </section>
      <section className="security-card microsoft-panel">
        <div className="security-card-title"><div><small>MICROSOFT 365 PERMISSION PLAN</small><h2>Outlook draft-only access</h2></div><a href="/connections">Open setup →</a></div>
        <div className="microsoft-permission-grid">
          <div><i className="ms-mark">M</i><span><b>Mail.ReadWrite</b><small>Delegated permission required by Microsoft Graph to create and save an Outlook draft.</small></span><em>Required</em></div>
          <div><i className="allowed-mark">✓</i><span><b>Bearagon application policy</b><small>Limit use to approved onboarding drafts and record each draft creation.</small></span><em>Enforced</em></div>
          <div className="denied-permission"><i>×</i><span><b>Mail.Send</b><small>Not requested. Bearagon cannot send Outlook email through this connection.</small></span><em>Blocked</em></div>
          <div className="denied-permission"><i>×</i><span><b>Calendar access</b><small>Not bundled with email. Calendar will require a separate client-approved connection.</small></span><em>Separate</em></div>
        </div>
        <p className="permission-disclosure"><b>Plain-English disclosure:</b> Microsoft’s draft permission technically allows broader mailbox changes, so Bearagon adds a stricter policy layer that prohibits deleting, moving, or editing unrelated messages.</p>
      </section>
      <section className="security-card audit-panel" id="audit-history">
        <div className="security-card-title"><div><small>AUDIT HISTORY</small><h2>Recent security activity</h2></div><span>Demo activity</span></div>
        <div className="audit-table">
          <div className="audit-row audit-labels"><span>TIME</span><span>EVENT</span><span>ACTOR</span><span>RESULT</span></div>
          {auditEvents.map((item) => <div className="audit-row" key={item.event}><span>{item.time}</span><b>{item.event}</b><span>{item.actor}</span><em>{item.result}</em></div>)}
        </div>
      </section>
      <section className="security-note"><img src="/cipher-bearagon.png" alt="" aria-hidden="true"/><div><small>CIPHER’S SECURITY RULE</small><h2>Permission before automation.</h2><p>Connections remain limited, observable, and reversible throughout the client relationship.</p></div></section>
    </div>
  </main>;
}
