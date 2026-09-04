import { z } from "zod";

export type PlatformWorkspaceRef = {
  id: string;
  name: string;
  accent?: string;
};

export const platformAutomationSchema = z.object({
  slug: z.string(),
  title: z.string(),
  does_what: z.string().nullable().optional(),
  workflow_keys: z.array(z.string()).optional(),
  connector_names: z.array(z.string()).optional(),
  source: z.string().nullable().optional(),
  runner: z.string().nullable().optional(),
  cadence: z.string().nullable().optional(),
  expected_run_minutes: z.number().nullable().optional(),
  lifecycle: z.enum(["active", "paused"]),
  health: z.object({
    state: z.enum([
      "paused",
      "not_run",
      "running",
      "healthy",
      "warning",
      "attention",
      "overdue",
    ]),
    label: z.string(),
  }),
  last_run: z.record(z.string(), z.unknown()).nullable().optional(),
}).passthrough();

export const platformRunSchema = z.object({
  id: z.string(),
  automation_id: z.string(),
  automation_slug: z.string(),
  status: z.enum(["running", "succeeded", "failed", "partial", "skipped"]),
  started_at: z.string(),
  finished_at: z.string().nullable().optional(),
}).passthrough();

export const platformConnectorSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  label: z.string(),
  lifecycle: z.enum(["not_connected", "connecting", "live", "paused"]),
  health: z.enum(["ok", "degraded", "down", "unchecked"]).nullable().optional(),
  state: z.enum([
    "not_set_up",
    "paused",
    "attention",
    "working",
    "unverified",
  ]),
}).passthrough();

export type PlatformAutomation = z.infer<typeof platformAutomationSchema>;
export type PlatformRun = z.infer<typeof platformRunSchema>;
export type PlatformConnector = z.infer<typeof platformConnectorSchema>;

export function validatedPlatformList<T>(
  payload: unknown,
  key: string,
  schema: z.ZodType<T>,
): T[] {
  const candidate = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)[key]
      : undefined;
  const result = z.array(schema).safeParse(candidate);
  if (!result.success) throw new Error(`platform_contract_invalid:${key}`);
  return result.data;
}

export type WorkspaceAutomationOverview = {
  consoleClientId: string;
  automations: PlatformAutomation[];
  runs: PlatformRun[];
  connectors: PlatformConnector[];
  fetchedAt: string;
};
