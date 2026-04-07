import React, { useMemo } from "react";

import type { Stock, TickerInstrumentKind } from "@/src/types/investment";
import { holdingSectorDisplay } from "@/src/lib/structure-tags";
import { stickyTdFirst, stickyTdFootFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";

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

function computeFooterAggregates(stocks: Stock[]) {
  let sumQty = 0;
  let sumMarketValueJpy = 0;
  let sumUnrealizedPnlJpy = 0;
  let sumImpliedCostJpy = 0;
  const dayChanges: number[] = [];

  for (const s of stocks) {
    // 投信などは「口」・米株は「株」で単位が異なるため、数量合計は米国株のみ。
    if (s.instrumentKind === "US_EQUITY" && Number.isFinite(s.quantity) && s.quantity > 0) {
      sumQty += s.quantity;
    }
    if (s.marketValue > 0 && Number.isFinite(s.marketValue)) {
      sumMarketValueJpy += s.marketValue;
    }
    if (s.avgAcquisitionPrice != null && s.currentPrice != null && s.currentPrice > 0) {
      sumUnrealizedPnlJpy += Number.isFinite(s.unrealizedPnlJpy) ? s.unrealizedPnlJpy : 0;
      const impliedCost = s.marketValue - s.unrealizedPnlJpy;
      if (Number.isFinite(impliedCost) && impliedCost > 0) {
        sumImpliedCostJpy += impliedCost;
      }
    }
    if (s.dayChangePercent != null && Number.isFinite(s.dayChangePercent)) {
      dayChanges.push(s.dayChangePercent);
    }
  }

  const avgDayChangePercent =
    dayChanges.length > 0
      ? Math.round((dayChanges.reduce((a, b) => a + b, 0) / dayChanges.length) * 100) / 100
      : null;

  const portfolioUnrealizedPercent =
    sumImpliedCostJpy > 0 ? Math.round((sumUnrealizedPnlJpy / sumImpliedCostJpy) * 10000) / 100 : null;

  const hasJpTrust = stocks.some((s) => s.instrumentKind === "JP_INVESTMENT_TRUST");

  return {
    count: stocks.length,
    sumQty,
    sumMarketValueJpy,
    sumUnrealizedPnlJpy,
    avgDayChangePercent,
    portfolioUnrealizedPercent,
    pnlRowCount: stocks.filter(
      (s) => s.avgAcquisitionPrice != null && s.currentPrice != null && s.currentPrice > 0,
    ).length,
    hasJpTrust,
  };
}

export function HoldingsDetailTable({ stocks }: { stocks: Stock[] }) {
  const footer = useMemo(() => computeFooterAggregates(stocks), [stocks]);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-border bg-card/60">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Portfolio accounting
        </h3>
        <p className="text-[10px] text-muted-foreground mt-1">
          含み損益・損益率は平均取得単価と最新終値（VOO ベンチマーク履歴）から算出。米株の円換算はダッシュボードの USD/JPY 定数レートを使用。
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[1100px]">
          <thead className="bg-background text-muted-foreground text-[10px] uppercase font-bold tracking-[0.08em]">
            <tr>
              <th className={`px-4 py-3 whitespace-nowrap min-w-[10rem] max-w-[12rem] ${stickyThFirst}`}>
                銘柄 / コード
              </th>
              <th className="px-4 py-3 whitespace-nowrap">市場区分</th>
              <th className="px-4 py-3 whitespace-nowrap">セクター</th>
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
          <tbody className="divide-y divide-border/60">
            {stocks.map((s) => (
              <tr key={s.id} className="group hover:bg-muted/60 transition-colors">
                <td className={`px-4 py-3 whitespace-nowrap min-w-[10rem] max-w-[12rem] ${stickyTdFirst}`}>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground max-w-[11rem] truncate" title={s.name || s.ticker}>
                        {s.name || s.ticker}
                      </span>
                      <span
                        className={`text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 ${
                          (s.accountType ?? "特定") === "NISA"
                            ? "text-emerald-600 border-emerald-500/40 bg-emerald-500/10"
                            : "text-muted-foreground border-border bg-background/60"
                        }`}
                        title="口座区分（holdings.account_type）"
                      >
                        {s.accountType ?? "特定"}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">{s.ticker}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                  {marketLabel(s.instrumentKind)}
                </td>
                <td
                  className="px-4 py-3 text-muted-foreground text-xs max-w-[140px] truncate"
                  title={
                    s.sector != null && s.sector.trim().length > 0 && s.sector.trim() !== s.secondaryTag
                      ? `DB: ${s.sector.trim()} / タグ2: ${s.secondaryTag}`
                      : holdingSectorDisplay(s.sector, s.secondaryTag)
                  }
                >
                  {holdingSectorDisplay(s.sector, s.secondaryTag)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground/85 whitespace-nowrap">{s.quantity}</td>
                <td className="px-4 py-3 text-right font-mono text-foreground/85 whitespace-nowrap">
                  {formatPriceLocal(s.instrumentKind, s.avgAcquisitionPrice)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground/85 whitespace-nowrap">
                  {formatPriceLocal(s.instrumentKind, s.currentPrice)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono font-medium whitespace-nowrap ${signedPctClass(s.dayChangePercent)}`}
                >
                  {formatSignedPercent(s.dayChangePercent)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground/85 whitespace-nowrap">
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
                <td className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  {s.category}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="group bg-card/95 border-t border-border">
              <td className={`px-4 py-3 text-xs font-bold text-foreground/90 whitespace-nowrap min-w-[10rem] max-w-[12rem] ${stickyTdFootFirst}`}>
                Σ / 平均
                <span className="block text-[10px] font-normal text-muted-foreground font-mono">
                  {footer.count} 銘柄
                </span>
              </td>
              <td className="px-4 py-3 text-[10px] text-muted-foreground whitespace-nowrap">—</td>
              <td className="px-4 py-3 text-[10px] text-muted-foreground whitespace-nowrap">—</td>
              <td
                className="px-4 py-3 text-right whitespace-nowrap"
                title="米国株の株数合計。投信（口・FANG+ 等）は単位が異なるため含みません。"
              >
                <span className="font-mono text-sm font-bold text-foreground">
                  {footer.sumQty > 0 ? footer.sumQty : "—"}
                </span>
                {footer.hasJpTrust ? (
                  <span className="block text-[9px] font-normal text-muted-foreground leading-tight mt-0.5">
                    株のみ（投信の口は除外）
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right text-[10px] text-muted-foreground whitespace-nowrap">—</td>
              <td className="px-4 py-3 text-right text-[10px] text-muted-foreground whitespace-nowrap">—</td>
              <td
                className={`px-4 py-3 text-right font-mono text-xs font-bold whitespace-nowrap ${signedPctClass(footer.avgDayChangePercent)}`}
              >
                {footer.avgDayChangePercent != null ? (
                  <span title="前日比が取れた銘柄の算術平均">
                    Avg {formatSignedPercent(footer.avgDayChangePercent)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm font-bold text-foreground whitespace-nowrap">
                {footer.sumMarketValueJpy > 0 ? jpyFmt.format(footer.sumMarketValueJpy) : "—"}
              </td>
              <td
                className={`px-4 py-3 text-right font-mono text-sm font-bold whitespace-nowrap ${signedValueClass(footer.sumUnrealizedPnlJpy)}`}
              >
                {footer.pnlRowCount > 0 ? (
                  <>
                    {footer.sumUnrealizedPnlJpy > 0 ? "+" : ""}
                    {jpyFmt.format(footer.sumUnrealizedPnlJpy)}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td
                className={`px-4 py-3 text-right font-mono text-xs font-bold whitespace-nowrap ${signedPctClass(footer.portfolioUnrealizedPercent)}`}
              >
                {footer.portfolioUnrealizedPercent != null ? (
                  <span title="Σ損益(円) ÷ Σ取得相当(円)（評価額−損益）">
                    {formatSignedPercent(footer.portfolioUnrealizedPercent)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-[10px] text-muted-foreground whitespace-nowrap">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
