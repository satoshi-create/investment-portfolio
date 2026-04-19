"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  /** Cockpit: shrink-on-scroll density */
  compact?: boolean;
};

const MODAL_SAFE_PADDING: React.CSSProperties = {
  paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
  paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
  paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
  paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
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
  compact = false,
}: Props) {
  const [marketOpen, setMarketOpen] = useState(false);
  const [koyomiOpen, setKoyomiOpen] = useState(false);
  const { convert, viewCurrency, setViewCurrency } = useCurrencyConverter();
  const displayedPortfolioAlpha = totalAlpha;
  const alphaFmt = formatAlphaPercent(displayedPortfolioAlpha);
  const fxNeutralAlphaFmt = formatAlphaPercent(portfolioFxNeutralAlpha);
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
    <header className={`border-b border-border ${compact ? "pb-3" : "pb-6"}`}>
      <div
        className={`flex flex-col md:flex-row md:items-start md:justify-between ${
          compact ? "gap-3 md:gap-4" : "gap-6 md:gap-8"
        }`}
      >
        <div className="min-w-0 shrink">
          {!compact ? (
            <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
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

        <div className="flex flex-row flex-wrap justify-start gap-x-8 gap-y-4 md:justify-end md:items-start shrink-0 min-w-0 w-full md:w-auto">
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
              <StatBox
                label="Portfolio avg Alpha"
                value={alphaFmt.text}
                valueColor={alphaFmt.color}
                subLabel={
                  "Latest daily α vs VOO, equal-weighted"
                }
                title={`FX-neutral avg α: ${fxNeutralAlphaFmt.text}`}
                footnote={
                  [
                    portfolioAvgAlphaAsOfDisplay,
                  ]
                    .filter((x): x is string => x != null && x.length > 0)
                    .join(" · ") || undefined
                }
              />
              {!compact ? (
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
              ) : null}
            </div>
          </div>
          <StatBox
            label="VOO (S&P 500 ETF)"
            value={benchText}
            valueColor="text-foreground/80"
            subLabel={benchSubLabel}
            title={benchAsOfTitle}
          />
          {!compact ? <RiskRegimeGauge indicators={marketIndicators} /> : null}
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {marketOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center"
              style={MODAL_SAFE_PADDING}
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
                className="relative z-10 flex max-h-[min(90dvh,56rem)] w-[min(100%,90vw)] max-w-4xl min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-6 sm:py-4">
                  <h2
                    id="market-glance-title"
                    className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground sm:text-base"
                  >
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
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 text-sm sm:px-6 sm:py-5 sm:text-base [-webkit-overflow-scrolling:touch]">
                  {marketIndicators.length === 0 ? (
                    <p className="text-muted-foreground">市場指標を取得できませんでした。</p>
                  ) : (
                    <MarketBar indicators={marketIndicators} showTitle={false} layout="modal" />
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <EventCalendarModal open={koyomiOpen} onOpenChange={setKoyomiOpen} />
    </header>
  );
}
