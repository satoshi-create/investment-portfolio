"use client";

import { usePathname } from "next/navigation";

/**
 * Lightweight route transition: short opacity ease (no Framer Motion dependency).
 * Pairs with `.cockpit-route-fade` in globals.css.
 */
export function CockpitRouteFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  return (
    <div key={pathname} className="cockpit-route-fade min-h-0">
      {children}
    </div>
  );
}
