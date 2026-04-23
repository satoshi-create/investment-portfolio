import React, { useMemo } from "react";

import type { MarketIndicator } from "@/src/types/investment";
import { cn } from "@/src/lib/cn";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function formatPct(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatDeltaPts(delta: number): string {
  if (!Number.isFinite(delta)) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}`;
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

/**
 * 日次変動の強調（changePct・Δpt は Yahoo 終値ベースの近似に依存）:
 * - Spike: changePct ≥ 10 または Δ ≥ 1.5 → 警告色 + pulse
 * - Calm: 上記以外で changePct ≤ −5 または Δ ≤ −0.75 → 落ち着きアクセント
 */
function vixDayMoveFlags(pct: number, deltaPts: number | null): { spike: boolean; calm: boolean } {
  const spike = pct >= 10 || (deltaPts != null && Number.isFinite(deltaPts) && deltaPts >= 1.5);
  if (spike) return { spike: true, calm: false };
  const calm =
    pct <= -5 || (deltaPts != null && Number.isFinite(deltaPts) && deltaPts <= -0.75);
  return { spike: false, calm };
}

export function RiskRegimeGauge({ indicators }: { indicators: MarketIndicator[] }) {
  const vix = useMemo(() => indicators.find((x) => x.label === "VIX") ?? null, [indicators]);

  const derived = useMemo(() => {
    if (!vix || !Number.isFinite(vix.value) || vix.value <= 0) return null;
    const { regime, score } = classifyRegimeFromVix(vix.value);
    const posPct = clamp(((score + 1) / 2) * 100, 0, 100);
    return { regime, score, posPct };
  }, [vix]);

  const dayMove = useMemo(() => {
    if (!vix || !Number.isFinite(vix.value) || vix.value <= 0) return null;
    const val = vix.value;
    const pct = vix.changePct;
    if (!Number.isFinite(pct)) return { prior: null as number | null, deltaPts: null as number | null, pct };
    if (pct <= -100) return { prior: null, deltaPts: null, pct };
    const prior = val / (1 + pct / 100);
    if (!Number.isFinite(prior) || prior <= 0) return { prior: null, deltaPts: null, pct };
    const deltaPts = val - prior;
    return {
      prior,
      deltaPts: Number.isFinite(deltaPts) ? deltaPts : null,
      pct,
    };
  }, [vix]);

  const moveStyle = useMemo(() => {
    if (!dayMove) return { spike: false, calm: false };
    return vixDayMoveFlags(dayMove.pct, dayMove.deltaPts);
  }, [dayMove]);

  const meta = derived ? regimeColor(derived.regime) : { text: "text-muted-foreground", accent: "bg-slate-300/60" };

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card/60 px-4 py-3 shadow-inner min-w-[14.5rem] transition-colors",
        moveStyle.spike && "border-amber-500/55 bg-amber-500/[0.07]",
        moveStyle.calm && !moveStyle.spike && "border-emerald-500/35 bg-emerald-500/[0.06]",
      )}
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

        <div
          className={cn(
            "mt-2 flex flex-col gap-1 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:gap-3",
            moveStyle.spike && "motion-safe:animate-pulse",
          )}
        >
          <span className="text-muted-foreground">
            VIX{" "}
            <span className="font-mono font-semibold text-foreground/90 tabular-nums">
              {vix && vix.value > 0 && Number.isFinite(vix.value) ? vix.value.toFixed(2) : "—"}
            </span>
            {dayMove?.prior != null && Number.isFinite(dayMove.prior) ? (
              <span
                className="ml-1.5 text-[10px] font-mono tabular-nums text-muted-foreground/85"
                title="前日終値の近似: 現在値 ÷ (1 + 騰落率/100)"
              >
                (前日≈{dayMove.prior.toFixed(2)})
              </span>
            ) : null}
          </span>
          <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 font-mono font-bold tabular-nums">
            {dayMove?.deltaPts != null && Number.isFinite(dayMove.deltaPts) ? (
              <span
                className={cn(
                  "text-foreground/90",
                  moveStyle.spike && "text-amber-200",
                  moveStyle.calm && !moveStyle.spike && "text-emerald-200/95",
                )}
                title="VIX のポイント変化（現在 − 前日近似）"
              >
                Δ{formatDeltaPts(dayMove.deltaPts)}pt
              </span>
            ) : null}
            <span
              className={cn(
                "text-muted-foreground",
                moveStyle.spike && "text-amber-200/95",
                moveStyle.calm && !moveStyle.spike && "text-emerald-200/90",
              )}
              title="VIX 1D change %"
            >
              {vix && vix.value > 0 ? formatPct(vix.changePct) : "—"}
            </span>
          </span>
        </div>

        <p className="mt-1 text-[9px] leading-snug text-muted-foreground/80">
          低VIX=Risk-on / 高VIX=Risk-off（目安: 14↔22↔30）
        </p>
      </div>
    </section>
  );
}
