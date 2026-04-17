import React, { useMemo } from "react";

import type { MarketIndicator } from "@/src/types/investment";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function formatPct(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

type Regime = "Risk-on" | "Neutral" | "Risk-off";

function classifyRegimeFromVix(vix: number): { regime: Regime; score: number } {
  // VIX-centered, simple and explainable:
  // - <=14: Risk-on
  // - ~22: Neutral
  // - >=30: Risk-off
  // score is clamped to [-1, +1] (left=off, right=on).
  const score = clamp((22 - vix) / 8, -1, 1);
  const regime: Regime = score >= 0.35 ? "Risk-on" : score <= -0.35 ? "Risk-off" : "Neutral";
  return { regime, score };
}

function regimeColor(regime: Regime): { text: string; accent: string } {
  if (regime === "Risk-on") return { text: "text-emerald-300", accent: "bg-emerald-500/70" };
  if (regime === "Risk-off") return { text: "text-rose-300", accent: "bg-rose-500/70" };
  return { text: "text-muted-foreground", accent: "bg-slate-300/60 dark:bg-slate-500/50" };
}

export function RiskRegimeGauge({ indicators }: { indicators: MarketIndicator[] }) {
  const vix = useMemo(() => indicators.find((x) => x.label === "VIX") ?? null, [indicators]);

  const derived = useMemo(() => {
    if (!vix || !Number.isFinite(vix.value) || vix.value <= 0) return null;
    const { regime, score } = classifyRegimeFromVix(vix.value);
    const posPct = clamp(((score + 1) / 2) * 100, 0, 100);
    return { regime, score, posPct };
  }, [vix]);

  const meta = derived ? regimeColor(derived.regime) : { text: "text-muted-foreground", accent: "bg-slate-300/60" };

  return (
    <section
      className="rounded-2xl border border-border bg-card/60 px-4 py-3 shadow-inner min-w-[14.5rem]"
      aria-label="Risk regime (VIX)"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Risk regime <span className="text-muted-foreground/70">(VIX)</span>
        </p>
        <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${meta.text}`}>
          {derived ? derived.regime : "—"}
        </p>
      </div>

      <div className="mt-2">
        <div className="relative h-2.5 rounded-full border border-border bg-background/60 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500/30 via-slate-400/15 to-emerald-500/30" />
          {derived ? (
            <div
              className="absolute top-0 h-full w-0"
              style={{ left: `${derived.posPct}%` }}
              aria-hidden
            >
              <div className={`-ml-[1px] h-full w-[2px] ${meta.accent}`} />
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
          <span className="text-muted-foreground">
            VIX{" "}
            <span className="font-mono font-semibold text-foreground/90 tabular-nums">
              {vix && vix.value > 0 && Number.isFinite(vix.value) ? vix.value.toFixed(2) : "—"}
            </span>
          </span>
          <span className="font-mono font-bold tabular-nums text-muted-foreground" title="VIX 1D change %">
            {vix && vix.value > 0 ? formatPct(vix.changePct) : "—"}
          </span>
        </div>

        <p className="mt-1 text-[9px] leading-snug text-muted-foreground/80">
          低VIX=Risk-on / 高VIX=Risk-off（目安: 14↔22↔30）
        </p>
      </div>
    </section>
  );
}

