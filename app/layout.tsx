import type { Metadata } from "next";
import "./globals.css";
import "./ops-ui.css";

export const metadata: Metadata = {
  title: {
    default: "Bearagon Ops",
    template: "%s | Bearagon Ops",
  },
  description:
    "Bearagon's operator workspace for accounts, onboarding, and automation delivery.",
  applicationName: "Bearagon Ops",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
