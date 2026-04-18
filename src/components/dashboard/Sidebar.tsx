"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText, Layers, Menu, Radio, ScrollText, X } from "lucide-react";

const NAV = [
  { href: "/", label: "Portfolio", Icon: BarChart3, active: (p: string) => p === "/" },
  {
    href: "/themes",
    label: "Themes",
    Icon: Layers,
    active: (p: string) => p === "/themes" || p.startsWith("/themes/"),
  },
  { href: "/signals", label: "Signals", Icon: Radio, active: (p: string) => p === "/signals" },
  {
    href: "/trade-history",
    label: "Trade History",
    Icon: ScrollText,
    active: (p: string) => p === "/trade-history",
  },
  {
    href: "/logs",
    label: "Logs",
    Icon: FileText,
    active: (p: string) => p === "/logs",
  },
] as const;

export function Sidebar({
  onNavigate,
  onToggleCollapse,
  collapsed,
}: {
  onNavigate?: () => void;
  /** Desktop: collapse sidebar width via parent */
  onToggleCollapse?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname() ?? "";

  return (
    <aside className="flex w-[13.5rem] shrink-0 flex-col border-r border-border bg-card/40 backdrop-blur-sm">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Cockpit</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Portfolio OS</p>
          </div>
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:inline-flex items-center justify-center rounded-lg border border-border bg-card/50 p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <Menu className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
            </button>
          ) : null}
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Primary">
        {NAV.map(({ href, label, Icon, active }) => {
          const isActive = active(pathname);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
