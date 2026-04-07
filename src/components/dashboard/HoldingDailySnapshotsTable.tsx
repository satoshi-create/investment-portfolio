import React from "react";
import { Layers } from "lucide-react";

import type { HoldingDailySnapshotRow, TickerInstrumentKind } from "@/src/types/investment";
import { stickyTdFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";

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
  if (v == null) return "text-muted-foreground";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function signedValueClass(v: number): string {
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function formatSignedPercent(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

type Props = {
  snapshotDate: string | null;
  rows: HoldingDailySnapshotRow[];
};

export function HoldingDailySnapshotsTable({ snapshotDate, rows }: Props) {
  const bench = rows[0]?.benchmarkClose;
  const fx = rows[0]?.fxUsdJpy;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-border bg-card/60 flex items-start gap-2">
        <Layers size={16} className="text-violet-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Holding snapshots (銘柄×日)
          </h3>
          <p className="text-[10px] text-muted-foreground mt-1">
            Record snapshot 実行時に `holding_daily_snapshots` へ保存された最新スライス
            {snapshotDate ? (
              <span className="text-muted-foreground/90 font-mono"> · UTC {snapshotDate}</span>
            ) : null}
            {bench != null && bench > 0 ? (
              <span className="text-muted-foreground/90">
                {" "}
                · VOO {bench.toFixed(2)} · FX {fx?.toFixed(0) ?? "—"}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          データがありません。マイグレーション適用後に{" "}
          <span className="font-mono text-muted-foreground/90">Record snapshot</span> を実行してください。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1050px]">
            <thead className="bg-background text-muted-foreground text-[10px] uppercase font-bold tracking-[0.06em]">
              <tr>
                <th className={`px-4 py-3 whitespace-nowrap min-w-[10rem] max-w-[12rem] ${stickyThFirst}`}>
                  銘柄 / コード
                </th>
                <th className="px-4 py-3 whitespace-nowrap">市場</th>
                <th className="px-4 py-3 whitespace-nowrap">業界</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">数量</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">取得単価</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">終値</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">前日比</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">評価額（円）</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">損益（円）</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">損益率</th>
                <th className="px-4 py-3 whitespace-nowrap">Cat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {rows.map((r) => (
                <tr key={r.id} className="group hover:bg-slate-800/35 transition-colors">
                  <td className={`px-4 py-2.5 whitespace-nowrap min-w-[10rem] max-w-[12rem] ${stickyTdFirst}`}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-slate-100 max-w-[11rem] truncate" title={r.name || r.ticker}>
                        {r.name || r.ticker}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{r.ticker}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{marketLabel(r.instrumentKind)}</td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[120px] truncate" title={r.secondaryTag}>
                    {r.secondaryTag}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300 text-xs">{r.quantity}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300 text-xs">
                    {formatPriceLocal(r.instrumentKind, r.avgAcquisitionPrice)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300 text-xs">
                    {formatPriceLocal(r.instrumentKind, r.closePrice)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono text-xs font-medium ${signedPctClass(r.dayChangePct)}`}
                  >
                    {formatSignedPercent(r.dayChangePct)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-200 text-xs">
                    {r.marketValueJpy > 0 ? jpyFmt.format(r.marketValueJpy) : "—"}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono text-xs font-medium ${signedValueClass(r.unrealizedPnlJpy ?? 0)}`}
                  >
                    {r.avgAcquisitionPrice != null && r.closePrice != null && r.closePrice > 0 ? (
                      <>
                        {(r.unrealizedPnlJpy ?? 0) > 0 ? "+" : ""}
                        {jpyFmt.format(r.unrealizedPnlJpy ?? 0)}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono text-xs font-medium ${signedPctClass(r.unrealizedPnlPct)}`}
                  >
                    {r.avgAcquisitionPrice != null && r.closePrice != null && r.closePrice > 0
                      ? formatSignedPercent(r.unrealizedPnlPct)
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                    {r.category === "Core" ? "Core" : "Sat"}
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
