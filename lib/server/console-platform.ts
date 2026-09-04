import { env } from "cloudflare:workers";
import {
  platformAutomationSchema,
  platformConnectorSchema,
  platformRunSchema,
  validatedPlatformList,
  type PlatformAutomation,
  type PlatformConnector,
  type PlatformRun,
  type WorkspaceAutomationOverview,
} from "../contracts/platform";

type PlatformEnvironment = {
  CONSOLE_API_URL?: string;
  CONSOLE_READ_TOKEN?: string;
};

function configuration() {
  const runtime = env as unknown as PlatformEnvironment;
  const apiUrl = runtime.CONSOLE_API_URL?.trim().replace(/\/+$/, "");
  const token = runtime.CONSOLE_READ_TOKEN?.trim();
  return apiUrl && token ? { apiUrl, token } : null;
}

async function platformGet<T>(path: string): Promise<T> {
  const config = configuration();
  if (!config) throw new Error("platform_not_configured");
  const response = await fetch(`${config.apiUrl}${path}`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.token}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`platform_request_failed:${response.status}`);
  }
  return (await response.json()) as T;
}

export function consolePlatformConfigured() {
  return Boolean(configuration());
}

export async function getPlatformFleet() {
  return platformGet<unknown>("/v1/fleet");
}

export async function getWorkspaceAutomationOverview(
  consoleClientId: string,
): Promise<WorkspaceAutomationOverview> {
  const client = encodeURIComponent(consoleClientId);
  const [automationsPayload, runsPayload, connectorsPayload] = await Promise.all([
    platformGet<unknown>(`/v1/automations?client=${client}`),
    platformGet<unknown>(`/v1/runs?client=${client}&limit=200`),
    platformGet<unknown>(`/v1/connectors?client=${client}`),
  ]);

  return {
    consoleClientId,
    automations: validatedPlatformList<PlatformAutomation>(
      automationsPayload,
      "automations",
      platformAutomationSchema,
    ),
    runs: validatedPlatformList<PlatformRun>(
      runsPayload,
      "runs",
      platformRunSchema,
    ),
    connectors: validatedPlatformList<PlatformConnector>(
      connectorsPayload,
      "connectors",
      platformConnectorSchema,
    ),
    fetchedAt: new Date().toISOString(),
  };
}
