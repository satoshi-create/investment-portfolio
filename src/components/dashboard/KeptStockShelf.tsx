"use client";

import React from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";

import type { ThemeEcosystemWatchItem } from "@/src/types/investment";
import { cn } from "@/src/lib/cn";

export function KeptStockShelf(props: {
  themeName: string;
  items: ThemeEcosystemWatchItem[];
}) {
  const { themeName, items } = props;
  const kept = items.filter((e) => e.isKept);
  if (kept.length === 0) return null;

  return (
    <section
      aria-labelledby="kept-stock-shelf-heading"
      className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 md:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl border border-amber-500/35 bg-amber-500/10 flex items-center justify-center shrink-0">
          <Bookmark size={18} className="text-amber-300" fill="currentColor" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="kept-stock-shelf-heading" className="text-xs font-bold uppercase tracking-wider text-amber-200/90">
            キープした投資候補
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            テーマ「{themeName}」でブックマークした銘柄。タイミング到来時にすぐ辿れます。
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {kept.map((e) => {
              const label = e.companyName.trim().length > 0 ? e.companyName : e.ticker;
              const displayTicker =
                e.isUnlisted && e.proxyTicker ? `${e.ticker} → ${e.proxyTicker}` : e.ticker;
              return (
                <li key={e.id}>
                  <Link
                    href={`#eco-row-${e.id}`}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
                      "border-amber-500/35 bg-slate-950/50 hover:bg-slate-900/70 hover:border-amber-400/45",
                    )}
                  >
                    <span className="font-mono text-xs font-bold text-slate-100">{displayTicker}</span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[12rem]" title={label}>
                      {label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
