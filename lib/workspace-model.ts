export type CompanyRecord = { id: string; companyName: string; organizationKind?: string; relationshipOwner?: string; stage: string; onboardingStatus: string; workspaceStatus: string; nextStep: string; dueDate: string };
export type InquiryRecord = { id: string; accountId: string; companyName: string; status: string; owner: string; nextAction: string; followUpDate: string; updatedAt: string };
export type DeliveryRecord = { organizationKind?:string; id: string; accountId: string; accountName: string; status: string; stage: string; owner: string; nextStep: string; readiness?: {label:string}; targetDate: string; blocked: number; open: number };
export type DecisionRecord = { id: string; clientId: string; clientName: string; status: string; title: string; requestedBy: string };
export type QueueItem = { id: string; company: string; title: string; owner: string; due: string; kind: string; href: string; priority: number };

export function workspaceDestination(path: string, tab = "", ongoing = false) {
  if (path.startsWith("/clients/")) return ["onboarding", "delivery"].includes(tab.toLowerCase()) ? "/onboarding" : ongoing && ["automations", "services"].includes(tab.toLowerCase()) ? "/operations" : "/companies";
  if (path === "/accounts/onboarding") return "/onboarding";
  if (path.startsWith("/automations")) return "/operations";
  if (["/approvals", "/communications"].includes(path)) return "/";
  return path;
}

export function isOngoing(company: CompanyRecord) {
  // A live stage alone is not completed onboarding. A cancelled plan is not live service.
  return company.stage.toLowerCase() === "live" && company.onboardingStatus === "completed";
}

export function queueItems(inquiries: InquiryRecord[], deliveries: DeliveryRecord[], decisions: DecisionRecord[], today: string): QueueItem[] {
  const overdue = (date: string) => Boolean(date && date < today);
  const rows: QueueItem[] = [
    ...inquiries.filter(i => i.status !== "closed").map(i => ({ id: `inquiry:${i.id}`, company: i.companyName, title: i.nextAction || "Review inquiry and assign the next action", owner: i.owner || "Unassigned", due: i.followUpDate, kind: "Inquiry", href: `/communications?inquiry=${encodeURIComponent(i.id)}`, priority: overdue(i.followUpDate) ? 0 : i.status === "new" ? 1 : 3 })),
    ...deliveries.filter(d => d.organizationKind!=='internal').filter(d => ["planned", "active", "blocked"].includes(d.status)).map(d => ({ id: `delivery:${d.id}`, company: d.accountName, title: d.readiness?.label || "Review saved delivery plan", owner: d.owner || "Unassigned", due: d.targetDate, kind: d.blocked > 0 || d.status === "blocked" ? "Blocked delivery" : "Delivery", href: `/clients/${encodeURIComponent(d.accountId)}?tab=onboarding`, priority: d.blocked > 0 || d.status === "blocked" || overdue(d.targetDate) ? 0 : 3 })),
    ...decisions.filter(d => d.status.toLowerCase() === "pending").map(d => ({ id: `decision:${d.id}`, company: d.clientName, title: d.title, owner: "Bearagon reviewer", due: "", kind: "Approval", href: `/approvals?request=${encodeURIComponent(d.id)}`, priority: 1 })),
  ];
  return rows.sort((a,b) => a.priority - b.priority || (a.due || "9999").localeCompare(b.due || "9999") || a.company.localeCompare(b.company) || a.id.localeCompare(b.id));
}
