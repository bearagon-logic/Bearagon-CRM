"use client";

import Link from "next/link";
import { AppearanceControls, PlaidScene } from "./appearance-controls";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  BookOpen,
  ListTodo,
  Building2,
  ChevronRight,
  ClipboardCheck,
  Menu,
  Plus,
  Plug,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { workspaceDestination } from "@/lib/workspace-model";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Building2;
  exact?: boolean;
};

const workspaceItems: NavItem[] = [
  { href: "/", label: "Work queue", icon: ListTodo, exact: true },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/onboarding", label: "Onboarding", icon: ClipboardCheck },
  { href: "/operations", label: "Operations", icon: Zap },
  { href: "/playbooks", label: "Playbooks", icon: BookOpen },
];

const systemItems: NavItem[] = [
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/security", label: "Security reference", icon: ShieldCheck },
  { href: "/cipher", label: "Cipher", icon: Bot },
];

function isCurrent(pathname: string, item: NavItem) {
  if (item.exact) return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({ item, pathname, close }: { item: NavItem; pathname: string; close: () => void }) {
  const Icon = item.icon;
  const current = isCurrent(pathname, item);
  return (
    <Link href={item.href} aria-label={item.label} title={item.label} className={current ? "active" : ""} aria-current={current ? "page" : undefined} onClick={close}>
      <Icon aria-hidden="true" />
      <span>{item.label}</span>
      <ChevronRight className="ops-nav-chevron" aria-hidden="true" />
    </Link>
  );
}

export function AppShell({ children, activeSection }: { children: React.ReactNode; activeSection?: string }) {
  const pathname = usePathname();
  const activePath = activeSection || workspaceDestination(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="ops-app-shell">
      <aside className={menuOpen ? "ops-sidebar menu-open" : "ops-sidebar"}>
        <div className="ops-sidebar-top">
          <Link href="/" className="ops-brand" aria-label="Bearagon Ops work queue">
            <img src="/cipher-bearagon.png" alt="Cipher, the Bearagon bear" />
            <span><b>BEARAGON</b><small>OPS</small></span>
          </Link>
          <button className="ops-menu-button" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        <Link href="/companies?newAccount=1" aria-label="Add company" title="Add company" className="ops-add-account" onClick={() => setMenuOpen(false)}><Plus aria-hidden="true" /><span>Add company</span></Link>
        <nav className="ops-navigation" aria-label="Operations navigation">
          <div className="ops-nav-group"><small>WORKSPACE</small>{workspaceItems.map((item) => <NavLink key={item.label} item={item} pathname={activePath} close={() => setMenuOpen(false)} />)}</div>
          <div className="ops-nav-group ops-nav-system"><small>RESOURCES & SETTINGS</small>{systemItems.map((item) => <NavLink key={item.label} item={item} pathname={activePath} close={() => setMenuOpen(false)} />)}</div>
        </nav>
        <div className="ops-sidebar-bottom">
          <AppearanceControls/>
          <div className="ops-sidebar-footer"><span className="ops-operator-avatar">BO</span><span><b>Bearagon operator</b><small>Authenticated access</small></span></div>
        </div>
      </aside>
      <div className="ops-app-main"><PlaidScene/>{children}</div>
    </div>
  );
}
