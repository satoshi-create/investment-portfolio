import React, { useMemo } from "react";
import { Flame, Zap } from "lucide-react";
import { useSearchParams } from "next/navigation";

import type { EcosystemWatchlistSearchItem, Signal, Stock } from "@/src/types/investment";
import { SignalCard } from "@/src/components/dashboard/SignalCard";
import type { TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";
import { fiveDayPulseForHoldingRow, stockFiveDayTrendIgnitionModel } from "@/src/lib/alpha-logic";
import Link from "next/link";
import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";
import { cn } from "@/src/lib/cn";

type Props = {
  signals: Signal[];
  userId: string;
  onSignalResolved?: (signalId: string) => void;
  onTrade?: (initial: TradeEntryInitial) => void;
  stocks?: Stock[];
  ecosystemSearch?: EcosystemWatchlistSearchItem[];
};

type UnifiedIgnitionItem = {
  ticker: string;
  name: string;
  theme: string;
  isHolding: boolean;
  latestAlpha: number | null;
  alphaHistory5d: number[];
  href: string;
  actionLabel: string;
};

export function SignalsSection({
  signals,
  userId,
  onSignalResolved,
  onTrade,
  stocks = [],
  ecosystemSearch = [],
}: Props) {
  const searchParams = useSearchParams();
  const showIgnitionOnly = searchParams?.get("ignition") === "1";

  const portfolioTickerSet = useMemo(() => new Set(stocks.map((s) => s.ticker.toUpperCase())), [stocks]);

  const unifiedIgnitionItems = useMemo(() => {
    const items: UnifiedIgnitionItem[] = [];

    // 1. 保有銘柄
    for (const s of stocks) {
      if (stockFiveDayTrendIgnitionModel(s).isCompoundingIgnited) {
        const { series } = fiveDayPulseForHoldingRow(s);
        items.push({
          ticker: s.ticker,
          name: s.name,
          theme: s.tag || "その他",
          isHolding: true,
          latestAlpha: series.length > 0 ? series[series.length - 1]! : null,
          alphaHistory5d: series,
          href: `/?ticker=${encodeURIComponent(s.ticker)}`,
          actionLabel: "分析",
        });
      }
    }

    // 2. 観測銘柄
    const uniqueEcoMap = new Map<string, EcosystemWatchlistSearchItem>();
    for (const item of ecosystemSearch) {
      if (item.isCompoundingIgnited && !portfolioTickerSet.has(item.ticker.toUpperCase())) {
        const t = item.ticker.toUpperCase();
        if (!uniqueEcoMap.has(t)) uniqueEcoMap.set(t, item);
      }
    }

    for (const item of uniqueEcoMap.values()) {
      items.push({
        ticker: item.ticker,
        name: item.companyName,
        theme: item.themeName || "その他",
        isHolding: false,
        latestAlpha: item.latestAlpha,
        alphaHistory5d: item.alphaHistory5d,
        href: `/themes/${encodeURIComponent(item.themeName)}?ignition=1`,
        actionLabel: "テーマ",
      });
    }

    return items;
  }, [stocks, ecosystemSearch, portfolioTickerSet]);

  const groupedIgnition = useMemo(() => {
    const groups = new Map<string, UnifiedIgnitionItem[]>();
    for (const item of unifiedIgnitionItems) {
      const list = groups.get(item.theme) ?? [];
      list.push(item);
      groups.set(item.theme, list);
    }
    // テーマ名でソート
    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [unifiedIgnitionItems]);

  return (
    <div className="space-y-12">
      {/* Live Signals セクション (上部に移動) */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-slate-400">
          <Zap size={14} className="fill-amber-400 text-amber-400" />
          Live Signals
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {signals.length === 0 ? (
            <p className="col-span-full text-sm text-slate-500">
              No unresolved signals. Run <span className="font-mono text-slate-400">Generate signals</span> after
              loading alpha history.
            </p>
          ) : (
            signals.map((signal) => (
              <SignalCard
                key={signal.id}
                signal={signal}
                userId={userId}
                onResolved={onSignalResolved}
                onTrade={onTrade}
              />
            ))
          )}
        </div>
      </div>

      {/* 複利点火セクション (下部に移動 & テーマ別) */}
      {(showIgnitionOnly || unifiedIgnitionItems.length > 0) && (
        <div className="space-y-6">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">
            <Flame size={14} className="fill-cyan-400 text-cyan-400" />
            Compounding Ignition
          </h2>

          {unifiedIgnitionItems.length === 0 ? (
            <p className="text-sm text-slate-500">現在、複利点火は検出されていません。</p>
          ) : (
            <div className="space-y-8">
              {Array.from(groupedIgnition.entries()).map(([theme, items]) => (
                <div key={theme} className="space-y-3">
                  <h3 className="flex items-center gap-2 px-1 text-[11px] font-bold text-cyan-500/80 uppercase tracking-wider">
                    <span className="h-px w-4 bg-cyan-500/30" />
                    {theme}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {items.map((item) => (
                      <div
                        key={item.ticker}
                        className={cn(
                          "flex items-center justify-between rounded-xl border p-4 transition-colors",
                          item.isHolding
                            ? "border-cyan-500/30 bg-cyan-950/10"
                            : "border-slate-800 bg-slate-900/40 hover:bg-slate-900/60",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-lg font-bold text-foreground">{item.ticker}</span>
                            {item.isHolding && (
                              <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                                保有中
                              </span>
                            )}
                            <div className="ml-auto flex items-center gap-4 pr-4">
                              <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold uppercase text-muted-foreground">α</span>
                                <span
                                  className={cn(
                                    "font-mono text-xs font-bold",
                                    (item.latestAlpha ?? 0) > 0 ? "text-emerald-400" : "text-rose-400",
                                  )}
                                >
                                  {item.latestAlpha != null
                                    ? `${item.latestAlpha > 0 ? "+" : ""}${item.latestAlpha.toFixed(2)}%`
                                    : "—"}
                                </span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold uppercase text-muted-foreground">5d</span>
                                <div className="h-6 w-12">
                                  {item.alphaHistory5d.length > 0 ? (
                                    <TrendMiniChart
                                      history={item.alphaHistory5d}
                                      maxPoints={5}
                                      isCompoundingIgnited={true}
                                    />
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">—</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{item.name}</p>
                        </div>
                        <Link
                          href={item.href}
                          className={cn(
                            "ml-2 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors",
                            item.isHolding
                              ? "border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                              : "border-slate-700 text-slate-300 hover:bg-slate-800",
                          )}
                        >
                          {item.actionLabel}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

