"use client";

import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AppShell } from "@/components/app-shell";

const auditEvents = [
  { time: "Today, 9:42 AM", event: "Gmail draft-only policy selected", actor: "Derek Manchego", result: "Approved" },
  { time: "Today, 9:39 AM", event: "Safe connection test completed", actor: "Cipher", result: "Passed" },
  { time: "Yesterday, 4:15 PM", event: "Automation Center guardrails reviewed", actor: "Derek Manchego", result: "Approved" },
  { time: "Yesterday, 3:58 PM", event: "Owner-only access confirmed", actor: "Bearagon", result: "Passed" },
];

export default function SecurityCenter() {
  const [paused, setPaused] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(true);
  return <AppShell><main className="security-page">
    <section className="security-hero">
      <div><small>SECURITY & PERMISSIONS</small><h1>Security reference</h1><p>Our standards for careful, permission-aware automation.</p></div>
      <button className={paused ? "resume-all" : "pause-all"} onClick={() => setPaused(!paused)}>{paused ? "Clear demo pause" : "Preview pause control"}</button>
    </section>
    {paused && <div className="security-paused"><b>Demo pause state enabled.</b><span>This page has not sent a runtime pause command. Use the Automation workspace to record a pause request and wait for harness acknowledgement.</span></div>}
    <p className="security-reference"><b>Reference page—not live security monitoring.</b> Connections, permissions, activity and controls below are illustrative examples. They do not inspect providers, revoke access or pause a running automation. Check actual configuration in Connections and each company’s Services page.</p>
    <div className="security-content">
      <section className="security-metrics">
        <article><small>SECURITY POSTURE</small><strong>Not assessed</strong><span>Reference only</span></article>
        <article><small>EXAMPLE CONNECTIONS</small><strong>{gmailConnected ? "1" : "0"}</strong><span>Illustrative, not detected</span></article>
        <article><small>SENDING POLICY</small><strong>Draft first</strong><span>Confirm per implementation</span></article>
        <article><small>LIVE WARNINGS</small><strong>Not monitored</strong><span>No live security feed here</span></article>
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
          <small>CORE PROTECTIONS</small><h2>Implementation standards</h2>
          <div className="protection-item"><i>01</i><span><b>Minimum access</b><small>Every app receives only the scopes its workflow requires.</small></span></div>
          <div className="protection-item"><i>02</i><span><b>Human approval</b><small>High-impact actions stop until an authorized person approves.</small></span></div>
          <div className="protection-item"><i>03</i><span><b>Activity history</b><small>Tests, approvals, and configuration changes are recorded.</small></span></div>
          <div className="protection-item"><i>04</i><span><b>Controlled intervention</b><small>Pause requests and connection changes are recorded separately from runtime acknowledgement.</small></span></div>
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
  </main></AppShell>;
}
