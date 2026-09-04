import { env } from "cloudflare:workers";
import { getChatGPTUser, type ChatGPTUser } from "../../app/chatgpt-auth";

export type OperatorIdentity = ChatGPTUser;

const localDevelopmentOperator: OperatorIdentity | null = import.meta.env.DEV
  ? {
      userId: "local-development-operator",
      displayName: "Local operator",
      email: "local@bearagon.invalid",
      fullName: "Local operator",
    }
  : null;

function configuredOperatorEmails() {
  const value = (env as unknown as { BEARAGON_OPERATOR_EMAILS?: string })
    .BEARAGON_OPERATOR_EMAILS;
  return new Set(
    String(value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function getOperatorIdentity(
  _request: Request,
): Promise<OperatorIdentity | null> {
  void _request;
  if (localDevelopmentOperator) return localDevelopmentOperator;
  const user = await getChatGPTUser();
  if (!user) return null;
  const allowedEmails = configuredOperatorEmails();
  return allowedEmails.has(user.email.trim().toLowerCase()) ? user : null;
}

export function operatorRequiredResponse() {
  return Response.json(
    { error: "An authenticated Bearagon operator is required." },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}

export function auditActor(actor: OperatorIdentity) {
  return {
    actorId: actor.userId,
    actorEmail: actor.email,
    actorName: actor.displayName,
  };
}
