"use client";

import React, { useEffect, useState } from "react";
import { LineChart, Target, X } from "lucide-react";

import { MarketBar } from "@/src/components/dashboard/MarketBar";
import { StatBox } from "@/src/components/dashboard/StatBox";
import type { MarketIndicator } from "@/src/types/investment";

type Props = {
  totalAlpha: number;
  benchmarkPrice: number;
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

export function DashboardHeader({ totalAlpha, benchmarkPrice, marketIndicators }: Props) {
  const [marketOpen, setMarketOpen] = useState(false);
  const alphaFmt = formatAlphaPercent(totalAlpha);
  const benchText =
    benchmarkPrice > 0 && Number.isFinite(benchmarkPrice)
      ? benchmarkPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : "—";

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
    <header className="border-b border-slate-800 pb-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="min-w-0 shrink">
          <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
              Alpha Engine v1.2
            </span>
            <span>Satoshi&apos;s Investment OS</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Target className="text-blue-500 shrink-0" size={28} />
            Structural Cockpit
          </h1>
        </div>

        <div className="flex flex-row flex-wrap justify-start gap-x-8 gap-y-4 md:justify-end items-end shrink-0 min-w-0 w-full md:w-auto">
          {/* スマホ: Market glance を Alpha の上（小さめ）。md+: ボタン左・Alpha 右 */}
          <div className="flex w-full min-w-0 flex-col gap-1.5 md:w-auto md:flex-row md:items-end md:gap-3">
            <button
              type="button"
              onClick={() => setMarketOpen(true)}
              className="order-1 w-fit shrink-0 self-start inline-flex items-center gap-1 rounded-md border border-slate-600/90 bg-slate-900/70 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:border-slate-500 hover:bg-slate-800 hover:text-slate-200 md:mb-0.5 md:gap-1.5 md:self-end md:rounded-lg md:px-3 md:py-2 md:text-[10px]"
              aria-haspopup="dialog"
              aria-expanded={marketOpen}
            >
              <LineChart className="h-3 w-3 shrink-0 text-slate-500 md:h-3.5 md:w-3.5" aria-hidden />
              Market glance
            </button>
            <div className="order-2 min-w-0">
              <StatBox
                label="Portfolio avg Alpha"
                value={alphaFmt.text}
                valueColor={alphaFmt.color}
                subLabel="Latest daily α vs VOO, equal-weighted"
              />
            </div>
          </div>
          <StatBox
            label="VOO (S&P 500 ETF)"
            value={benchText}
            valueColor="text-slate-300"
            subLabel="Latest close (USD, Yahoo)"
          />
        </div>
      </div>

      {marketOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px]"
            aria-label="Close market glance"
            onClick={() => setMarketOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="market-glance-title"
            className="relative z-10 flex h-[80dvh] w-[80vw] max-w-[min(100%,80vw)] flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl min-h-0 sm:max-w-[min(56rem,80vw)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-5">
              <h2 id="market-glance-title" className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400 sm:text-sm">
                Market glance
              </h2>
              <button
                type="button"
                onClick={() => setMarketOpen(false)}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200 touch-manipulation"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4 [-webkit-overflow-scrolling:touch]">
              {marketIndicators.length === 0 ? (
                <p className="text-sm text-slate-500 sm:text-base">市場指標を取得できませんでした。</p>
              ) : (
                <MarketBar indicators={marketIndicators} showTitle={false} layout="modal" />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
