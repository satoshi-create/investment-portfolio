"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { useDashboardData } from "@/src/components/dashboard/DashboardDataContext";
import type { EcosystemWatchlistSearchItem, Stock } from "@/src/types/investment";
import { cn } from "@/src/lib/cn";

const MAX_RESULTS = 12;

function normalizeTickerKey(t: string): string {
  return t.trim().toUpperCase();
}

type SearchRow = { kind: "holding"; stock: Stock } | { kind: "ecosystem"; item: EcosystemWatchlistSearchItem };

export function CockpitStockSearch({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { data } = useDashboardData();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const stocks = data?.stocks ?? [];
  const ecosystem = data?.ecosystemWatchlistSearch ?? [];
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length === 0) return [] as SearchRow[];
    const rows: SearchRow[] = [];
    for (const s of stocks) {
      const tick = String(s.ticker ?? "").toLowerCase();
      const name = String(s.name ?? "").toLowerCase();
      if (tick.includes(t) || name.includes(t)) {
        rows.push({ kind: "holding", stock: s });
        if (rows.length >= MAX_RESULTS) return rows;
      }
    }
    for (const item of ecosystem) {
      const tick = item.ticker.toLowerCase();
      const cn = item.companyName.toLowerCase();
      const tn = item.themeName.toLowerCase();
      if (tick.includes(t) || cn.includes(t) || tn.includes(t)) {
        rows.push({ kind: "ecosystem", item });
        if (rows.length >= MAX_RESULTS) return rows;
      }
    }
    return rows;
  }, [q, stocks, ecosystem]);

  const pick = useCallback(
    (row: SearchRow) => {
      setQ("");
      setOpen(false);
      if (row.kind === "holding") {
        const key = normalizeTickerKey(String(row.stock.ticker ?? ""));
        if (!key) return;
        const href = `/?ticker=${encodeURIComponent(key)}`;
        if (pathname !== "/") {
          router.push(href);
        } else {
          router.replace(href, { scroll: false });
        }
        return;
      }
      const { themeName, memberId } = row.item;
      if (!themeName || !memberId) return;
      const path = `/themes/${encodeURIComponent(themeName)}`;
      router.push(`${path}#eco-row-${encodeURIComponent(memberId)}`);
    },
    [pathname, router],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative z-[70]", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 shadow-inner backdrop-blur-sm",
          compact ? "h-8 py-0" : "h-9 py-1",
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/90" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="銘柄・テーマで検索…"
          autoComplete="off"
          className={cn(
            "min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 outline-none",
            compact ? "py-0.5" : "py-1",
          )}
          aria-autocomplete="list"
          aria-expanded={open && filtered.length > 0}
        />
        {q.length > 0 ? (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="検索をクリア"
            onClick={() => {
              setQ("");
              setOpen(false);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {open && q.trim().length > 0 ? (
        <ul
          className="absolute left-0 right-0 top-[calc(100%+4px)] max-h-60 overflow-y-auto rounded-lg border border-border bg-popover/95 py-1 text-xs shadow-xl backdrop-blur-md z-[80]"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">該当なし</li>
          ) : (
            filtered.map((row) =>
              row.kind === "holding" ? (
                <li key={`h:${row.stock.id}`} role="option">
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted/80"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(row)}
                  >
                    <div className="flex w-full flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-foreground">{row.stock.ticker}</span>
                      <span className="rounded border border-cyan-500/35 bg-cyan-500/10 px-1.5 py-0 text-[9px] font-bold uppercase text-cyan-200/90">
                        保有
                      </span>
                    </div>
                    {row.stock.name ? (
                      <span className="line-clamp-1 text-[11px] text-muted-foreground">{row.stock.name}</span>
                    ) : null}
                  </button>
                </li>
              ) : (
                <li key={`e:${row.item.memberId}`} role="option">
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted/80"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(row)}
                  >
                    <div className="flex w-full flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-foreground">{row.item.ticker}</span>
                      <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0 text-[9px] font-bold uppercase text-violet-200/90">
                        観測
                      </span>
                    </div>
                    <span className="line-clamp-1 text-[11px] text-muted-foreground">{row.item.themeName}</span>
                    {row.item.companyName ? (
                      <span className="line-clamp-1 text-[10px] text-muted-foreground/90">{row.item.companyName}</span>
                    ) : null}
                  </button>
                </li>
              ),
            )
          )}
        </ul>
      ) : null}
    </div>
  );
}
