"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  Building2,
  CheckSquare,
  ChevronRight,
  ClipboardCheck,
  Menu,
  MessageSquare,
  Plus,
  Plug,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Building2;
  exact?: boolean;
};

const workspaceItems: NavItem[] = [
  { href: "/", label: "Accounts", icon: Building2, exact: true },
  { href: "/#onboarding", label: "Onboarding", icon: CheckSquare },
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/communications", label: "Inbox", icon: MessageSquare },
];

const systemItems: NavItem[] = [
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/security", label: "Security", icon: ShieldCheck },
  { href: "/cipher", label: "Cipher", icon: Bot },
];

function isCurrent(pathname: string, item: NavItem) {
  if (item.exact) return pathname === "/" || pathname.startsWith("/clients/");
  if (item.href.includes("#")) return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({ item, pathname, close }: { item: NavItem; pathname: string; close: () => void }) {
  const Icon = item.icon;
  const current = isCurrent(pathname, item);
  return (
    <Link href={item.href} className={current ? "active" : ""} aria-current={current ? "page" : undefined} onClick={close}>
      <Icon aria-hidden="true" />
      <span>{item.label}</span>
      <ChevronRight className="ops-nav-chevron" aria-hidden="true" />
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="ops-app-shell">
      <aside className={menuOpen ? "ops-sidebar menu-open" : "ops-sidebar"}>
        <div className="ops-sidebar-top">
          <Link href="/" className="ops-brand" aria-label="Bearagon Ops accounts">
            <img src="/cipher-bearagon.png" alt="Cipher, the Bearagon bear" />
            <span><b>BEARAGON</b><small>OPS</small></span>
          </Link>
          <button className="ops-menu-button" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        <Link href="/?newAccount=1" className="ops-add-account" onClick={() => setMenuOpen(false)}><Plus aria-hidden="true" /><span>Add account</span></Link>
        <nav className="ops-navigation" aria-label="Operations navigation">
          <div className="ops-nav-group"><small>WORKSPACE</small>{workspaceItems.map((item) => <NavLink key={item.label} item={item} pathname={pathname} close={() => setMenuOpen(false)} />)}</div>
          <div className="ops-nav-group ops-nav-system"><small>CONFIGURE</small>{systemItems.map((item) => <NavLink key={item.label} item={item} pathname={pathname} close={() => setMenuOpen(false)} />)}</div>
        </nav>
        <div className="ops-sidebar-footer"><span className="ops-operator-avatar">BO</span><span><b>Bearagon operator</b><small>Authenticated access</small></span></div>
      </aside>
      <div className="ops-app-main">{children}</div>
    </div>
  );
}
