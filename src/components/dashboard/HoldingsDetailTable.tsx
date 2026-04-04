import React from "react";

import type { Stock, TickerInstrumentKind } from "@/src/types/investment";

const jpyFmt = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function marketLabel(kind: TickerInstrumentKind): string {
  return kind === "JP_INVESTMENT_TRUST" ? "日本投信" : "米国株";
}

function formatPriceLocal(kind: TickerInstrumentKind, price: number | null): string {
  if (price == null || !Number.isFinite(price) || price <= 0) return "—";
  if (kind === "US_EQUITY") return `$${price.toFixed(2)}`;
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(price);
}

function signedPctClass(v: number | null): string {
  if (v == null) return "text-slate-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-400";
}

function signedValueClass(v: number): string {
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-400";
}

function formatSignedPercent(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export function HoldingsDetailTable({ stocks }: { stocks: Stock[] }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-slate-800 bg-slate-900/50">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Portfolio accounting
        </h3>
        <p className="text-[10px] text-slate-600 mt-1">
          含み損益・損益率は平均取得単価と最新終値（VOO ベンチマーク履歴）から算出。米株の円換算は Core/Satellite と同じ定数レートを使用。
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[1100px]">
          <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-bold tracking-[0.08em]">
            <tr>
              <th className="px-4 py-3 whitespace-nowrap">銘柄 / コード</th>
              <th className="px-4 py-3 whitespace-nowrap">市場区分</th>
              <th className="px-4 py-3 whitespace-nowrap">業界</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">数量</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">平均取得単価</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">現在価格</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">前日比</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">評価額（円）</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">損益（円）</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">損益率</th>
              <th className="px-4 py-3 whitespace-nowrap">カテゴリ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {stocks.map((s) => (
              <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-slate-100 max-w-[200px] truncate" title={s.name}>
                      {s.name || s.ticker}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{s.ticker}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                  {marketLabel(s.instrumentKind)}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs max-w-[140px] truncate" title={s.secondaryTag}>
                  {s.secondaryTag}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-300 whitespace-nowrap">{s.quantity}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-300 whitespace-nowrap">
                  {formatPriceLocal(s.instrumentKind, s.avgAcquisitionPrice)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-300 whitespace-nowrap">
                  {formatPriceLocal(s.instrumentKind, s.currentPrice)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono font-medium whitespace-nowrap ${signedPctClass(s.dayChangePercent)}`}
                >
                  {formatSignedPercent(s.dayChangePercent)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-300 whitespace-nowrap">
                  {s.marketValue > 0 ? jpyFmt.format(s.marketValue) : "—"}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono font-medium whitespace-nowrap ${signedValueClass(s.unrealizedPnlJpy)}`}
                >
                  {s.avgAcquisitionPrice != null && s.currentPrice != null && s.currentPrice > 0
                    ? `${s.unrealizedPnlJpy > 0 ? "+" : ""}${jpyFmt.format(s.unrealizedPnlJpy)}`
                    : "—"}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono font-medium whitespace-nowrap ${signedPctClass(s.unrealizedPnlPercent)}`}
                >
                  {s.avgAcquisitionPrice != null && s.currentPrice != null && s.currentPrice > 0
                    ? formatSignedPercent(s.unrealizedPnlPercent)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-400 whitespace-nowrap">
                  {s.category}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
