import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { workspaces } from "../../../../db/schema";
import {
  consolePlatformConfigured,
  getWorkspaceAutomationOverview,
} from "../../../../lib/server/console-platform";
import {
  getOperatorIdentity,
  operatorRequiredResponse,
} from "../../../../lib/server/operator-auth";

export async function GET(request: Request) {
  const actor = await getOperatorIdentity(request);
  if (!actor) return operatorRequiredResponse();
  const accountId = new URL(request.url).searchParams.get("accountId")?.trim();
  if (!accountId) {
    return Response.json(
      { error: "Account is required." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const [workspace] = await getDb()
      .select()
      .from(workspaces)
      .where(eq(workspaces.accountId, accountId))
      .limit(1);
    if (!workspace?.consoleClientId) {
      return Response.json(
        {
          state: "not_linked",
          workspace: workspace ?? null,
          message: "No Bearagon Console workspace has been linked yet.",
        },
        { headers: { "cache-control": "no-store" } },
      );
    }
    if (!consolePlatformConfigured()) {
      return Response.json(
        {
          state: "not_configured",
          workspace,
          message: "The server-side Console read adapter is not configured.",
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const overview = await getWorkspaceAutomationOverview(
      workspace.consoleClientId,
    );
    return Response.json(
      { state: "connected", workspace, overview },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to read Console platform status", error);
    return Response.json(
      {
        state: "unavailable",
        message: "Console status is temporarily unavailable.",
      },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
