import React from "react";
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
}: {
  stocks: Stock[];
  totalHoldings: number;
  averageAlpha: number;
  onTrade?: (initial: TradeEntryInitial) => void;
}) {
  const avgAlphaClass =
    averageAlpha > 0 ? "text-emerald-400" : averageAlpha < 0 ? "text-rose-400" : "text-slate-400";
  const avgAlphaSign = averageAlpha > 0 ? "+" : "";
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Inventory Status
        </h3>
        <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
          <Search size={14} className="text-slate-500" />
          <input
            className="bg-transparent border-none outline-none text-xs w-48 text-slate-300"
            placeholder="Filter structure..."
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-bold tracking-[0.1em]">
            <tr>
              <th className={`px-6 py-4 min-w-[10rem] max-w-[11rem] ${stickyThFirst}`}>Asset</th>
              <th className="px-6 py-4 text-right">Alpha</th>
              <th className="px-6 py-4 text-center">5D Trend</th>
              <th className="px-6 py-4 text-right">Position</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {stocks.map((stock) => (
              <tr key={stock.id} className="group hover:bg-slate-800/40 transition-all">
                <td className={`px-6 py-4 min-w-[10rem] max-w-[11rem] ${stickyTdFirst}`}>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                        {stock.ticker}
                      </span>
                      {onTrade ? (
                        <button
                          type="button"
                          onClick={() => onTrade({ ticker: stock.ticker, name: stock.name || undefined })}
                          className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-cyan-400 border border-cyan-500/40 px-2 py-0.5 rounded-md hover:bg-cyan-500/10"
                        >
                          Trade
                        </button>
                      ) : null}
                    </div>
                    {stock.name ? (
                      <span className="text-[10px] text-slate-400 leading-snug line-clamp-2" title={stock.name}>
                        {stock.name}
                      </span>
                    ) : null}
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">
                      {stock.tag}
                    </span>
                  </div>
                </td>
                <td
                  className={`px-6 py-4 text-right font-mono font-bold ${
                    stock.alphaHistory.length === 0
                      ? "text-slate-500"
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
                    <span className="text-slate-600 text-xs">No data</span>
                  ) : (
                    <TrendMiniChart history={stock.alphaHistory} />
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-slate-300 font-bold">{stock.quantity}</span>
                    {stock.currentPrice != null && stock.currentPrice > 0 ? (
                      <span className="text-[9px] text-slate-500 font-mono">
                        @ {stock.currentPrice < 1000 ? stock.currentPrice.toFixed(2) : stock.currentPrice.toFixed(0)}
                      </span>
                    ) : null}
                    <span className="text-[9px] text-slate-500 font-bold tracking-tighter">
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
            <tr className="group bg-slate-900/90 border-t border-slate-700">
              <td className={`px-6 py-3 text-xs font-bold text-slate-300 min-w-[10rem] max-w-[11rem] ${stickyTdFootFirst}`}>
                Total: {totalHoldings} {totalHoldings === 1 ? "item" : "items"}
              </td>
              <td className={`px-6 py-3 text-right text-xs font-mono font-bold ${avgAlphaClass}`}>
                Avg: {Number.isFinite(averageAlpha) ? `${avgAlphaSign}${averageAlpha.toFixed(2)}%` : "—"}
              </td>
              <td className="px-6 py-3 text-center text-[10px] text-slate-600 uppercase font-bold">
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

