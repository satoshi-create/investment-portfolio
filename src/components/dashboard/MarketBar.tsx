import React from "react";

import type { MarketIndicator } from "@/src/types/investment";

function formatValue(label: string, value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (label === "USD/JPY") return value.toFixed(2);
  if (label === "10Y Yield" || label === "VIX") return value.toFixed(2);
  if (label === "Crude (USO)") return value.toFixed(2);
  if (value >= 10_000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function changeClass(pct: number): string {
  if (!Number.isFinite(pct) || pct === 0) return "text-muted-foreground";
  return pct > 0 ? "text-emerald-400" : "text-rose-400";
}

function formatChange(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function MarketBar({
  indicators,
  showTitle = true,
  /** モーダル内: グリッド + 大きめタイポで一覧しやすく */
  layout = "strip",
}: {
  indicators: MarketIndicator[];
  showTitle?: boolean;
  layout?: "strip" | "modal";
}) {
  if (indicators.length === 0) return null;

  if (layout === "modal") {
    return (
      <div
        className="rounded-xl border border-border bg-background/60 p-1 sm:p-2"
        aria-label={showTitle ? "Market glance" : undefined}
      >
        {showTitle ? (
          <div className="mb-3 px-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Market glance</span>
          </div>
        ) : null}
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          {indicators.map((m) => (
            <li
              key={m.label}
              className="rounded-xl border border-border bg-card px-3 py-3 shadow-sm"
            >
              <div className="text-[10px] font-bold uppercase leading-tight tracking-tight text-muted-foreground sm:text-xs">
                {m.label}
              </div>
              <div className="mt-1.5 font-mono text-base font-semibold tabular-nums text-foreground sm:text-lg">
                {formatValue(m.label, m.value)}
              </div>
              <div className={`mt-0.5 font-mono text-sm font-bold tabular-nums sm:text-base ${changeClass(m.changePct)}`}>
                {m.value < 0 ? "—" : formatChange(m.changePct)}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-border bg-card/60 px-3 py-2.5 shadow-inner"
      aria-label={showTitle ? "Market glance" : undefined}
    >
      {showTitle ? (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Market glance</span>
        </div>
      ) : null}
      <div className="-mx-1 flex gap-3 overflow-x-auto pb-1 scroll-smooth [scrollbar-width:thin]">
        {indicators.map((m) => (
          <div
            key={m.label}
            className="min-w-[5.75rem] shrink-0 rounded-lg border border-border bg-background/60 px-2.5 py-1.5"
          >
            <div className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground truncate" title={m.label}>
              {m.label}
            </div>
            <div className="font-mono text-xs font-semibold text-foreground/90 tabular-nums">{formatValue(m.label, m.value)}</div>
            <div className={`font-mono text-[10px] font-bold tabular-nums ${changeClass(m.changePct)}`}>
              {m.value < 0 ? "—" : formatChange(m.changePct)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
