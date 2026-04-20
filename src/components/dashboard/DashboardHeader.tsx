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
  /** 過去スナップショットの平均日次α（期待値、%）。未記録時は null。 */
  averageDailyAlphaPct: number | null;
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
  averageDailyAlphaPct,
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
  const avgDailyFmt = formatAlphaPercent(
    averageDailyAlphaPct != null && Number.isFinite(averageDailyAlphaPct) ? averageDailyAlphaPct : Number.NaN,
  );
  const liveFmt = formatAlphaPercent(
    totalLiveAlphaPct != null && Number.isFinite(totalLiveAlphaPct) ? totalLiveAlphaPct : Number.NaN,
  );
  const pulseOutperforms =
    averageDailyAlphaPct != null && Number.isFinite(averageDailyAlphaPct) && dailyAvgAlpha > averageDailyAlphaPct;
  const liveSubColor =
    totalLiveAlphaPct == null || !Number.isFinite(totalLiveAlphaPct)
      ? "text-muted-foreground"
      : totalLiveAlphaPct > 0
        ? "text-emerald-300/80"
        : totalLiveAlphaPct < 0
          ? "text-rose-300/80"
          : "text-muted-foreground";
  const benchText =
    benchmarkPrice > 0 && Number.isFinite(benchmarkPrice)
      ? formatLocalPriceForView(benchmarkPrice, "USD", viewCurrency, convert)
      : "—";
  const benchChangeText =
    benchmarkChangePct != null && Number.isFinite(benchmarkChangePct)
      ? `${benchmarkChangePct > 0 ? "+" : ""}${benchmarkChangePct.toFixed(2)}%`
      : null;

  // VOOの当日%は数値のみ表示（データ源ラベルはUIに出さない）
  const benchSubLabel = benchChangeText ?? "—";

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
                Avg Daily α
              </span>
              <span className={`text-3xl font-bold tabular-nums ${avgDailyFmt.color}`}>{avgDailyFmt.text}</span>
            </div>

            <div className="flex flex-col items-end font-mono leading-tight">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Pulse
              </span>
              <span
                className={`font-bold tabular-nums ${alphaFmt.color} ${
                  pulseOutperforms ? "drop-shadow-[0_0_10px_rgba(34,211,238,0.20)]" : ""
                }`}
                title={
                  pulseOutperforms
                    ? "今日のαが平均日次α（期待値）を上回っています"
                    : "今日のα（実績）"
                }
              >
                {alphaFmt.text}
              </span>
              <span className={`text-xs tabular-nums whitespace-nowrap ${liveSubColor}`}>({liveFmt.text})</span>
            </div>

            <div className="flex flex-col items-end font-mono leading-tight">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                VOO
              </span>
              <span className="font-bold tabular-nums text-foreground/80">{benchText}</span>
              <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">{benchSubLabel}</span>
            </div>
          </div>

          {!compact ? <RiskRegimeGauge indicators={marketIndicators} /> : null}
        </div>
      </div>
    </header>
  );
}
