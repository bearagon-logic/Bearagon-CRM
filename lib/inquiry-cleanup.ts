export const cleanupPrefix = (kind: "test" | "spam") => kind === "test" ? "[Test submission]" : "[Spam]";
export function isJunkInquiry(inquiry: {status: string; resolution?: string}) {
  return inquiry.status === "closed" && /^(\[Test submission\]|\[Spam\]) /.test(inquiry.resolution || "");
}
