"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, NotebookPen, Search, X } from "lucide-react";

import type { ExpectationCategory, Stock } from "@/src/types/investment";
import { EXPECTATION_CATEGORY_KEYS, EXPECTATION_CATEGORY_LABEL_JA } from "@/src/types/investment";
import { expectationCategoryBadgeClass, expectationCategoryBadgeShortJa } from "@/src/lib/expectation-category";
import { STOCK_CSV_COLUMNS, stocksToCsvRows } from "@/src/lib/csv-dashboard-presets";
import { exportToCSV, portfolioCsvFileName } from "@/src/lib/csv-export";
import { EARNINGS_SUMMARY_NOTE_MAX_LEN } from "@/src/lib/earnings-summary-note-meta";
import { fetchWithTimeout } from "@/src/lib/fetch-utils";
import { EarningsNoteMarkdownPreview } from "@/src/components/dashboard/EarningsNoteMarkdownPreview";
import type { TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";
import { EcosystemKeepButton } from "@/src/components/dashboard/EcosystemKeepButton";
import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";
import { stickyTdFirst, stickyTdFootFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";
import { detectOpportunityType } from "@/src/lib/alpha-logic";
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";
import {
  formatJpyValueForView,
  formatLocalPriceForView,
  nativeCurrencyForStock,
} from "@/src/lib/format-display-currency";

type SortKey = "asset" | "alpha" | "trend" | "position" | "research" | "deviation" | "drawdown";

type EarningsNoteModalTab = "edit" | "preview";

function deviationOf(s: Stock): number | null {
  const z = s.alphaDeviationZ;
  return z != null && Number.isFinite(z) ? z : null;
}

function drawdownOf(s: Stock): number | null {
  const d = s.drawdownFromHigh90dPct;
  return d != null && Number.isFinite(d) ? d : null;
}

function peOf(s: Stock): number | null {
  const v = s.trailingPe ?? s.forwardPe ?? null;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function epsOf(s: Stock): number | null {
  const v = s.trailingEps ?? s.forwardEps ?? null;
  return v != null && Number.isFinite(v) ? v : null;
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
  averageFxNeutralAlpha: averageFxNeutralAlphaProp,
  userId,
  onEarningsNoteSaved,
  onTrade,
  onTradeNew,
  themeStructuralTrendUp = false,
  resolveEcosystemKeep,
  onToggleEcosystemKeep,
}: {
  stocks: Stock[];
  totalHoldings: number;
  averageAlpha: number;
  /** 決算メモ保存 API 用 */
  userId: string;
  /** メモ保存成功後にダッシュボード / テーマを再取得する */
  onEarningsNoteSaved?: () => void | Promise<void>;
  onTrade?: (initial: TradeEntryInitial) => void;
  onTradeNew?: () => void;
  /** テーマページなどで加重累積 Alpha が上向きのとき true（✨ の条件に使用） */
  themeStructuralTrendUp?: boolean;
  /** 名目為替に依らない平均日次 α（省略時は `averageAlpha`） */
  averageFxNeutralAlpha?: number;
  /** テーマページ: エコシステムに同一銘柄があるときキープトグルを表示 */
  resolveEcosystemKeep?: (ticker: string) => { memberId: string; isKept: boolean } | null;
  onToggleEcosystemKeep?: (memberId: string) => void | Promise<void>;
}) {
  const { convert, viewCurrency, alphaDisplayMode } = useCurrencyConverter();
  const averageFxNeutralAlpha = averageFxNeutralAlphaProp ?? averageAlpha;
  const displayAvgAlpha =
    alphaDisplayMode === "fxNeutral" ? averageFxNeutralAlpha : averageAlpha;

  const [noteModalStock, setNoteModalStock] = useState<Stock | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteModalTab, setNoteModalTab] = useState<EarningsNoteModalTab>("edit");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteErr, setNoteErr] = useState<string | null>(null);

  useEffect(() => {
    if (noteModalStock) {
      setNoteDraft(noteModalStock.earningsSummaryNote ?? "");
      setNoteErr(null);
      setNoteModalTab("edit");
    }
  }, [noteModalStock]);

  useEffect(() => {
    if (!noteModalStock) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !noteSaving) setNoteModalStock(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [noteModalStock, noteSaving]);

  async function saveEarningsNote() {
    if (!noteModalStock) return;
    setNoteSaving(true);
    setNoteErr(null);
    try {
      const res = await fetchWithTimeout(
        "/api/holdings/earnings-summary-note",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            holdingId: noteModalStock.id,
            earningsSummaryNote: noteDraft,
          }),
        },
        { timeoutMs: 12_000 },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setNoteErr(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setNoteModalStock(null);
      await onEarningsNoteSaved?.();
    } catch (e) {
      setNoteErr(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setNoteSaving(false);
    }
  }

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
    displayAvgAlpha > 0 ? "text-emerald-400" : displayAvgAlpha < 0 ? "text-rose-400" : "text-slate-400";
  const avgAlphaSign = displayAvgAlpha > 0 ? "+" : "";

  function fmtZ(z: number | null): string {
    if (z == null) return "—";
    return `${z > 0 ? "+" : ""}${z.toFixed(2)}σ`;
  }

  function fmtDd(d: number | null): string {
    if (d == null) return "—";
    return `${d > 0 ? "+" : ""}${d.toFixed(2)}%`;
  }

  function fmtPe(v: number | null): string {
    if (v == null) return "—";
    if (!Number.isFinite(v) || v <= 0) return "—";
    return v >= 100 ? v.toFixed(0) : v.toFixed(1);
  }

  function fmtEps(v: number | null): string {
    if (v == null) return "—";
    if (!Number.isFinite(v)) return "—";
    const abs = Math.abs(v);
    if (abs >= 100) return v.toFixed(0);
    if (abs >= 10) return v.toFixed(2);
    return v.toFixed(3);
  }

  function fmtPct0(v: number): string {
    if (!Number.isFinite(v)) return "—";
    return `${v.toFixed(1)}%`;
  }

  function rule40Tone(v: number): { text: string; cls: string } {
    if (!Number.isFinite(v)) return { text: "—", cls: "text-muted-foreground" };
    if (v >= 40) return { text: fmtPct0(v), cls: "text-green-500 font-bold" };
    if (v >= 0) return { text: fmtPct0(v), cls: "text-foreground/90 font-bold" };
    return { text: fmtPct0(v), cls: "text-rose-300 font-bold" };
  }

  function fcfYieldTone(v: number): { text: string; cls: string } {
    if (!Number.isFinite(v)) return { text: "—", cls: "text-muted-foreground" };
    if (v >= 6) return { text: fmtPct0(v), cls: "text-emerald-300 font-bold" };
    if (v >= 0) return { text: fmtPct0(v), cls: "text-foreground/90 font-bold" };
    return { text: fmtPct0(v), cls: "text-rose-300 font-bold" };
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

      <div className="relative w-full max-w-full overflow-x-auto overscroll-x-contain touch-auto [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[760px] text-left text-xs lg:text-sm">
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
              <th className="px-6 py-4 text-right whitespace-nowrap" title="Rule of 40（売上成長率% + FCFマージン%）">
                Rule of 40
              </th>
              <th
                className="px-6 py-4 text-right whitespace-nowrap"
                title="FCF Yield（%）= 年次 FCF / (株価×希薄化株数)。負の FCF はマイナス%で表示"
              >
                FCF Yield
              </th>
              <th className="px-4 py-4 text-center whitespace-nowrap" title="押し目（Dip）判定">
                Opportunity
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
                <span className="block">Alpha{sortMark("alpha")}</span>
                {alphaDisplayMode === "fxNeutral" ? (
                  <span className="block text-[8px] font-normal normal-case tracking-normal text-muted-foreground/85">
                    FX-neutral
                  </span>
                ) : null}
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
                className="px-4 py-4 text-right whitespace-nowrap bg-background md:sticky md:right-[5.75rem] md:z-10 md:border-l md:border-border/60"
                title="現在値（Price）"
              >
                Price
              </th>
              <th
                className="px-4 py-4 text-right whitespace-nowrap bg-background md:sticky md:right-0 md:z-10"
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
              const opportunityType = detectOpportunityType({
                alphaDeviationZ: z,
                drawdownFromHighPct: dd,
              });
              const ecoKeep =
                resolveEcosystemKeep != null ? resolveEcosystemKeep(stock.ticker) : null;
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
                          {ecoKeep != null && onToggleEcosystemKeep != null ? (
                            <EcosystemKeepButton
                              size="xs"
                              isKept={ecoKeep.isKept}
                              onClick={() => void onToggleEcosystemKeep(ecoKeep.memberId)}
                            />
                          ) : null}
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
                        <button
                          type="button"
                          onClick={() => setNoteModalStock(stock)}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide border px-2 py-0.5 rounded-md transition-colors ${
                            stock.earningsSummaryNote != null && stock.earningsSummaryNote.trim().length > 0
                              ? "text-violet-200 border-violet-500/45 bg-violet-500/15 hover:bg-violet-500/25"
                              : "text-muted-foreground border-border bg-background/60 hover:bg-muted/70 hover:text-foreground/90"
                          }`}
                          title="決算要約メモを表示・編集"
                        >
                          <NotebookPen size={12} className="shrink-0" aria-hidden />
                          メモ
                        </button>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {stock.accountType ?? "特定"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs">
                    {(() => {
                      const r40 = rule40Tone(stock.ruleOf40);
                      return (
                        <span className={r40.cls} title="Rule of 40 = revenueGrowth + fcfMargin">
                          {r40.text}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs">
                    {(() => {
                      const fy = fcfYieldTone(stock.fcfYield);
                      return (
                        <span
                          className={fy.cls}
                          title="FCF Yield（高いほど割安。年次 FCF が負のときはマイナス%）"
                        >
                          {fy.text}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {opportunityType === "DEEP_VALUE" ? (
                      <span className="text-base leading-none" title="Deep Value（Z<-1.5σ & 落率>20%）" aria-label="Deep Value">
                        💎
                      </span>
                    ) : opportunityType === "STRUCTURAL_DIP" ? (
                      <span className="text-base leading-none" title="Structural Dip（-0.5σ<Z<+0.5σ & 落率>30%）" aria-label="Structural Dip">
                        🌊
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
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
                      <TrendMiniChart history={stock.alphaHistory} maxPoints={5} />
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-mono text-foreground/90 font-bold">{stock.quantity}</span>
                      <span className="text-[9px] text-muted-foreground font-bold tracking-tighter">
                        {stock.marketValue > 0
                          ? `${formatJpyValueForView(stock.marketValue, viewCurrency, convert)}（推定）`
                          : "—"}
                      </span>
                      {stock.valuationFactor !== 1 ? (
                        <span className="text-[8px] text-amber-500/90 font-mono">factor {stock.valuationFactor}</span>
                      ) : null}
                      <span className="text-[9px] font-bold uppercase tracking-tighter text-blue-400">
                        {stock.weight > 0 ? `${stock.weight.toFixed(1)}% wt` : stock.marketValue > 0 ? "0% wt" : "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right bg-card md:sticky md:right-[5.75rem] md:z-10 md:bg-background group-hover:bg-muted/60 md:border-l md:border-border/60">
                    <div className="flex flex-col items-end gap-0.5 min-w-[5.75rem]">
                      <span className="font-mono text-foreground/90 font-bold tabular-nums">
                        {stock.currentPrice != null && stock.currentPrice > 0
                          ? formatLocalPriceForView(
                              stock.currentPrice,
                              nativeCurrencyForStock(stock),
                              viewCurrency,
                              convert,
                            )
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
                      {(() => {
                        const pe = peOf(stock);
                        const eps = epsOf(stock);
                        const epsIsLoss = eps != null && eps <= 0;
                        const hasAny = pe != null || eps != null || epsIsLoss;
                        if (!hasAny) return null;
                        return (
                          <span
                            className="text-[9px] font-mono text-muted-foreground whitespace-nowrap"
                            title={[
                              `PER: trailing=${stock.trailingPe ?? "—"} / forward=${stock.forwardPe ?? "—"}`,
                              `EPS: trailing=${stock.trailingEps ?? "—"} / forward=${stock.forwardEps ?? "—"}`,
                              epsIsLoss ? "EPS <= 0（赤字・特損など含む）。PERは参考になりにくいので注意。" : "",
                            ]
                              .filter((x) => x.length > 0)
                              .join("\n")}
                          >
                            <span className={epsIsLoss ? "text-rose-300 font-bold" : ""}>
                              {epsIsLoss ? "赤字 " : ""}
                            </span>
                            <span>PER {fmtPe(pe)}</span>
                            <span className="mx-1">/</span>
                            <span>EPS {fmtEps(eps)}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right bg-card md:sticky md:right-0 md:z-10 md:bg-background group-hover:bg-muted/60 min-w-[5.75rem]">
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
              <td className="px-4 py-3" />
              {showValueCols ? (
                <>
                  <td className="px-6 py-3" />
                  <td className="px-6 py-3" />
                </>
              ) : null}
              <td className={`px-6 py-3 text-right text-xs font-mono font-bold ${avgAlphaClass}`}>
                Avg: {Number.isFinite(displayAvgAlpha) ? `${avgAlphaSign}${displayAvgAlpha.toFixed(2)}%` : "—"}
              </td>
              <td className="px-6 py-3 text-center text-[10px] text-muted-foreground uppercase font-bold">
                Portfolio
              </td>
              <td className="px-6 py-3" />
              <td className="px-4 py-3 bg-card/90 md:sticky md:right-[5.75rem] md:z-10 md:border-l md:border-border/60" />
              <td className="px-4 py-3 bg-card/90 md:sticky md:right-0 md:z-10" />
            </tr>
          </tfoot>
        </table>
      </div>

      {noteModalStock ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"
            aria-label="モーダルを閉じる"
            onClick={() => !noteSaving && setNoteModalStock(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="earnings-note-title"
            className="relative z-10 flex max-h-[min(90dvh,42rem)] w-[min(100%,26rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl min-h-0 sm:max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <div className="min-w-0 space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Research</p>
                <h2 id="earnings-note-title" className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                  決算要約メモ
                </h2>
                <p className="text-[11px] font-mono text-accent-cyan truncate">{noteModalStock.ticker}</p>
                {noteModalStock.name ? (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{noteModalStock.name}</p>
                ) : null}
                {noteModalStock.nextEarningsDate ? (
                  <p className="text-[10px] text-muted-foreground">
                    次回決算: {noteModalStock.nextEarningsDate}
                    {noteModalStock.daysToEarnings != null ? `（あと ${noteModalStock.daysToEarnings} 日）` : ""}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">次回決算日: 未取得</p>
                )}
              </div>
              <button
                type="button"
                disabled={noteSaving}
                onClick={() => setNoteModalStock(null)}
                className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation disabled:opacity-40"
                aria-label="閉じる"
              >
                <X size={20} />
              </button>
            </div>

            <div
              className="flex shrink-0 gap-1 border-b border-border px-3 pt-2 sm:px-4"
              role="tablist"
              aria-label="メモ表示切替"
            >
              <button
                type="button"
                role="tab"
                aria-selected={noteModalTab === "edit"}
                disabled={noteSaving}
                onClick={() => setNoteModalTab("edit")}
                className={`rounded-t-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-40 ${
                  noteModalTab === "edit"
                    ? "bg-background text-foreground border border-b-0 border-border -mb-px"
                    : "text-muted-foreground hover:text-foreground/90"
                }`}
              >
                編集
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={noteModalTab === "preview"}
                disabled={noteSaving}
                onClick={() => setNoteModalTab("preview")}
                className={`rounded-t-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-40 ${
                  noteModalTab === "preview"
                    ? "bg-background text-foreground border border-b-0 border-border -mb-px"
                    : "text-muted-foreground hover:text-foreground/90"
                }`}
              >
                プレビュー
              </button>
            </div>

            <div className="min-h-0 flex-1 flex flex-col gap-3 px-4 py-3 sm:px-5 sm:py-4 bg-background">
              {noteModalTab === "edit" ? (
                <>
                  <label htmlFor="earnings-summary-note" className="sr-only">
                    決算要約メモ
                  </label>
                  <textarea
                    id="earnings-summary-note"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    maxLength={EARNINGS_SUMMARY_NOTE_MAX_LEN}
                    rows={10}
                    disabled={noteSaving}
                    className="min-h-[12rem] w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 disabled:opacity-50"
                    placeholder="Markdown 対応（見出し・リスト・表・コードブロックなど）。空にして保存で削除。"
                  />
                  <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>
                      {noteDraft.length} / {EARNINGS_SUMMARY_NOTE_MAX_LEN}
                    </span>
                    {noteErr ? (
                      <span className="text-destructive font-bold text-right flex-1">{noteErr}</span>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-muted-foreground -mt-1 mb-1">
                    入力中の内容を Markdown として表示します（未保存の編集も反映）。
                  </p>
                  <div className="min-h-[12rem] max-h-[min(52vh,24rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
                    <EarningsNoteMarkdownPreview markdown={noteDraft} />
                  </div>
                  {noteErr ? (
                    <div className="flex items-center justify-end text-[10px] text-destructive font-bold">{noteErr}</div>
                  ) : null}
                </>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={noteSaving}
                  onClick={() => setNoteModalStock(null)}
                  className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground border border-border px-4 py-2 rounded-lg hover:bg-muted/60 disabled:opacity-40"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={noteSaving}
                  onClick={() => void saveEarningsNote()}
                  className="text-[11px] font-bold uppercase tracking-wide text-background bg-accent-cyan px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-40"
                >
                  {noteSaving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
