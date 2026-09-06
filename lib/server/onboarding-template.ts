export const onboardingTemplate = [
  { key: "agreement", title: "Agreement signed", description: "Record the signed agreement or approved scope reference.", dependsOn: [] },
  { key: "discovery", title: "Discovery form completed", description: "Capture the delivery requirements, owners, and success measures.", dependsOn: ["agreement"] },
  { key: "communications", title: "Email and calendar connected", description: "Verify the required communication paths or document an approved waiver.", dependsOn: ["discovery"] },
  { key: "business_system", title: "Accounting or payment system connected", description: "Verify the required financial-system connection or document an approved waiver.", dependsOn: ["discovery"] },
  { key: "guardrails", title: "Guardrails approved", description: "Record the approved boundaries, permissions, and escalation rules.", dependsOn: ["discovery"] },
  { key: "automation_build", title: "Automations built in the delivery harness", description: "Link the account-scoped installation or record the verified harness build reference.", dependsOn: ["communications", "business_system", "guardrails"] },
  { key: "client_test", title: "Client testing completed", description: "Record the client test result and any accepted exceptions.", dependsOn: ["automation_build"] },
  { key: "launch", title: "Launch approved", description: "Record the final launch decision after client testing succeeds.", dependsOn: ["client_test"] },
] as const;

export const onboardingTaskStatuses = ["pending", "in_progress", "blocked", "completed", "skipped"] as const;

export type OnboardingTaskStatus = (typeof onboardingTaskStatuses)[number];
export type OnboardingTaskKey = (typeof onboardingTemplate)[number]["key"];

const templateByKey = new Map<string, (typeof onboardingTemplate)[number]>(
  onboardingTemplate.map((task) => [task.key, task]),
);

export function taskTemplate(key: string) {
  return templateByKey.get(key);
}

export function isTerminalTaskStatus(status: string) {
  return status === "completed" || status === "skipped";
}

export function requirementsForStage(stage: string): OnboardingTaskKey[] {
  if (stage === "connections") return ["agreement", "discovery"];
  if (stage === "building") return ["agreement", "discovery", "communications", "business_system", "guardrails"];
  if (stage === "testing") return ["agreement", "discovery", "communications", "business_system", "guardrails", "automation_build"];
  if (stage === "live") return onboardingTemplate.map((task) => task.key);
  return [];
}
