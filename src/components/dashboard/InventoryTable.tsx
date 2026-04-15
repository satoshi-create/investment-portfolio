"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Search } from "lucide-react";

import type { ExpectationCategory, Stock } from "@/src/types/investment";
import { EXPECTATION_CATEGORY_KEYS, EXPECTATION_CATEGORY_LABEL_JA } from "@/src/types/investment";
import { expectationCategoryBadgeClass, expectationCategoryBadgeShortJa } from "@/src/lib/expectation-category";
import { STOCK_CSV_COLUMNS, stocksToCsvRows } from "@/src/lib/csv-dashboard-presets";
import { exportToCSV, portfolioCsvFileName } from "@/src/lib/csv-export";
import type { TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";
import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";
import { stickyTdFirst, stickyTdFootFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";

const jpyFmt = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

type SortKey = "asset" | "alpha" | "trend" | "position" | "research" | "deviation" | "drawdown";

function deviationOf(s: Stock): number | null {
  const z = s.alphaDeviationZ;
  return z != null && Number.isFinite(z) ? z : null;
}

function drawdownOf(s: Stock): number | null {
  const d = s.drawdownFromHigh90dPct;
  return d != null && Number.isFinite(d) ? d : null;
}

function isOpportunityRow(s: Stock, themeStructuralTrendUp: boolean): boolean {
  if (!themeStructuralTrendUp) return false;
  const z = deviationOf(s);
  return z != null && z <= -1.5;
}

export function InventoryTable({
  stocks,
  totalHoldings,
  averageAlpha,
  onTrade,
  onTradeNew,
  themeStructuralTrendUp = false,
}: {
  stocks: Stock[];
  totalHoldings: number;
  averageAlpha: number;
  onTrade?: (initial: TradeEntryInitial) => void;
  onTradeNew?: () => void;
  /** テーマページなどで加重累積 Alpha が上向きのとき true（✨ の条件に使用） */
  themeStructuralTrendUp?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showValueCols, setShowValueCols] = useState(false);
  const [structureFilter, setStructureFilter] = useState("");
  const [expectationFilter, setExpectationFilter] = useState<"" | "__unset__" | ExpectationCategory>("");

  const filteredStocks = useMemo(() => {
    const q = structureFilter.trim().toLowerCase();
    let list = stocks;
    if (q.length > 0) {
      list = list.filter((s) => {
        const hay = [s.ticker, s.name ?? "", s.tag, s.secondaryTag, s.sector ?? ""].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    if (expectationFilter === "__unset__") {
      list = list.filter((s) => s.expectationCategory == null);
    } else if (expectationFilter !== "") {
      list = list.filter((s) => s.expectationCategory === expectationFilter);
    }
    return list;
  }, [stocks, structureFilter, expectationFilter]);

  const sortedStocks = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const lastAlpha = (s: Stock) => (s.alphaHistory.length > 0 ? s.alphaHistory[s.alphaHistory.length - 1]! : null);
    const key = sortKey;
    const arr = [...filteredStocks];
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
      if (key === "deviation") return dir * cmpNum(deviationOf(a), deviationOf(b));
      if (key === "drawdown") return dir * cmpNum(drawdownOf(a), drawdownOf(b));
      // research: prioritize upcoming earnings (smaller days), then yield.
      const earnCmp = cmpNum(
        a.daysToEarnings != null && a.daysToEarnings >= 0 ? a.daysToEarnings : null,
        b.daysToEarnings != null && b.daysToEarnings >= 0 ? b.daysToEarnings : null,
      );
      if (earnCmp !== 0) return dir * earnCmp;
      return dir * cmpNum(a.dividendYieldPercent, b.dividendYieldPercent);
    });
    return arr;
  }, [filteredStocks, sortDir, sortKey]);

  function handleCsvDownload() {
    exportToCSV(stocksToCsvRows(sortedStocks), portfolioCsvFileName("portfolio"), STOCK_CSV_COLUMNS);
  }

  function toggleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(nextKey);
      setSortDir("desc");
    }
  }

  function sortMark(k: SortKey) {
    if (k !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const avgAlphaClass =
    averageAlpha > 0 ? "text-emerald-400" : averageAlpha < 0 ? "text-rose-400" : "text-slate-400";
  const avgAlphaSign = averageAlpha > 0 ? "+" : "";

  function fmtZ(z: number | null): string {
    if (z == null) return "—";
    return `${z > 0 ? "+" : ""}${z.toFixed(2)}σ`;
  }

  function fmtDd(d: number | null): string {
    if (d == null) return "—";
    return `${d > 0 ? "+" : ""}${d.toFixed(2)}%`;
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-border flex justify-between items-center bg-card/60">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Inventory Status
        </h3>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {onTradeNew ? (
            <button
              type="button"
              onClick={onTradeNew}
              className="text-[10px] font-bold uppercase tracking-wide text-accent-cyan border border-accent-cyan/40 px-3 py-2 rounded-lg hover:bg-accent-cyan/10 transition-all"
            >
              取引入力
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowValueCols((v) => !v)}
            className={`text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-all ${
              showValueCols
                ? "text-amber-400 border-amber-500/50 bg-amber-500/10"
                : "text-muted-foreground border-border hover:bg-muted/50"
            }`}
            title="Alpha 乖離（Z）と 90 日高値からの落ち率を表示"
          >
            乖離・落率
          </button>
          <button
            type="button"
            onClick={handleCsvDownload}
            disabled={sortedStocks.length === 0}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-all"
            title="表示中の銘柄（フィルター・並び順反映）を CSV でダウンロード"
          >
            <FileSpreadsheet size={14} className="shrink-0" />
            CSVダウンロード
          </button>
          <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              value={structureFilter}
              onChange={(e) => setStructureFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-40 min-w-0 text-foreground/90"
              placeholder="構造で絞り込み…"
              aria-label="構造で絞り込み"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="inventory-expectation-filter" className="sr-only">
              期待カテゴリーで絞り込み
            </label>
            <select
              id="inventory-expectation-filter"
              value={expectationFilter}
              onChange={(e) =>
                setExpectationFilter(e.target.value as "" | "__unset__" | ExpectationCategory)
              }
              className="bg-background text-[10px] font-bold uppercase tracking-wide text-foreground/90 border border-border rounded-lg px-2 py-2 max-w-[11rem]"
              aria-label="期待カテゴリーで絞り込み"
            >
              <option value="">期待カテゴリー: すべて</option>
              <option value="__unset__">未設定のみ</option>
              {EXPECTATION_CATEGORY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {EXPECTATION_CATEGORY_LABEL_JA[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs lg:text-sm">
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
              {showValueCols ? (
                <>
                  <th
                    className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort("deviation")}
                    title="Alpha 乖離（σ）"
                  >
                    乖離{sortMark("deviation")}
                  </th>
                  <th
                    className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort("drawdown")}
                    title="90 日高値比"
                  >
                    落率{sortMark("drawdown")}
                  </th>
                </>
              ) : null}
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
              <th
                className="px-4 py-4 text-right whitespace-nowrap sticky right-[5.75rem] z-10 bg-background border-l border-border/60"
                title="現在値（Price）"
              >
                Price
              </th>
              <th
                className="px-4 py-4 text-right whitespace-nowrap sticky right-0 z-10 bg-background"
                title="取引"
              >
                Trade
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sortedStocks.map((stock) => {
              const opp = isOpportunityRow(stock, themeStructuralTrendUp);
              const z = deviationOf(stock);
              const dd = drawdownOf(stock);
              return (
                <tr key={stock.id} className="group hover:bg-muted/60 transition-all">
                  <td className={`px-6 py-4 min-w-[10rem] max-w-[11rem] ${stickyTdFirst}`}>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-foreground group-hover:text-accent-cyan transition-colors inline-flex items-center gap-1 min-w-0">
                          {opp ? (
                            <span
                              className="shrink-0 text-base leading-none"
                              title="テーマの構造トレンドは上向きだが、日次 Alpha は統計的に冷え込み（割安候補）"
                              aria-label="Opportunity"
                            >
                              ✨
                            </span>
                          ) : null}
                          <span className="truncate">{stock.ticker}</span>
                          {stock.expectationCategory ? (
                            <span
                              className={`shrink-0 text-[8px] font-bold tracking-tight px-1.5 py-0.5 rounded border ${expectationCategoryBadgeClass(stock.expectationCategory)}`}
                              title={EXPECTATION_CATEGORY_LABEL_JA[stock.expectationCategory]}
                            >
                              {expectationCategoryBadgeShortJa(stock.expectationCategory)}
                            </span>
                          ) : null}
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
                            className={`text-[10px] font-bold border px-2 py-0.5 rounded-md ${
                              stock.dividendYieldPercent >= 3
                                ? "text-amber-200 border-amber-500/40 bg-amber-500/10"
                                : "text-foreground/90 border-border bg-card/60"
                            }`}
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
                        {stock.dividendYieldPercent != null && stock.dividendYieldPercent >= 3 ? (
                          <span
                            className="text-[10px] font-bold text-amber-200 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 rounded-md"
                            title="高配当（Div% >= 3）"
                          >
                            還流
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {stock.accountType ?? "特定"}
                      </span>
                    </div>
                  </td>
                  {showValueCols ? (
                    <>
                      <td
                        className={`px-6 py-4 text-right font-mono text-xs font-bold ${
                          z == null ? "text-muted-foreground" : z < -1 ? "text-amber-400" : z > 1 ? "text-emerald-400" : "text-foreground/90"
                        }`}
                      >
                        {fmtZ(z)}
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-mono text-xs font-bold ${
                          dd == null ? "text-muted-foreground" : dd < -10 ? "text-rose-400" : "text-foreground/90"
                        }`}
                      >
                        {fmtDd(dd)}
                      </td>
                    </>
                  ) : null}
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
                  <td className="px-4 py-4 text-right sticky right-[5.75rem] z-10 bg-background group-hover:bg-muted/60 border-l border-border/60">
                    <div className="flex flex-col items-end gap-0.5 min-w-[5.75rem]">
                      <span className="font-mono text-foreground/90 font-bold tabular-nums">
                        {stock.currentPrice != null && stock.currentPrice > 0
                          ? stock.countryName === "日本"
                            ? `¥${stock.currentPrice < 1000 ? stock.currentPrice.toFixed(2) : stock.currentPrice.toFixed(0)}`
                            : `$${stock.currentPrice < 1000 ? stock.currentPrice.toFixed(2) : stock.currentPrice.toFixed(0)}`
                          : "—"}
                      </span>
                      {stock.priceSource === "live" && stock.lastUpdatedAt ? (
                        <span
                          className="inline-flex items-center gap-1 text-[9px] text-muted-foreground font-mono"
                          title={`Live（Yahoo quote）\n${new Date(stock.lastUpdatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0 motion-safe:animate-pulse" aria-hidden />
                          <span className="text-[7px] font-bold uppercase tracking-wide text-emerald-400/90">Live</span>
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right sticky right-0 z-10 bg-background group-hover:bg-muted/60 min-w-[5.75rem]">
                    {onTrade ? (
                      <button
                        type="button"
                        onClick={() =>
                          onTrade({
                            ticker: stock.ticker,
                            name: stock.name || undefined,
                            ...(stock.tag.trim().length > 0 ? { theme: stock.tag } : {}),
                            sector: stock.sector ?? stock.secondaryTag,
                            quantityDefault: 1,
                            ...(stock.expectationCategory != null
                              ? { expectationCategory: stock.expectationCategory }
                              : {}),
                            ...(stock.currentPrice != null &&
                            Number.isFinite(stock.currentPrice) &&
                            stock.currentPrice > 0
                              ? { unitPrice: stock.currentPrice }
                              : {}),
                          })
                        }
                        className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-accent-cyan border border-accent-cyan/40 px-2 py-1 rounded-md hover:bg-accent-cyan/10"
                      >
                        Trade
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="group bg-card/90 border-t border-border">
              <td className={`px-6 py-3 text-xs font-bold text-foreground/90 min-w-[10rem] max-w-[11rem] ${stickyTdFootFirst}`}>
                Total: {sortedStocks.length}
                {sortedStocks.length === 1 ? " item" : " items"}
                {structureFilter.trim() || expectationFilter !== "" ? `（全 ${totalHoldings}）` : ""}
              </td>
              <td className="px-6 py-3" />
              {showValueCols ? (
                <>
                  <td className="px-6 py-3" />
                  <td className="px-6 py-3" />
                </>
              ) : null}
              <td className={`px-6 py-3 text-right text-xs font-mono font-bold ${avgAlphaClass}`}>
                Avg: {Number.isFinite(averageAlpha) ? `${avgAlphaSign}${averageAlpha.toFixed(2)}%` : "—"}
              </td>
              <td className="px-6 py-3 text-center text-[10px] text-muted-foreground uppercase font-bold">
                Portfolio
              </td>
              <td className="px-6 py-3" />
              <td className="px-4 py-3 sticky right-[5.75rem] z-10 bg-card/90 border-l border-border/60" />
              <td className="px-4 py-3 sticky right-0 z-10 bg-card/90" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
