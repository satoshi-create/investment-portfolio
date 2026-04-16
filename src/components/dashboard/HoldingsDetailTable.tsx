import React, { useMemo, useState } from "react";

import type { Stock, TickerInstrumentKind } from "@/src/types/investment";
import { holdingSectorDisplay } from "@/src/lib/structure-tags";
import { stickyTdFirst, stickyTdFootFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";

const jpyFmt = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function marketLabel(kind: TickerInstrumentKind): string {
  if (kind === "US_EQUITY") return "米国株";
  if (kind === "JP_LISTED_EQUITY") return "日本株";
  return "日本投信";
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
    if (
      (s.instrumentKind === "US_EQUITY" || s.instrumentKind === "JP_LISTED_EQUITY") &&
      Number.isFinite(s.quantity) &&
      s.quantity > 0
    ) {
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
  const [sortKey, setSortKey] = useState<
    "ticker" | "market" | "sector" | "qty" | "avg" | "price" | "day" | "mv" | "pnl" | "pnlpct" | "cat" | "research"
  >("mv");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...stocks];
    const cmpStr = (a: string, b: string) => a.localeCompare(b, "ja");
    const cmpNum = (a: number | null, b: number | null) => {
      const ax = a == null || !Number.isFinite(a) ? null : a;
      const by = b == null || !Number.isFinite(b) ? null : b;
      if (ax == null && by == null) return 0;
      if (ax == null) return 1;
      if (by == null) return -1;
      return ax < by ? -1 : ax > by ? 1 : 0;
    };
    arr.sort((a, b) => {
      switch (sortKey) {
        case "ticker":
          return dir * cmpStr(a.ticker, b.ticker);
        case "market":
          return dir * cmpStr(marketLabel(a.instrumentKind), marketLabel(b.instrumentKind));
        case "sector":
          return dir * cmpStr(holdingSectorDisplay(a.sector, a.secondaryTag), holdingSectorDisplay(b.sector, b.secondaryTag));
        case "qty":
          return dir * cmpNum(a.quantity, b.quantity);
        case "avg":
          return dir * cmpNum(a.avgAcquisitionPrice, b.avgAcquisitionPrice);
        case "price":
          return dir * cmpNum(a.currentPrice, b.currentPrice);
        case "day":
          return dir * cmpNum(a.dayChangePercent, b.dayChangePercent);
        case "mv":
          return dir * cmpNum(a.marketValue, b.marketValue);
        case "pnl":
          return dir * cmpNum(a.unrealizedPnlJpy, b.unrealizedPnlJpy);
        case "pnlpct":
          return dir * cmpNum(a.unrealizedPnlPercent, b.unrealizedPnlPercent);
        case "cat":
          return dir * cmpStr(a.category, b.category);
        case "research": {
          const earnCmp = cmpNum(
            a.daysToEarnings != null && a.daysToEarnings >= 0 ? a.daysToEarnings : null,
            b.daysToEarnings != null && b.daysToEarnings >= 0 ? b.daysToEarnings : null,
          );
          if (earnCmp !== 0) return dir * earnCmp;
          return dir * cmpNum(a.dividendYieldPercent, b.dividendYieldPercent);
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [stocks, sortDir, sortKey]);

  function toggleSort(next: typeof sortKey) {
    if (next === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(next);
      setSortDir("desc");
    }
  }

  function sortMark(k: typeof sortKey) {
    if (k !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-border bg-card/60">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Portfolio accounting
        </h3>
        <p className="text-[10px] text-muted-foreground mt-1">
          含み損益・損益率は平均取得単価と Yahoo 日足ベースの最新終値から算出。米株の円換算はダッシュボード取得の USD/JPY（JPY=X、失敗時フォールバック）を使用。
        </p>
      </div>
      <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
        <table className="w-full text-left text-sm min-w-[1100px]">
          <thead className="bg-background text-muted-foreground text-[10px] uppercase font-bold tracking-[0.08em]">
            <tr>
              <th
                className={`px-4 py-3 whitespace-nowrap min-w-[10rem] max-w-[12rem] ${stickyThFirst} cursor-pointer select-none`}
                onClick={() => toggleSort("ticker")}
                title="Sort"
              >
                銘柄 / コード{sortMark("ticker")}
              </th>
              <th className="px-4 py-3 whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("market")} title="Sort">
                市場区分{sortMark("market")}
              </th>
              <th className="px-4 py-3 whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("sector")} title="Sort">
                セクター{sortMark("sector")}
              </th>
              <th className="px-4 py-3 whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("research")} title="Sort">
                リサーチ{sortMark("research")}
              </th>
              <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("qty")} title="Sort">
                数量{sortMark("qty")}
              </th>
              <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("avg")} title="Sort">
                平均取得単価{sortMark("avg")}
              </th>
              <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("price")} title="Sort">
                現在価格{sortMark("price")}
              </th>
              <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("day")} title="Sort">
                前日比{sortMark("day")}
              </th>
              <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("mv")} title="Sort">
                評価額（円）{sortMark("mv")}
              </th>
              <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("pnl")} title="Sort">
                損益（円）{sortMark("pnl")}
              </th>
              <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("pnlpct")} title="Sort">
                損益率{sortMark("pnlpct")}
              </th>
              <th className="px-4 py-3 whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("cat")} title="Sort">
                カテゴリ{sortMark("cat")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sorted.map((s) => (
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
                <td className="px-4 py-3 text-xs whitespace-nowrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-muted-foreground border border-border bg-background/60 px-2 py-0.5 rounded-md">
                      {s.countryName}
                    </span>
                    {s.nextEarningsDate ? (
                      <span className="text-[10px] font-bold text-foreground/90 border border-border bg-card/60 px-2 py-0.5 rounded-md" title={`次期決算予定日: ${s.nextEarningsDate}`}>
                        E:{s.daysToEarnings != null ? `D${s.daysToEarnings}` : s.nextEarningsDate}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">E:—</span>
                    )}
                    {s.dividendYieldPercent != null ? (
                      <span className="text-[10px] font-bold text-foreground/90 border border-border bg-card/60 px-2 py-0.5 rounded-md">
                        Div:{s.dividendYieldPercent.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Div:—</span>
                    )}
                  </div>
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
                title="米国株・日本株の株数合計。投信（口・FANG+ 等）は単位が異なるため含みません。"
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
