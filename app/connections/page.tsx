"use client";
import { AppShell } from "@/components/app-shell";
import { ConsoleConnection } from "@/components/console-connection";
export default function Connections() {
  return <AppShell><main className="services-page"><header><small>CONFIGURATION</small><h1>Connections</h1><p>Connect CRM accounts to their Console workspaces. Purchased scope and automation health live in each company’s Services &amp; automations tab.</p></header><ConsoleConnection /><article className="service-panel"><h2>Client system connections</h2><p>Email, calendar, accounting, and other client systems are configured through the delivery system. Their reported connection health appears alongside that company’s services when Console is connected.</p></article></main></AppShell>;
}
