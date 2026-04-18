"use client";

import React, { useEffect, useState } from "react";
import { LineChart, Target, X } from "lucide-react";

import { EventCalendarModal } from "@/src/components/dashboard/EventCalendarModal";
import { MarketBar } from "@/src/components/dashboard/MarketBar";
import { RiskRegimeGauge } from "@/src/components/dashboard/RiskRegimeGauge";
import { StatBox } from "@/src/components/dashboard/StatBox";
import { ThemeToggle } from "@/src/components/dashboard/ThemeToggle";
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";
import { formatLocalPriceForView } from "@/src/lib/format-display-currency";
import type { MarketIndicator } from "@/src/types/investment";

type Props = {
  totalAlpha: number;
  /** Lv.1 現地通貨ベースの平均（通常 `totalAlpha` と同値） */
  portfolioFxNeutralAlpha: number;
  benchmarkPrice: number;
  benchmarkChangePct?: number | null;
  benchmarkPriceSource?: "live" | "close";
  benchmarkAsOf?: string | null;
  /** Server-built line: NY session context for blended portfolio avg α (may be a date range). */
  portfolioAvgAlphaAsOfDisplay?: string | null;
  /** 保有の前日比 %（算出できた銘柄の算術平均）。ダッシュボード summary と同じ。 */
  portfolioAvgDayChangePct?: number | null;
  marketIndicators: MarketIndicator[];
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
  totalAlpha,
  portfolioFxNeutralAlpha,
  benchmarkPrice,
  benchmarkChangePct,
  benchmarkPriceSource = "close",
  benchmarkAsOf = null,
  portfolioAvgAlphaAsOfDisplay = null,
  portfolioAvgDayChangePct = null,
  marketIndicators,
}: Props) {
  const [marketOpen, setMarketOpen] = useState(false);
  const [koyomiOpen, setKoyomiOpen] = useState(false);
  const { convert, viewCurrency, setViewCurrency, alphaDisplayMode, setAlphaDisplayMode } =
    useCurrencyConverter();
  const displayedPortfolioAlpha =
    alphaDisplayMode === "fxNeutral" ? portfolioFxNeutralAlpha : totalAlpha;
  const alphaFmt = formatAlphaPercent(displayedPortfolioAlpha);
  const daySpreadPct =
    portfolioAvgDayChangePct != null &&
    benchmarkChangePct != null &&
    Number.isFinite(portfolioAvgDayChangePct) &&
    Number.isFinite(benchmarkChangePct)
      ? portfolioAvgDayChangePct - benchmarkChangePct
      : null;
  const spreadFmt = formatAlphaPercent(
    daySpreadPct != null && Number.isFinite(daySpreadPct) ? daySpreadPct : Number.NaN,
  );
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

  useEffect(() => {
    if (!marketOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMarketOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [marketOpen]);

  useEffect(() => {
    if (!marketOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [marketOpen]);

  return (
    <header className="border-b border-border pb-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="min-w-0 shrink">
          <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span className="px-2 py-0.5 bg-accent-cyan/10 text-accent-cyan rounded border border-accent-cyan/25">
              Alpha Engine v1.2
            </span>
            <span>Satoshi&apos;s Investment OS</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Target className="text-accent-cyan shrink-0" size={28} />
            Structural Cockpit
          </h1>
        </div>

        <div className="flex flex-row flex-wrap justify-start gap-x-8 gap-y-4 md:justify-end items-end shrink-0 min-w-0 w-full md:w-auto">
          {/* スマホ: Market glance を Alpha の上（小さめ）。md+: ボタン左・Alpha 右 */}
          <div className="flex w-full min-w-0 flex-col gap-1.5 md:w-auto md:flex-row md:items-end md:gap-3">
            <div className="order-1 flex flex-wrap items-center gap-1.5 self-start md:self-end md:mb-0.5 md:gap-2">
              <div
                className="inline-flex rounded-lg border border-border bg-background/80 p-0.5 shadow-sm"
                role="group"
                aria-label="表示通貨"
              >
                <button
                  type="button"
                  onClick={() => setViewCurrency("JPY")}
                  className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                    viewCurrency === "JPY"
                      ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/35"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ¥
                </button>
                <button
                  type="button"
                  onClick={() => setViewCurrency("USD")}
                  className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                    viewCurrency === "USD"
                      ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/35"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  $
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMarketOpen(true)}
                className="w-fit shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:gap-1.5 md:rounded-lg md:px-3 md:py-2 md:text-[10px]"
                aria-haspopup="dialog"
                aria-expanded={marketOpen}
              >
                <LineChart className="h-3 w-3 shrink-0 text-muted-foreground md:h-3.5 md:w-3.5" aria-hidden />
                Market glance
              </button>
              <button
                type="button"
                onClick={() => setKoyomiOpen(true)}
                className="w-fit shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:gap-1.5 md:rounded-lg md:px-3 md:py-2 md:text-[10px]"
                aria-haspopup="dialog"
                aria-expanded={koyomiOpen}
              >
                <span aria-hidden>📅</span>
                イベント（暦）
              </button>
            </div>
            <div className="order-2 min-w-0 basis-full md:basis-auto">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">α レンズ</span>
                <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setAlphaDisplayMode("standard")}
                    className={`rounded px-2 py-0.5 text-[8px] font-bold uppercase ${
                      alphaDisplayMode === "standard"
                        ? "bg-card text-foreground"
                        : "text-muted-foreground hover:text-foreground/90"
                    }`}
                  >
                    標準
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlphaDisplayMode("fxNeutral")}
                    className={`rounded px-2 py-0.5 text-[8px] font-bold uppercase ${
                      alphaDisplayMode === "fxNeutral"
                        ? "bg-card text-emerald-300/95"
                        : "text-muted-foreground hover:text-foreground/90"
                    }`}
                  >
                    FX中立
                  </button>
                </div>
              </div>
              <StatBox
                label={alphaDisplayMode === "fxNeutral" ? "Portfolio avg α (FX-neutral)" : "Portfolio avg Alpha"}
                value={alphaFmt.text}
                valueColor={alphaFmt.color}
                subLabel={
                  alphaDisplayMode === "fxNeutral"
                    ? "現地リターン − 現地ベンチ（名目為替レンズに無依存）"
                    : "Latest daily α vs VOO, equal-weighted"
                }
                footnote={
                  [
                    portfolioAvgAlphaAsOfDisplay,
                    alphaDisplayMode === "fxNeutral"
                      ? "Lv.1 日次 α は米株→VOO・日本株→TOPIX ETF で算出"
                      : null,
                  ]
                    .filter((x): x is string => x != null && x.length > 0)
                    .join(" · ") || undefined
                }
              />
              <p
                className="mt-1.5 text-[8px] leading-snug text-muted-foreground/90"
                title="均等加重の保有前日比から、VOO の当日騰落（右欄と同じ値）を差し引いた当日の超過リターン（目安）。"
              >
                <span className="font-bold uppercase tracking-wider text-muted-foreground/80">α 乖離</span>
                <span
                  className={`mx-1.5 font-mono font-semibold tabular-nums tracking-tight ${spreadFmt.color}`}
                >
                  {spreadFmt.text}
                </span>
                <span className="text-muted-foreground/65 normal-case font-normal tracking-normal">
                  （均等PF − VOO·1D）
                </span>
              </p>
            </div>
          </div>
          <StatBox
            label="VOO (S&P 500 ETF)"
            value={benchText}
            valueColor="text-foreground/80"
            subLabel={benchSubLabel}
            title={benchAsOfTitle}
          />
          <RiskRegimeGauge indicators={marketIndicators} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {marketOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"
            aria-label="Close market glance"
            onClick={() => setMarketOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="market-glance-title"
            className="relative z-10 flex h-[80dvh] w-[80vw] max-w-[min(100%,80vw)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl min-h-0 sm:max-w-[min(56rem,80vw)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <h2 id="market-glance-title" className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">
                Market glance
              </h2>
              <button
                type="button"
                onClick={() => setMarketOpen(false)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4 [-webkit-overflow-scrolling:touch]">
              {marketIndicators.length === 0 ? (
                <p className="text-sm text-muted-foreground sm:text-base">市場指標を取得できませんでした。</p>
              ) : (
                <MarketBar indicators={marketIndicators} showTitle={false} layout="modal" />
              )}
            </div>
          </div>
        </div>
      ) : null}

      <EventCalendarModal open={koyomiOpen} onOpenChange={setKoyomiOpen} />
    </header>
  );
}
