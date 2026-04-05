import React from "react";
import { History } from "lucide-react";

import type { ClosedTradeDashboardRow } from "@/src/types/investment";

const jpyFmt = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function marketLabel(m: "JP" | "US"): string {
  return m === "JP" ? "日本" : "米国";
}

function sideLabel(s: "BUY" | "SELL"): string {
  return s === "SELL" ? "売り" : "買い";
}

function fmtQty(q: number): string {
  if (!Number.isFinite(q)) return "—";
  if (Math.abs(q - Math.round(q)) < 1e-9) return String(Math.round(q));
  return q.toLocaleString("ja-JP", { maximumFractionDigits: 4 });
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function pctClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-slate-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-400";
}

function pnlClass(v: number): string {
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-400";
}

export function ClosedTradesTable({ rows }: { rows: ClosedTradeDashboardRow[] }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
        <History size={16} className="text-amber-500/90" />
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">取引履歴</h3>
          <p className="text-[10px] text-slate-600 mt-0.5">
            完了済み売買（DB: trade_history・売却のみ）。現在価格は Yahoo 終値ベース（米国株は{" "}
            <span className="font-mono text-slate-500">USD_JPY_RATE</span> で円換算）。
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500">
          行がありません。マイグレーション{" "}
          <span className="font-mono text-slate-400">005_trade_history</span> を適用し、
          <span className="font-mono text-slate-400"> trade_history</span> にデータを投入してください。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1280px]">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-bold tracking-[0.06em]">
              <tr>
                <th className="px-3 py-3 whitespace-nowrap">約定日</th>
                <th className="px-3 py-3 whitespace-nowrap">ティッカー</th>
                <th className="px-3 py-3 whitespace-nowrap min-w-[140px]">銘柄名</th>
                <th className="px-3 py-3 whitespace-nowrap">市場</th>
                <th className="px-3 py-3 whitespace-nowrap">口座</th>
                <th className="px-3 py-3 whitespace-nowrap">売買</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">数量</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">取得代金（円）</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">譲渡代金（円）</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">諸経費</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">確定損益</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">現在価格（円/単位）</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">売却後騰落率</th>
                <th className="px-3 py-3 whitespace-nowrap">売却判定</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/35 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-slate-300 text-xs whitespace-nowrap">
                    {r.tradeDate}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-200 text-xs whitespace-nowrap">
                    {r.ticker}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs">{r.name || "—"}</td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                    {marketLabel(r.market)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                    {r.accountName}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {sideLabel(r.side)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-300 text-xs">
                    {fmtQty(r.quantity)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-300 text-xs">
                    {jpyFmt.format(r.costJpy)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-300 text-xs">
                    {jpyFmt.format(r.proceedsJpy)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-400 text-xs">
                    {jpyFmt.format(r.feesJpy)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono text-xs font-medium ${pnlClass(r.realizedPnlJpy)}`}
                  >
                    {jpyFmt.format(r.realizedPnlJpy)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-200 text-xs">
                    {r.currentPriceJpy != null && Number.isFinite(r.currentPriceJpy)
                      ? jpyFmt.format(r.currentPriceJpy)
                      : "—"}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono text-xs font-medium ${pctClass(r.postExitReturnPct)}`}
                  >
                    {fmtPct(r.postExitReturnPct)}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap text-slate-200">
                    {r.verdictLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
