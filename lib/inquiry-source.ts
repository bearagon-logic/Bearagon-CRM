/** A display label only; the saved inquiry channel remains unchanged. */
export function inquirySourceLabel(source: string, sourceRef?: string | null): string {
  if (source === "website" && sourceRef) {
    try {
      const url = new URL(sourceRef);
      if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) {
        if (["aisprawlcleanup.com", "www.aisprawlcleanup.com"].includes(url.hostname)) return "AI Sprawl Cleanup";
        if (["bearagon.com", "www.bearagon.com"].includes(url.hostname)) return "Bearagon website";
      }
    } catch { /* Historical or missing references retain their original channel. */ }
  }
  return ({ website: "Website", retell: "Phone", phone: "Phone", email: "Email", referral: "Referral", other: "Other" } as Record<string, string>)[source] || source;
}
