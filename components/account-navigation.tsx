import Link from "next/link";
import { Building2, ListChecks } from "lucide-react";

export function AccountNavigation({ current }: { current: "directory" | "delivery" }) {
  return <nav className="account-section-nav" aria-label="Account workspace">
    <div className="account-nav-track">
      <Link href="/" className={current === "directory" ? "active" : ""} aria-current={current === "directory" ? "page" : undefined}><Building2 aria-hidden="true" /><span>Directory</span></Link>
      <Link href="/accounts/onboarding" className={current === "delivery" ? "active" : ""} aria-current={current === "delivery" ? "page" : undefined}><ListChecks aria-hidden="true" /><span>Delivery queue</span></Link>
    </div>
  </nav>;
}
