import React from "react";
import { Search } from "lucide-react";

import type { Stock } from "@/src/types/investment";
import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";

export function InventoryTable({ stocks }: { stocks: Stock[] }) {
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
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4 text-right">Alpha</th>
              <th className="px-6 py-4 text-center">5D Trend</th>
              <th className="px-6 py-4 text-right">Position</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {stocks.map((stock) => (
              <tr key={stock.id} className="hover:bg-slate-800/40 transition-all group">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                      {stock.ticker}
                    </span>
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
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-slate-300 font-bold">{stock.quantity}</span>
                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">
                      {stock.weight > 0 ? `${stock.weight}% Wgt` : "—"}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

