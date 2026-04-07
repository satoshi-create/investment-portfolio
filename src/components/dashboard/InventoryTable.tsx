import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import type { Stock } from "@/src/types/investment";
import type { TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";
import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";
import { stickyTdFirst, stickyTdFootFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";

const jpyFmt = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

export function InventoryTable({
  stocks,
  totalHoldings,
  averageAlpha,
  onTrade,
  onTradeNew,
}: {
  stocks: Stock[];
  totalHoldings: number;
  averageAlpha: number;
  onTrade?: (initial: TradeEntryInitial) => void;
  onTradeNew?: () => void;
}) {
  const [sortKey, setSortKey] = useState<
    "asset" | "alpha" | "trend" | "position" | "research"
  >("position");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedStocks = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const lastAlpha = (s: Stock) => (s.alphaHistory.length > 0 ? s.alphaHistory[s.alphaHistory.length - 1]! : null);
    const key = sortKey;
    const arr = [...stocks];
    arr.sort((a, b) => {
      const cmpStr = (x: string, y: string) => x.localeCompare(y, "ja");
      const cmpNum = (x: number | null, y: number | null) => {
        const ax = x == null || !Number.isFinite(x) ? null : x;
        const by = y == null || !Number.isFinite(y) ? null : y;
        if (ax == null && by == null) return 0;
        if (ax == null) return 1;
        if (by == null) return -1;
        return ax < by ? -1 : ax > by ? 1 : 0;
      };

      if (key === "asset") return dir * cmpStr(a.ticker, b.ticker);
      if (key === "alpha") return dir * cmpNum(lastAlpha(a), lastAlpha(b));
      if (key === "trend") return dir * cmpNum(lastAlpha(a), lastAlpha(b));
      if (key === "position") return dir * cmpNum(a.marketValue, b.marketValue);
      // research: prioritize upcoming earnings (smaller days), then yield.
      const earnCmp = cmpNum(
        a.daysToEarnings != null && a.daysToEarnings >= 0 ? a.daysToEarnings : null,
        b.daysToEarnings != null && b.daysToEarnings >= 0 ? b.daysToEarnings : null,
      );
      if (earnCmp !== 0) return dir * earnCmp;
      return dir * cmpNum(a.dividendYieldPercent, b.dividendYieldPercent);
    });
    return arr;
  }, [stocks, sortDir, sortKey]);

  function toggleSort(nextKey: typeof sortKey) {
    if (nextKey === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(nextKey);
      setSortDir("desc");
    }
  }

  function sortMark(k: typeof sortKey) {
    if (k !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const avgAlphaClass =
    averageAlpha > 0 ? "text-emerald-400" : averageAlpha < 0 ? "text-rose-400" : "text-slate-400";
  const avgAlphaSign = averageAlpha > 0 ? "+" : "";
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-border flex justify-between items-center bg-card/60">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Inventory Status
        </h3>
        <div className="flex items-center gap-2">
          {onTradeNew ? (
            <button
              type="button"
              onClick={onTradeNew}
              className="text-[10px] font-bold uppercase tracking-wide text-accent-cyan border border-accent-cyan/40 px-3 py-2 rounded-lg hover:bg-accent-cyan/10 transition-all"
            >
              取引入力
            </button>
          ) : null}
          <div className="flex items-center gap-3 bg-background px-3 py-1.5 rounded-lg border border-border">
            <Search size={14} className="text-muted-foreground" />
            <input
              className="bg-transparent border-none outline-none text-xs w-48 text-foreground/90"
              placeholder="Filter structure..."
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-background text-muted-foreground text-[10px] uppercase font-bold tracking-[0.1em]">
            <tr>
              <th
                className={`px-6 py-4 min-w-[10rem] max-w-[11rem] ${stickyThFirst} cursor-pointer select-none`}
                onClick={() => toggleSort("asset")}
                title="Sort"
              >
                Asset{sortMark("asset")}
              </th>
              <th
                className="px-6 py-4 text-left cursor-pointer select-none"
                onClick={() => toggleSort("research")}
                title="Sort"
              >
                Research{sortMark("research")}
              </th>
              <th
                className="px-6 py-4 text-right cursor-pointer select-none"
                onClick={() => toggleSort("alpha")}
                title="Sort"
              >
                Alpha{sortMark("alpha")}
              </th>
              <th
                className="px-6 py-4 text-center cursor-pointer select-none"
                onClick={() => toggleSort("trend")}
                title="Sort"
              >
                5D Trend{sortMark("trend")}
              </th>
              <th
                className="px-6 py-4 text-right cursor-pointer select-none"
                onClick={() => toggleSort("position")}
                title="Sort"
              >
                Position{sortMark("position")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sortedStocks.map((stock) => (
              <tr key={stock.id} className="group hover:bg-muted/60 transition-all">
                <td className={`px-6 py-4 min-w-[10rem] max-w-[11rem] ${stickyTdFirst}`}>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-foreground group-hover:text-accent-cyan transition-colors">
                        {stock.ticker}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                            (stock.accountType ?? "特定") === "NISA"
                              ? "text-emerald-600 border-emerald-500/40 bg-emerald-500/10"
                              : "text-muted-foreground border-border bg-background/60"
                          }`}
                          title="口座区分（holdings.account_type）"
                        >
                          {stock.accountType ?? "特定"}
                        </span>
                        {onTrade ? (
                          <button
                            type="button"
                            onClick={() =>
                              onTrade({
                                ticker: stock.ticker,
                                name: stock.name || undefined,
                                ...(stock.tag.trim().length > 0 ? { theme: stock.tag } : {}),
                                sector: stock.sector ?? stock.secondaryTag,
                              })
                            }
                            className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-accent-cyan border border-accent-cyan/40 px-2 py-0.5 rounded-md hover:bg-accent-cyan/10"
                          >
                            Trade
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {stock.name ? (
                      <span className="text-[10px] text-muted-foreground leading-snug line-clamp-2" title={stock.name}>
                        {stock.name}
                      </span>
                    ) : null}
                    {stock.tag.trim().length > 0 ? (
                      <Link
                        href={`/themes/${encodeURIComponent(stock.tag)}`}
                        className="inline-flex items-center w-fit text-[10px] font-bold uppercase tracking-tight text-accent-cyan hover:text-accent-cyan/90 border border-accent-cyan/40 rounded-md px-2 py-0.5 mt-0.5 hover:bg-accent-cyan/10 transition-colors"
                      >
                        {stock.tag}
                      </Link>
                    ) : null}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-muted-foreground border border-border bg-background/60 px-2 py-0.5 rounded-md">
                        {stock.countryName}
                      </span>
                      {stock.nextEarningsDate ? (
                        <span
                          className="text-[10px] font-bold text-foreground/90 border border-border bg-card/60 px-2 py-0.5 rounded-md"
                          title={`次期決算予定日: ${stock.nextEarningsDate}`}
                        >
                          E:{stock.daysToEarnings != null ? `D${stock.daysToEarnings}` : stock.nextEarningsDate}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">E:—</span>
                      )}
                      {stock.dividendYieldPercent != null ? (
                        <span
                          className="text-[10px] font-bold text-foreground/90 border border-border bg-card/60 px-2 py-0.5 rounded-md"
                          title={
                            stock.annualDividendRate != null
                              ? `年間配当: ${stock.annualDividendRate}`
                              : "年間配当: —"
                          }
                        >
                          Div:{stock.dividendYieldPercent.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Div:—</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {stock.accountType ?? "特定"}
                    </span>
                  </div>
                </td>
                <td
                  className={`px-6 py-4 text-right font-mono font-bold ${
                    stock.alphaHistory.length === 0
                      ? "text-muted-foreground"
                      : stock.alphaHistory.slice(-1)[0]! > 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                  }`}
                >
                  {stock.alphaHistory.length === 0 ? (
                    "—"
                  ) : (
                    <>
                      {stock.alphaHistory.slice(-1)[0]! > 0 ? "+" : ""}
                      {stock.alphaHistory.slice(-1)[0]}%
                    </>
                  )}
                </td>
                <td className="px-6 py-4">
                  {stock.alphaHistory.length === 0 ? (
                    <span className="text-muted-foreground text-xs">No data</span>
                  ) : (
                    <TrendMiniChart history={stock.alphaHistory} />
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-foreground/90 font-bold">{stock.quantity}</span>
                    {stock.currentPrice != null && stock.currentPrice > 0 ? (
                      <span className="text-[9px] text-muted-foreground font-mono">
                        @ {stock.currentPrice < 1000 ? stock.currentPrice.toFixed(2) : stock.currentPrice.toFixed(0)}
                      </span>
                    ) : null}
                    <span className="text-[9px] text-muted-foreground font-bold tracking-tighter">
                      {stock.marketValue > 0 ? `${jpyFmt.format(stock.marketValue)}（推定）` : "—"}
                    </span>
                    {stock.valuationFactor !== 1 ? (
                      <span className="text-[8px] text-amber-500/90 font-mono">factor {stock.valuationFactor}</span>
                    ) : null}
                    <span className="text-[9px] font-bold uppercase tracking-tighter text-blue-400">
                      {stock.weight > 0 ? `${stock.weight.toFixed(1)}% wt` : stock.marketValue > 0 ? "0% wt" : "—"}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="group bg-card/90 border-t border-border">
              <td className={`px-6 py-3 text-xs font-bold text-foreground/90 min-w-[10rem] max-w-[11rem] ${stickyTdFootFirst}`}>
                Total: {totalHoldings} {totalHoldings === 1 ? "item" : "items"}
              </td>
              <td className={`px-6 py-3 text-right text-xs font-mono font-bold ${avgAlphaClass}`}>
                Avg: {Number.isFinite(averageAlpha) ? `${avgAlphaSign}${averageAlpha.toFixed(2)}%` : "—"}
              </td>
              <td className="px-6 py-3 text-center text-[10px] text-muted-foreground uppercase font-bold">
                Portfolio
              </td>
              <td className="px-6 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

