"use client";

import React from "react";
import { Target } from "lucide-react";

import { RiskRegimeGauge } from "@/src/components/dashboard/RiskRegimeGauge";
import type { MarketIndicator } from "@/src/types/investment";
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";
import { formatLocalPriceForView } from "@/src/lib/format-display-currency";

type Props = {
  /** 最新日の確定日次平均α（%） */
  dailyAvgAlpha: number;
  /** Lv.1 現地通貨ベースの平均（通常 `dailyAvgAlpha` と同値） */
  portfolioFxNeutralAlpha: number;
  /** スナップショットから累積した総アウトパフォーム（%）。未記録時は null。 */
  cumulativeAlphaDeviationPct: number | null;
  /** 現在値連動のライブα（全保有・時価加重平均、%）。算出不可時は null。 */
  totalLiveAlphaPct: number | null;
  benchmarkPrice: number;
  benchmarkChangePct?: number | null;
  benchmarkPriceSource?: "live" | "close";
  benchmarkAsOf?: string | null;
  /** Server-built line: NY session context for blended portfolio avg α (may be a date range). */
  portfolioAvgAlphaAsOfDisplay?: string | null;
  /** 保有の前日比 %（算出できた銘柄の算術平均）。ダッシュボード summary と同じ。 */
  portfolioAvgDayChangePct?: number | null;
  marketIndicators: MarketIndicator[];
  /** Cockpit: shrink-on-scroll density */
  compact?: boolean;
};

function formatAlphaPercent(value: number): { text: string; color: string } {
  if (!Number.isFinite(value)) {
    return { text: "—", color: "text-slate-500" };
  }
  const sign = value > 0 ? "+" : "";
  const color = value > 0 ? "text-emerald-400" : value < 0 ? "text-rose-400" : "text-slate-400";
  return { text: `${sign}${value.toFixed(2)}%`, color };
}

export function DashboardHeader({
  dailyAvgAlpha,
  portfolioFxNeutralAlpha,
  cumulativeAlphaDeviationPct,
  totalLiveAlphaPct,
  benchmarkPrice,
  benchmarkChangePct,
  benchmarkPriceSource = "close",
  benchmarkAsOf = null,
  portfolioAvgAlphaAsOfDisplay = null,
  portfolioAvgDayChangePct: _portfolioAvgDayChangePct = null,
  marketIndicators,
  compact = false,
}: Props) {
  const { convert, viewCurrency } = useCurrencyConverter();
  const alphaFmt = formatAlphaPercent(dailyAvgAlpha);
  const fxNeutralAlphaFmt = formatAlphaPercent(portfolioFxNeutralAlpha);
  const cumulativeFmt = formatAlphaPercent(
    cumulativeAlphaDeviationPct != null && Number.isFinite(cumulativeAlphaDeviationPct)
      ? cumulativeAlphaDeviationPct
      : Number.NaN,
  );
  const liveFmt = formatAlphaPercent(
    totalLiveAlphaPct != null && Number.isFinite(totalLiveAlphaPct) ? totalLiveAlphaPct : Number.NaN,
  );
  const liveSubColor =
    totalLiveAlphaPct == null || !Number.isFinite(totalLiveAlphaPct)
      ? "text-muted-foreground"
      : totalLiveAlphaPct > 0
        ? "text-emerald-300/80"
        : totalLiveAlphaPct < 0
          ? "text-rose-300/80"
          : "text-muted-foreground";
  const vooDiffPct =
    totalLiveAlphaPct != null &&
    benchmarkChangePct != null &&
    Number.isFinite(totalLiveAlphaPct) &&
    Number.isFinite(benchmarkChangePct)
      ? totalLiveAlphaPct - benchmarkChangePct
      : null;
  const vooDiffFmt = formatAlphaPercent(vooDiffPct != null ? vooDiffPct : Number.NaN);
  const benchText =
    benchmarkPrice > 0 && Number.isFinite(benchmarkPrice)
      ? formatLocalPriceForView(benchmarkPrice, "USD", viewCurrency, convert)
      : "—";
  const benchChangeText =
    benchmarkChangePct != null && Number.isFinite(benchmarkChangePct)
      ? `${benchmarkChangePct > 0 ? "+" : ""}${benchmarkChangePct.toFixed(2)}%`
      : null;

  const benchSubLabel = (() => {
    if (benchChangeText) {
      const basis = benchmarkPriceSource === "live" ? "Live (Yahoo quote)" : "Latest close (1D)";
      return `${basis} · ${benchChangeText}`;
    }
    return benchmarkPriceSource === "live" ? "Live quote (USD, Yahoo)" : "Latest close (USD, Yahoo)";
  })();

  const benchAsOfTitle =
    benchmarkAsOf != null && benchmarkAsOf.length > 0
      ? `基準時刻: ${new Date(benchmarkAsOf).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`
      : undefined;

  // Market glance / calendar controls are rendered in the Profile band (CockpitShell).

  return (
    <header className={`border-b border-border ${compact ? "pb-2" : "pb-3"}`}>
      <div
        className={`flex flex-col gap-3 md:flex-row md:items-start md:justify-between ${
          compact ? "md:gap-4" : "md:gap-6"
        }`}
      >
        <div className="min-w-0 shrink">
          {!compact ? (
            <div className="flex items-center gap-2 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span className="px-2 py-0.5 bg-accent-cyan/10 text-accent-cyan rounded border border-accent-cyan/25">
                Alpha Engine v1.2
              </span>
              <span>Satoshi&apos;s Investment OS</span>
            </div>
          ) : null}
          <h1
            className={`font-bold tracking-tight text-foreground flex items-center gap-2 ${
              compact ? "text-xl" : "text-3xl"
            }`}
          >
            <Target className="text-accent-cyan shrink-0" size={compact ? 20 : 28} />
            Structural Cockpit
          </h1>
        </div>

        {/* Same line block: Total α + Pulse + vs VOO */}
        <div className="flex flex-wrap items-end justify-start gap-x-6 gap-y-3 md:justify-end">
          <div className="flex items-end gap-5">
            <div className="flex flex-col items-end font-mono leading-none">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Total α
              </span>
              <span className={`text-3xl font-bold tabular-nums ${cumulativeFmt.color}`}>{cumulativeFmt.text}</span>
            </div>

            <div className="flex flex-col items-end font-mono leading-tight">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Pulse
              </span>
              <span className={`font-bold tabular-nums ${alphaFmt.color}`}>{alphaFmt.text}</span>
              <span className={`text-xs tabular-nums whitespace-nowrap ${liveSubColor}`}>({liveFmt.text})</span>
            </div>

            <div className="flex flex-col items-end font-mono leading-tight">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                VOO
              </span>
              <span className="font-bold tabular-nums text-foreground/80">{benchText}</span>
              <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">{benchSubLabel}</span>
              <span
                className={`text-xs font-semibold tabular-nums whitespace-nowrap ${vooDiffFmt.color}`}
                title="目安: Live α（Pulse 下段）− VOO 当日%"
              >
                Δ {vooDiffFmt.text}
              </span>
            </div>
          </div>

          {!compact ? <RiskRegimeGauge indicators={marketIndicators} /> : null}
        </div>
      </div>
    </header>
  );
}
