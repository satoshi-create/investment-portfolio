"use client";

import React, { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  CircleSlash,
  FileSpreadsheet,
  Gem,
  GripVertical,
  Search,
  Star,
  X,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { LynchCategory, ResourceStructuralSyncData, Stock } from "@/src/types/investment";
import {
  LYNCH_CATEGORY_LABEL_JA,
  INVESTMENT_METRIC_TONE_TEXT_CLASS,
  investmentMetricToneForSignedPercent,
} from "@/src/types/investment";
import { toggleHoldingBookmark } from "@/app/actions/holding-meta";
import {
  expectationCategoryBadgeClass,
  expectationCategoryBadgeShortJa,
  lynchCategorySortRank,
} from "@/src/lib/expectation-category";
import { lynchAlignmentHintLines } from "@/src/lib/lynch-alignment-hints";
import {
  aggregateLynchCategoryCounts,
  getLynchCategory,
  LYNCH_RULE_TOOLTIP_ALL_JA,
  LYNCH_RULE_TOOLTIP_BY_CATEGORY_JA,
  LYNCH_RULE_TOOLTIP_UNSET_JA,
  sortLynchToolbarSegments,
} from "@/src/lib/lynch-category-computed";
import {
  INVENTORY_LYNCH_LENS_COLUMNS,
  inventoryLynchLensKeyFromFilter,
} from "@/src/lib/inventory-lynch-lens-columns";
import {
  mergeInventoryLynchLensHiddenForDisplay,
  type InventoryLynchLensColumnUiByFilter,
  type InventoryLynchLensUiFilterKey,
} from "@/src/lib/inventory-lynch-lens-column-ui";
import { STOCK_CSV_COLUMNS, stocksToCsvRows } from "@/src/lib/csv-dashboard-presets";
import { exportToCSV, portfolioCsvFileName } from "@/src/lib/csv-export";
import { normalizeSearchQuery } from "@/src/lib/search-normalize";
import { useStoryPanel } from "@/src/components/dashboard/StoryPanelContext";
import type { TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";
import { EcosystemKeepButton } from "@/src/components/dashboard/EcosystemKeepButton";
import { YahooReturnChips } from "@/src/components/dashboard/YahooReturnChips";
import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";
import { DailyAlphaContextTooltip } from "@/src/components/dashboard/DailyAlphaContextTooltip";
import { stickyTdFirst, stickyTdFootFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";
import {
  formatJpyValueForView,
  formatLocalPriceForView,
  formatSignedLocalMoneyForView,
  formatSignedLocalPerShareForView,
  nativeCurrencyForStock,
} from "@/src/lib/format-display-currency";
import { JudgmentBadge } from "@/src/components/dashboard/JudgmentBadge";
import { RegionMarketBadge } from "@/src/components/dashboard/RegionMarketBadge";
import { InstitutionalOwnershipSensor } from "@/src/components/dashboard/InstitutionalOwnershipSensor";
import { judgmentPriorityRank, type JudgmentStatus } from "@/src/lib/judgment-logic";
import { computeLiveAlphaDayPercent, fiveDayPulseForHoldingRow } from "@/src/lib/alpha-logic";
import {
  fmtExpectedGrowthPercent,
  fmtPegRatio,
  fmtTotalReturnYieldRatio,
  pegLynchTenbaggerEligible,
  pegLynchTreasureEligible,
  pegRatioTextClass,
  totalReturnYieldRatioTextClass,
} from "@/src/lib/peg-display";
import { cn } from "@/src/lib/cn";
import {
  DEFAULT_COLUMN_ORDER,
  type InventoryColId,
  loadInventoryColumnOrder,
  saveInventoryColumnOrder,
} from "@/src/lib/inventory-column-order";
import {
  applyInventoryUserHidden,
  INVENTORY_COLUMN_ALWAYS_VISIBLE,
  inventoryHiddenIdsForDisplayPreset,
  loadInventoryColumnDisplayPreset,
  loadInventoryHiddenColumns,
  loadInventoryTableCompact,
  saveInventoryColumnDisplayPreset,
  saveInventoryHiddenColumns,
  saveInventoryTableCompact,
} from "@/src/lib/inventory-column-visibility";
import { InventoryTableColumnToolbar } from "@/src/components/dashboard/InventoryTableColumnToolbar";
import { MetricHeaderHelp } from "@/src/components/dashboard/MetricHeaderHelp";
import { METRIC_HEADER_TIP } from "@/src/lib/metric-header-tooltips";
import { appendTitleBlock, holdingDailyAlphaStoryTitle } from "@/src/lib/alpha-story-tooltip";
import { regionDisplayFromYahooCountry } from "@/src/lib/region-display";
import { formatTickerForDisplay, yahooSymbolForTooltip } from "@/src/lib/ticker-display";
import { stockMatchesVacuumUnpopularFilter } from "@/src/lib/institutional-ownership";

type SortKey =
  | "asset"
  | "lynch"
  | "alpha"
  | "trend5d"
  | "position"
  | "research"
  | "earnings"
  | "listing"
  | "mktCap"
  | "perfListed"
  | "deviation"
  | "drawdown"
  | "ruleOf40"
  | "fcfYield"
  | "netCash"
  | "netCps"
  | "judgment"
  | "pe"
  | "pbr"
  | "peg"
  | "trr"
  | "egrowth"
  | "eps"
  | "forecastEps"
  | "volRatio";

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

function pbrOf(s: Stock): number | null {
  const v = s.priceToBook;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function pegOf(s: Stock): number | null {
  const v = s.pegRatio;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function trrOf(s: Stock): number | null {
  const v = s.totalReturnYieldRatio;
  return v != null && Number.isFinite(v) ? v : null;
}

function expectedGrowthOf(s: Stock): number | null {
  const v = s.expectedGrowth;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function epsOf(s: Stock): number | null {
  const v = s.trailingEps ?? s.forwardEps ?? null;
  return v != null && Number.isFinite(v) ? v : null;
}

function forecastEpsOf(s: Stock): number | null {
  const v = s.forwardEps;
  return v != null && Number.isFinite(v) ? v : null;
}

function liveDailyAlphaPct(s: Stock): number | null {
  return computeLiveAlphaDayPercent({
    livePrice: s.currentPrice,
    previousClose: s.previousClose,
    benchmarkDayChangePercent: s.benchmarkDayChangePercent,
  });
}

function fiveDayPulseForStock(s: Stock) {
  return fiveDayPulseForHoldingRow(s);
}

/** 5D 列の並び: 本日暫定 Alpha まで含む系列の最終点 */
function trend5dSortValue(s: Stock): number | null {
  const { series } = fiveDayPulseForStock(s);
  if (series.length === 0) return null;
  const v = series[series.length - 1]!;
  return Number.isFinite(v) ? v : null;
}

function volRatioOf(s: Stock): number | null {
  return s.volumeRatio != null && Number.isFinite(s.volumeRatio) ? s.volumeRatio : null;
}

/** 対ベンチで大きく遅行（ライブ日次 Alpha が極端にマイナス） */
function isLiveAlphaOpportunityRow(s: Stock): boolean {
  const a = liveDailyAlphaPct(s);
  return a != null && a <= -2;
}

function isOpportunityRow(s: Stock, themeStructuralTrendUp: boolean): boolean {
  if (isLiveAlphaOpportunityRow(s)) return true;
  if (!themeStructuralTrendUp) return false;
  const z = deviationOf(s);
  return z != null && z <= -1.5;
}

function recordedLastAlphaPct(s: Stock): number | null {
  if (s.alphaHistory.length === 0) return null;
  const v = s.alphaHistory[s.alphaHistory.length - 1]!;
  return Number.isFinite(v) ? v : null;
}

/** 並び・表示用: ライブ日次 Alpha を優先し、無ければ記録された最新日次 Alpha */
function sortableAlphaValue(s: Stock): number | null {
  const live = liveDailyAlphaPct(s);
  if (live != null && Number.isFinite(live)) return live;
  return recordedLastAlphaPct(s);
}

function ruleOf40SortValue(s: Stock): number | null {
  return Number.isFinite(s.ruleOf40) ? s.ruleOf40 : null;
}

function fcfYieldSortValue(s: Stock): number | null {
  return Number.isFinite(s.fcfYield) ? s.fcfYield : null;
}

function netCashSortValue(s: Stock): number | null {
  return s.netCash != null && Number.isFinite(s.netCash) ? s.netCash : null;
}

function netCpsSortValue(s: Stock): number | null {
  return s.netCashPerShare != null && Number.isFinite(s.netCashPerShare) ? s.netCashPerShare : null;
}

function listingYmdSortKey(s: Stock): string | null {
  const d = s.listingDate;
  if (d == null || String(d).trim().length < 10) return null;
  const ymd = String(d).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function fmtMarketCapShort(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = Math.abs(n);
  if (v >= 1e15) return `${(n / 1e15).toFixed(2)}Q`;
  if (v >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function listingYearLabel(s: Stock): string {
  const fk = listingYmdSortKey(s);
  if (fk == null) return "—";
  return fk.slice(0, 4);
}

function earningsSortValue(s: Stock): number | null {
  const d = s.daysToEarnings;
  if (d == null || !Number.isFinite(d) || d < 0) return null;
  return d;
}

/** 配当落ちまでの日数（Research / Dividend 系ソート）。未取得は末尾。過去のみは未来より後ろ。 */
function stockExDividendSortScore(s: Stock): number {
  const d = s.daysToExDividend;
  if (d == null || !Number.isFinite(d)) return 1e9;
  if (d >= 0) return d;
  return 20000 + d;
}

function stockHasUsableQuote(s: Stock): boolean {
  return s.currentPrice != null && Number.isFinite(s.currentPrice) && s.currentPrice > 0;
}

type UtcYearMonth = { y: number; m: number };

function utcAddMonths(base: UtcYearMonth, delta: number): UtcYearMonth {
  const d = new Date(Date.UTC(base.y, base.m - 1 + delta, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function utcMonthKey(ym: UtcYearMonth): string {
  return `${ym.y}-${String(ym.m).padStart(2, "0")}`;
}

function parseStockYmd(ymd: string | null): string | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return ymd;
}

type DividendCalendarMark = { ticker: string; x: boolean; r: boolean };

/** 1 日セル用: 月曜始まり・UTC（先頭は空セル）。 */
function utcMonthGridCells(ym: UtcYearMonth): ({ dayNum: null } | { dayNum: number; ymd: string })[] {
  const dim = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
  const d1 = new Date(Date.UTC(ym.y, ym.m - 1, 1));
  const dowSun0 = d1.getUTCDay();
  const leadMon0 = (dowSun0 + 6) % 7;
  const cells: ({ dayNum: null } | { dayNum: number; ymd: string })[] = [];
  for (let i = 0; i < leadMon0; i++) cells.push({ dayNum: null });
  for (let d = 1; d <= dim; d++) {
    const ymd = `${ym.y}-${String(ym.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ dayNum: d, ymd });
  }
  while (cells.length % 7 !== 0) cells.push({ dayNum: null });
  return cells;
}

/** UTC で「今月の前月」〜「今月+6ヶ月」の範囲に、日付ごとに ex(X) / record(R) をバケット（sortedStocks 基準）。 */
function buildDividendCalendarData(sortedStocks: Stock[]): {
  months: UtcYearMonth[];
  byDay: Map<string, DividendCalendarMark[]>;
} {
  const now = new Date();
  const thisMonth: UtcYearMonth = { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 };
  const start = utcAddMonths(thisMonth, -1);
  const months: UtcYearMonth[] = [];
  for (let i = 0; i < 8; i++) {
    months.push(utcAddMonths(start, i));
  }
  const monthKeys = new Set(months.map(utcMonthKey));
  const byDay = new Map<string, DividendCalendarMark[]>();
  for (const s of sortedStocks) {
    const t = s.ticker.trim().toUpperCase();
    const bumpDay = (ymdRaw: string | null, kind: "x" | "r") => {
      const ymd = parseStockYmd(ymdRaw);
      if (!ymd) return;
      if (!monthKeys.has(ymd.slice(0, 7))) return;
      const list = byDay.get(ymd) ?? [];
      const exists = list.find((c) => c.ticker === t);
      if (exists) {
        if (kind === "x") exists.x = true;
        else exists.r = true;
      } else {
        list.push({ ticker: t, x: kind === "x", r: kind === "r" });
      }
      byDay.set(ymd, list);
    };
    bumpDay(s.exDividendDate, "x");
    bumpDay(s.recordDate, "r");
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.ticker.localeCompare(b.ticker, "ja"));
  }
  return { months, byDay };
}

const UTC_WEEKDAY_HEAD_JA = ["月", "火", "水", "木", "金", "土", "日"] as const;
const DIVIDEND_CELL_TICKER_CAP = 3;

function DividendCalendarModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: { months: UtcYearMonth[]; byDay: Map<string, DividendCalendarMark[]> };
}) {
  if (!open) return null;
  const now = new Date();
  const todayUtcYmd = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"
        aria-label="モーダルを閉じる"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dividend-calendar-title"
        className="relative z-10 flex max-h-[min(92dvh,56rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0 space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Inventory</p>
            <h2 id="dividend-calendar-title" className="text-base font-bold tracking-tight text-foreground sm:text-lg">
              配当カレンダー
            </h2>
            <p className="text-[11px] text-muted-foreground leading-snug">
              表示中の銘柄 · UTC · 前月〜今月+6 ヶ月 · 週は月曜始まり
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px]">
              <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                <span aria-hidden>X</span>
                <span className="font-normal text-muted-foreground">権利落ち（ex-dividend）</span>
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400">
                <span aria-hidden>R</span>
                <span className="font-normal text-muted-foreground">権利確定（record）</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-2">
            {data.months.map((mon) => {
              const key = utcMonthKey(mon);
              const cells = utcMonthGridCells(mon);
              return (
                <div
                  key={key}
                  className="rounded-xl border border-border/90 bg-background/50 p-3 shadow-inner sm:p-3.5"
                >
                  <p className="mb-2 text-center text-xs font-bold tabular-nums text-foreground/90 sm:text-sm">
                    {mon.y}年{mon.m}月
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">UTC</span>
                  </p>
                  <div className="grid grid-cols-7 gap-px rounded-lg border border-border/60 bg-border/80 overflow-hidden text-[10px]">
                    {UTC_WEEKDAY_HEAD_JA.map((w) => (
                      <div
                        key={`${key}-h-${w}`}
                        className="bg-muted/70 py-1 text-center font-bold text-muted-foreground"
                      >
                        {w}
                      </div>
                    ))}
                    {cells.map((cell, idx) => {
                      if (cell.dayNum == null) {
                        return (
                          <div
                            key={`${key}-e-${idx}`}
                            className="min-h-[4.5rem] bg-muted/25 sm:min-h-[5rem]"
                            aria-hidden
                          />
                        );
                      }
                      const ymd = cell.ymd;
                      const marks = data.byDay.get(ymd) ?? [];
                      const isToday = ymd === todayUtcYmd;
                      const hasX = marks.some((m) => m.x);
                      const hasR = marks.some((m) => m.r);
                      const title = marks
                        .map((m) => `${m.ticker}${m.x ? " X" : ""}${m.r ? " R" : ""}`)
                        .join(", ");
                      return (
                        <div
                          key={ymd}
                          title={marks.length ? title : undefined}
                          className={cn(
                            "flex min-h-[4.5rem] flex-col gap-0.5 border-t border-l border-border/40 bg-card/90 p-1 sm:min-h-[5rem] sm:p-1.5",
                            isToday && "ring-2 ring-accent-cyan/70 ring-inset z-[1]",
                            !marks.length && "bg-card/95",
                            marks.length > 0 &&
                              hasX &&
                              hasR &&
                              "bg-gradient-to-br from-amber-500/12 to-sky-500/12",
                            marks.length > 0 && hasX && !hasR && "bg-amber-500/10",
                            marks.length > 0 && hasR && !hasX && "bg-sky-500/10",
                          )}
                        >
                          <div className="flex items-start justify-between gap-0.5">
                            <span
                              className={cn(
                                "font-mono text-[11px] font-bold tabular-nums leading-none sm:text-xs",
                                isToday ? "text-accent-cyan" : "text-foreground/85",
                              )}
                            >
                              {cell.dayNum}
                            </span>
                            {marks.length > 0 ? (
                              <span className="flex shrink-0 gap-0.5">
                                {hasX ? (
                                  <span className="text-[8px] font-black leading-none text-amber-600 dark:text-amber-400">
                                    X
                                  </span>
                                ) : null}
                                {hasR ? (
                                  <span className="text-[8px] font-black leading-none text-sky-600 dark:text-sky-400">
                                    R
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                          </div>
                          {marks.length > 0 ? (
                            <ul className="mt-0.5 min-w-0 flex-1 space-y-0.5">
                              {marks.slice(0, DIVIDEND_CELL_TICKER_CAP).map((mk) => (
                                <li
                                  key={`${ymd}-${mk.ticker}`}
                                  className="truncate font-mono text-[8px] leading-tight text-foreground/90 sm:text-[9px]"
                                >
                                  <span className="font-semibold">{mk.ticker}</span>
                                  <span className="text-muted-foreground">
                                    {mk.x ? "·X" : ""}
                                    {mk.r ? "·R" : ""}
                                  </span>
                                </li>
                              ))}
                              {marks.length > DIVIDEND_CELL_TICKER_CAP ? (
                                <li className="text-[8px] font-bold text-muted-foreground">
                                  他 {marks.length - DIVIDEND_CELL_TICKER_CAP}
                                </li>
                              ) : null}
                            </ul>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableInventoryTh({
  id,
  className,
  align = "left",
  title,
  metricHelpText,
  disableColumnReorder = false,
  onRequestHideColumn,
  children,
}: {
  id: InventoryColId;
  className?: string;
  align?: "left" | "right" | "center";
  title?: string;
  /** Radix ツールチップ（構造投資向け解説）。指定時は `title` を付けない（ネイティブ二重表示を防ぐ） */
  metricHelpText?: string;
  /**
   * リンチレンズ中でも列 DnD は可能（列セットはレンズで絞るが、並べ替えはユーザーの列順に反映する）。
   * `disabled: false` で常にドラッグ可。
   */
  disableColumnReorder?: boolean;
  /** ヘッダ上で右クリックしたときに列を非表示（Asset 除く）。誤操作防止のためコンテキストメニューではなく即時非表示 */
  onRequestHideColumn?: (id: InventoryColId) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: disableColumnReorder,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.88, zIndex: 50 } : {}),
  };
  const justify =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <th
      ref={setNodeRef}
      style={style}
      className={className}
      title={metricHelpText ? undefined : title}
      onContextMenu={(e) => {
        if (!onRequestHideColumn) return;
        if (id === "asset") return;
        e.preventDefault();
        onRequestHideColumn(id);
      }}
    >
      <div className={`flex w-full items-center gap-1 ${justify}`}>
        <button
          type="button"
          className={`touch-none shrink-0 rounded p-0.5 text-muted-foreground ${
            disableColumnReorder
              ? "cursor-not-allowed opacity-40"
              : "cursor-grab hover:bg-muted/60 hover:text-foreground active:cursor-grabbing"
          }`}
          {...attributes}
          {...(disableColumnReorder ? {} : listeners)}
          aria-label={disableColumnReorder ? "列の並べ替え不可" : "列をドラッグして並べ替え"}
          aria-disabled={disableColumnReorder}
          disabled={disableColumnReorder}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
        <div
          className={cn(
            "min-w-0",
            align === "right" && "text-right",
            align === "center" && "text-center",
            metricHelpText && "flex w-full min-w-0 items-start gap-0.5",
            metricHelpText && align === "right" && "justify-end",
            metricHelpText && align === "center" && "justify-center",
          )}
        >
          {metricHelpText ? (
            <>
              <div className="min-w-0 flex-1 text-inherit">{children}</div>
              <MetricHeaderHelp text={metricHelpText} className="mt-0.5" />
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </th>
  );
}

export function InventoryTable({
  stocks,
  totalHoldings,
  averageAlpha,
  /** ダッシュボード `summary.portfolioTotalLiveAlphaPct` と同じ（時価加重ライブ日次α）。フッター括弧内を Pulse と一致させる。 */
  portfolioTotalLiveAlphaPct = null,
  averageFxNeutralAlpha: _averageFxNeutralAlpha,
  userId,
  onEarningsNoteSaved,
  /** メタ同期完了後にダッシュを再取得したい場合（現状コール箇所は将来拡張用） */
  onAfterInstrumentMetaSync: _onAfterInstrumentMetaSync,
  onTrade,
  onTradeNew,
  themeStructuralTrendUp = false,
  resolveEcosystemKeep,
  onToggleEcosystemKeep,
  livePricePollIntervalMs,
  onLivePricePoll,
  highlightTicker,
  resourceSyncJudgments,
}: {
  stocks: Stock[];
  totalHoldings: number;
  averageAlpha: number;
  /** ホーム: `summary.portfolioTotalLiveAlphaPct`。テーマ: `themeTotalLiveAlphaPct`。未指定は null。 */
  portfolioTotalLiveAlphaPct?: number | null;
  /** 決算メモ保存 API 用 */
  userId: string;
  /** メモ保存成功後にダッシュボード / テーマを再取得する */
  onEarningsNoteSaved?: () => void | Promise<void>;
  onAfterInstrumentMetaSync?: () => void | Promise<void>;
  onTrade?: (initial: TradeEntryInitial) => void;
  onTradeNew?: () => void;
  /** テーマページなどで加重累積 Alpha が上向きのとき true（✨ の条件に使用） */
  themeStructuralTrendUp?: boolean;
  /** 名目為替に依らない平均日次 α（省略時は `averageAlpha`） */
  averageFxNeutralAlpha?: number;
  /** テーマページ: エコシステムに同一銘柄があるときキープトグルを表示 */
  resolveEcosystemKeep?: (ticker: string) => { memberId: string; isKept: boolean } | null;
  onToggleEcosystemKeep?: (memberId: string) => void | Promise<void>;
  /** 設定時、間隔ごとに `onLivePricePoll` で株価・ベンチを再取得（ライブ Alpha の更新用） */
  livePricePollIntervalMs?: number;
  onLivePricePoll?: () => void | Promise<void>;
  /** ホーム検索など: 一致する行を強調しスクロール（大文字キー推奨） */
  highlightTicker?: string | null;
  /** 江戸循環テーマ用: 資源との同期判定 */
  resourceSyncJudgments?: ResourceStructuralSyncData["individualJudgments"] | null;
}) {
  const { convert, viewCurrency, alphaDisplayMode } = useCurrencyConverter();
  const { storyStock, openStory } = useStoryPanel();

  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showValueCols, setShowValueCols] = useState(false);
  const [structureFilter, setStructureFilter] = useState("");
  const [lynchFilter, setLynchFilter] = useState<"" | "__unset__" | LynchCategory>("");
  const [columnOrder, setColumnOrder] = useState<InventoryColId[]>(DEFAULT_COLUMN_ORDER);
  const [inventoryHiddenColumnIds, setInventoryHiddenColumnIds] = useState<InventoryColId[]>([]);
  const [inventoryLynchLensColumnUiByFilter, setInventoryLynchLensColumnUiByFilter] =
    useState<InventoryLynchLensColumnUiByFilter>({});
  const [inventoryTableCompact, setInventoryTableCompact] = useState(false);
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [vacuumUnpopularOnly, setVacuumUnpopularOnly] = useState(false);
  const [hideIncompleteQuotes, setHideIncompleteQuotes] = useState(false);
  const [dividendCalendarModalOpen, setDividendCalendarModalOpen] = useState(false);
  const [, startTransition] = useTransition();
  useEffect(() => {
    if (!dividendCalendarModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDividendCalendarModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dividendCalendarModalOpen]);

  const [bookmarkPatch, addBookmarkPatch] = useOptimistic(
    {} as Record<string, boolean>,
    (current, update: { id: string; value: boolean }) => ({ ...current, [update.id]: update.value }),
  );

  function bookmarkDisplayed(s: Stock): boolean {
    const p = bookmarkPatch[s.id];
    return p !== undefined ? p : s.isBookmarked;
  }

  useEffect(() => {
    const order = loadInventoryColumnOrder();
    setColumnOrder(order);
    setInventoryTableCompact(loadInventoryTableCompact());
    const preset = loadInventoryColumnDisplayPreset();
    const base = order.filter((id) => {
      if (id === "deviation" || id === "drawdown") return false;
      return true;
    });
    const togglable = base.filter((id) => !INVENTORY_COLUMN_ALWAYS_VISIBLE.has(id));
    if (preset === "full" || preset === "medium" || preset === "simple") {
      const h = inventoryHiddenIdsForDisplayPreset(preset, togglable);
      setInventoryHiddenColumnIds(h);
      saveInventoryHiddenColumns(h);
    } else {
      setInventoryHiddenColumnIds(loadInventoryHiddenColumns());
    }
  }, []);

  const persistInventoryHiddenColumnIds = useCallback((next: InventoryColId[]) => {
    setInventoryHiddenColumnIds(next);
    saveInventoryHiddenColumns(next);
  }, []);

  const persistInventoryTableCompact = useCallback((next: boolean) => {
    setInventoryTableCompact(next);
    saveInventoryTableCompact(next);
  }, []);

  useEffect(() => {
    const ms = livePricePollIntervalMs ?? 0;
    if (ms <= 0 || !onLivePricePoll) return;
    const id = window.setInterval(() => void onLivePricePoll(), ms);
    return () => window.clearInterval(id);
  }, [livePricePollIntervalMs, onLivePricePoll]);

  const inventoryBaseVisibleColumnIds = useMemo(
    () =>
      columnOrder.filter((id) => {
        if (id === "deviation" || id === "drawdown") return showValueCols;
        return true;
      }),
    [columnOrder, showValueCols],
  );

  const applyInventoryColumnDisplayPreset = useCallback(
    (preset: "full" | "medium" | "simple") => {
      const togglable = inventoryBaseVisibleColumnIds.filter(
        (id) => !INVENTORY_COLUMN_ALWAYS_VISIBLE.has(id),
      );
      const next = inventoryHiddenIdsForDisplayPreset(preset, togglable);
      persistInventoryHiddenColumnIds(next);
      saveInventoryColumnDisplayPreset(preset);
    },
    [inventoryBaseVisibleColumnIds, persistInventoryHiddenColumnIds],
  );

  const markInventoryColumnDisplayPresetCustom = useCallback(() => {
    saveInventoryColumnDisplayPreset("custom");
  }, []);

  const lynchLensKey = inventoryLynchLensKeyFromFilter(lynchFilter);
  /** 件数は `stocks` 全件（構造検索・リンチ行フィルター等のテーブル絞り込み前） */
  const lynchCountSnapshot = useMemo(() => aggregateLynchCategoryCounts(stocks), [stocks]);
  const lynchToolbarSorted = useMemo(
    () => sortLynchToolbarSegments(lynchCountSnapshot),
    [lynchCountSnapshot],
  );
  const lynchLensColumnIds = useMemo(() => {
    if (!lynchLensKey) return null;
    const preset = [...INVENTORY_LYNCH_LENS_COLUMNS[lynchLensKey]];
    const allowed = new Set(inventoryBaseVisibleColumnIds);
    const inter = preset.filter((id) => allowed.has(id));
    const fallback = (["asset", "lynch", "alpha"] as const).filter((id) => allowed.has(id));
    return inter.length > 0 ? inter : fallback;
  }, [lynchLensKey, inventoryBaseVisibleColumnIds]);

  const visibleColumnIds = useMemo(() => {
    if (lynchLensColumnIds == null) {
      return applyInventoryUserHidden(inventoryBaseVisibleColumnIds, inventoryHiddenColumnIds);
    }
    const fk = lynchFilter as InventoryLynchLensUiFilterKey;
    const { extras, hidden } = inventoryLynchLensColumnUiByFilter[fk] ?? { extras: [], hidden: [] };
    const lensShowsLynch = lynchLensColumnIds.includes("lynch");
    const globalHiddenForMerge = lensShowsLynch
      ? inventoryHiddenColumnIds.filter((id) => id !== "lynch")
      : inventoryHiddenColumnIds;
    const mergedHidden = mergeInventoryLynchLensHiddenForDisplay(hidden, globalHiddenForMerge);
    const withExtras = Array.from(new Set([...lynchLensColumnIds, ...extras]));
    return applyInventoryUserHidden(withExtras, mergedHidden);
  }, [
    inventoryBaseVisibleColumnIds,
    inventoryHiddenColumnIds,
    lynchLensColumnIds,
    lynchFilter,
    inventoryLynchLensColumnUiByFilter,
  ]);

  const effectiveHiddenColumnIds = useMemo(() => {
    const visibleSet = new Set(visibleColumnIds);
    return inventoryBaseVisibleColumnIds.filter((id) => !visibleSet.has(id));
  }, [inventoryBaseVisibleColumnIds, visibleColumnIds]);

  const handleInventoryHiddenColumnIdsChange = useCallback(
    (nextHidden: InventoryColId[]) => {
      const addedHidden = nextHidden.filter((id) => !effectiveHiddenColumnIds.includes(id));
      const removedHidden = effectiveHiddenColumnIds.filter((id) => !nextHidden.includes(id));

      if (lynchLensColumnIds != null && lynchFilter !== "") {
        const fk = lynchFilter as InventoryLynchLensUiFilterKey;
        const slice = inventoryLynchLensColumnUiByFilter[fk] ?? { extras: [], hidden: [] };

        if (addedHidden.length > 0) {
          const id = addedHidden[0]!;
          if (slice.extras.includes(id)) {
            setInventoryLynchLensColumnUiByFilter((prev) => {
              const cur = prev[fk] ?? { extras: [], hidden: [] };
              return {
                ...prev,
                [fk]: { extras: cur.extras.filter((x) => x !== id), hidden: cur.hidden },
              };
            });
          } else if (!slice.hidden.includes(id)) {
            setInventoryLynchLensColumnUiByFilter((prev) => {
              const cur = prev[fk] ?? { extras: [], hidden: [] };
              return { ...prev, [fk]: { extras: cur.extras, hidden: [...cur.hidden, id] } };
            });
          }
          return;
        }
        if (removedHidden.length > 0) {
          const id = removedHidden[0]!;
          if (slice.hidden.includes(id)) {
            setInventoryLynchLensColumnUiByFilter((prev) => {
              const cur = prev[fk] ?? { extras: [], hidden: [] };
              return {
                ...prev,
                [fk]: { extras: cur.extras, hidden: cur.hidden.filter((x) => x !== id) },
              };
            });
          } else if (inventoryHiddenColumnIds.includes(id)) {
            persistInventoryHiddenColumnIds(inventoryHiddenColumnIds.filter((x) => x !== id));
          } else if (!lynchLensColumnIds.includes(id)) {
            setInventoryLynchLensColumnUiByFilter((prev) => {
              const cur = prev[fk] ?? { extras: [], hidden: [] };
              if (cur.extras.includes(id)) return prev;
              return { ...prev, [fk]: { extras: [...cur.extras, id], hidden: cur.hidden } };
            });
          }
        }
        return;
      }

      if (addedHidden.length > 0) {
        const id = addedHidden[0]!;
        if (!inventoryHiddenColumnIds.includes(id)) {
          persistInventoryHiddenColumnIds([...inventoryHiddenColumnIds, id]);
        }
      } else if (removedHidden.length > 0) {
        const id = removedHidden[0]!;
        if (inventoryHiddenColumnIds.includes(id)) {
          persistInventoryHiddenColumnIds(inventoryHiddenColumnIds.filter((x) => x !== id));
        }
      }
    },
    [
      effectiveHiddenColumnIds,
      lynchLensColumnIds,
      lynchFilter,
      inventoryLynchLensColumnUiByFilter,
      inventoryHiddenColumnIds,
      persistInventoryHiddenColumnIds,
    ],
  );

  const handleInventoryHeaderHideColumn = useCallback(
    (colId: InventoryColId) => {
      if (colId === "asset") return;
      if (effectiveHiddenColumnIds.includes(colId)) return;
      saveInventoryColumnDisplayPreset("custom");
      handleInventoryHiddenColumnIdsChange([...effectiveHiddenColumnIds, colId]);
    },
    [effectiveHiddenColumnIds, handleInventoryHiddenColumnIdsChange],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleInventoryColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder((items) => {
      const oldIndex = items.indexOf(active.id as InventoryColId);
      const newIndex = items.indexOf(over.id as InventoryColId);
      if (oldIndex < 0 || newIndex < 0) return items;
      const next = arrayMove(items, oldIndex, newIndex);
      saveInventoryColumnOrder(next);
      return next;
    });
  }

  const filteredStocks = useMemo(() => {
    const q = structureFilter.trim().toLowerCase();
    let list = stocks;
    if (q.length > 0) {
      list = list.filter((s) => {
        const hay = [s.ticker, s.name ?? "", s.tag, s.secondaryTag, s.sector ?? ""].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    if (lynchFilter === "__unset__") {
      list = list.filter((s) => getLynchCategory(s) == null);
    } else if (lynchFilter !== "") {
      list = list.filter((s) => getLynchCategory(s) === lynchFilter);
    }
    if (bookmarksOnly) {
      list = list.filter((s) => bookmarkDisplayed(s));
    }
    if (hideIncompleteQuotes) {
      list = list.filter((s) => stockHasUsableQuote(s));
    }
    if (vacuumUnpopularOnly) {
      list = list.filter((s) => stockMatchesVacuumUnpopularFilter(s.institutionalOwnership));
    }
    return list;
  }, [stocks, structureFilter, lynchFilter, bookmarksOnly, hideIncompleteQuotes, vacuumUnpopularOnly, bookmarkPatch]);

  /** テーブル内フィルタ（検索・Lynch・ブックマーク等）で行が絞られているとき true。サマリーベースの平均とズレ得る。 */
  const tableFilterActive = filteredStocks.length < stocks.length;

  const sortedStocks = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
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
      if (key === "lynch") {
        const ra = lynchCategorySortRank(getLynchCategory(a));
        const rb = lynchCategorySortRank(getLynchCategory(b));
        if (ra !== rb) return dir * (ra - rb);
        return dir * cmpStr(a.ticker, b.ticker);
      }
      if (key === "earnings") return dir * cmpNum(earningsSortValue(a), earningsSortValue(b));
      if (key === "listing")
        return dir * cmpStr(listingYmdSortKey(a) ?? "\uFFFF", listingYmdSortKey(b) ?? "\uFFFF");
      if (key === "mktCap") return dir * cmpNum(a.marketCap, b.marketCap);
      if (key === "perfListed")
        return dir * cmpNum(a.performanceSinceFoundation, b.performanceSinceFoundation);
      if (key === "alpha") return dir * cmpNum(sortableAlphaValue(a), sortableAlphaValue(b));
      if (key === "trend5d") return dir * cmpNum(trend5dSortValue(a), trend5dSortValue(b));
      if (key === "volRatio") return dir * cmpNum(volRatioOf(a), volRatioOf(b));
      if (key === "position") return dir * cmpNum(a.marketValue, b.marketValue);
      if (key === "judgment") {
        const ja = judgmentPriorityRank(a.judgmentStatus as JudgmentStatus);
        const jb = judgmentPriorityRank(b.judgmentStatus as JudgmentStatus);
        if (ja !== jb) return dir * (ja - jb);
        return dir * cmpStr(a.ticker, b.ticker);
      }
      if (key === "pe") return dir * cmpNum(peOf(a), peOf(b));
      if (key === "pbr") return dir * cmpNum(pbrOf(a), pbrOf(b));
      if (key === "peg") return dir * cmpNum(pegOf(a), pegOf(b));
      if (key === "trr") return dir * cmpNum(trrOf(a), trrOf(b));
      if (key === "egrowth") return dir * cmpNum(expectedGrowthOf(a), expectedGrowthOf(b));
      if (key === "eps") return dir * cmpNum(epsOf(a), epsOf(b));
      if (key === "forecastEps") return dir * cmpNum(forecastEpsOf(a), forecastEpsOf(b));
      if (key === "ruleOf40") return dir * cmpNum(ruleOf40SortValue(a), ruleOf40SortValue(b));
      if (key === "fcfYield") return dir * cmpNum(fcfYieldSortValue(a), fcfYieldSortValue(b));
      if (key === "netCash") return dir * cmpNum(netCashSortValue(a), netCashSortValue(b));
      if (key === "netCps") return dir * cmpNum(netCpsSortValue(a), netCpsSortValue(b));
      if (key === "deviation") return dir * cmpNum(deviationOf(a), deviationOf(b));
      if (key === "drawdown") return dir * cmpNum(drawdownOf(a), drawdownOf(b));
      if (key === "research") {
        const ex = cmpNum(stockExDividendSortScore(a), stockExDividendSortScore(b));
        if (ex !== 0) return dir * ex;
        return dir * cmpNum(a.dividendYieldPercent, b.dividendYieldPercent);
      }
      return 0;
    });
    return arr;
  }, [filteredStocks, sortDir, sortKey]);

  const dividendCalendarData = useMemo(() => buildDividendCalendarData(sortedStocks), [sortedStocks]);

  const highlightScrollTicker = useMemo(() => {
    const raw = highlightTicker?.trim() ?? "";
    if (raw.length === 0) return null;
    const q = normalizeSearchQuery(raw);
    if (q.length === 0) return null;
    for (const s of sortedStocks) {
      if (normalizeSearchQuery(s.ticker) === q) return s.ticker.trim().toUpperCase();
    }
    if (q.length >= 2) {
      for (const s of sortedStocks) {
        if (normalizeSearchQuery(s.name).includes(q)) return s.ticker.trim().toUpperCase();
      }
    }
    return raw.toUpperCase();
  }, [highlightTicker, sortedStocks]);

  useEffect(() => {
    const idTicker = highlightScrollTicker;
    if (!idTicker) return;
    const id = `inventory-row-${idTicker}`;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [highlightScrollTicker, sortedStocks.length]);

  const footerStats = useMemo(() => {
    const rows = sortedStocks;
    function weightedMean(pick: (s: Stock) => number | null): number | null {
      let num = 0;
      let den = 0;
      const simple: number[] = [];
      for (const s of rows) {
        const v = pick(s);
        if (v == null || !Number.isFinite(v)) continue;
        simple.push(v);
        const mv = s.marketValue;
        if (mv > 0 && Number.isFinite(mv)) {
          num += v * mv;
          den += mv;
        }
      }
      if (den > 0) return num / den;
      if (simple.length === 0) return null;
      return simple.reduce((acc, x) => acc + x, 0) / simple.length;
    }

    const avgRuleOf40 = weightedMean((s) => (Number.isFinite(s.ruleOf40) ? s.ruleOf40 : null));
    const avgFcfYield = weightedMean((s) => (Number.isFinite(s.fcfYield) ? s.fcfYield : null));

    let zSum = 0;
    let zN = 0;
    let ddSum = 0;
    let ddN = 0;
    let dailyAlphaRowSum = 0;
    let dailyAlphaRowN = 0;
    let liveAlphaRowSum = 0;
    let liveAlphaRowN = 0;
    for (const s of rows) {
      const z = deviationOf(s);
      if (z != null) {
        zSum += z;
        zN += 1;
      }
      const dd = drawdownOf(s);
      if (dd != null) {
        ddSum += dd;
        ddN += 1;
      }
      const da = recordedLastAlphaPct(s);
      if (da != null && Number.isFinite(da)) {
        dailyAlphaRowSum += da;
        dailyAlphaRowN += 1;
      }
      const la = liveDailyAlphaPct(s);
      if (la != null && Number.isFinite(la)) {
        liveAlphaRowSum += la;
        liveAlphaRowN += 1;
      }
    }

    let totalMv = 0;
    let sumWt = 0;
    for (const s of rows) {
      if (s.marketValue > 0 && Number.isFinite(s.marketValue)) totalMv += s.marketValue;
      if (s.weight > 0 && Number.isFinite(s.weight)) sumWt += s.weight;
    }

    const avgDailyAlphaVisible = dailyAlphaRowN > 0 ? dailyAlphaRowSum / dailyAlphaRowN : null;
    const avgLiveAlphaVisible = liveAlphaRowN > 0 ? liveAlphaRowSum / liveAlphaRowN : null;

    let peSum = 0;
    let peN = 0;
    let pbrSum = 0;
    let pbrN = 0;
    let pegSum = 0;
    let pegN = 0;
    let trrSum = 0;
    let trrN = 0;
    let egrowthSum = 0;
    let egrowthN = 0;
    let epsSum = 0;
    let epsN = 0;
    let fepsSum = 0;
    let fepsN = 0;
    let trend5dSum = 0;
    let trend5dN = 0;
    let volRatioSum = 0;
    let volRatioN = 0;
    const priceViewSamples: number[] = [];
    let priceViewWeightedNum = 0;
    let priceViewWeightedDen = 0;
    for (const s of rows) {
      const pe = peOf(s);
      if (pe != null) {
        peSum += pe;
        peN += 1;
      }
      const pb = pbrOf(s);
      if (pb != null) {
        pbrSum += pb;
        pbrN += 1;
      }
      const pg = pegOf(s);
      if (pg != null) {
        pegSum += pg;
        pegN += 1;
      }
      const tr = trrOf(s);
      if (tr != null) {
        trrSum += tr;
        trrN += 1;
      }
      const eg = expectedGrowthOf(s);
      if (eg != null) {
        egrowthSum += eg;
        egrowthN += 1;
      }
      const ep = epsOf(s);
      if (ep != null) {
        epsSum += ep;
        epsN += 1;
      }
      const fe = forecastEpsOf(s);
      if (fe != null) {
        fepsSum += fe;
        fepsN += 1;
      }
      const p = fiveDayPulseForStock(s).series;
      if (p.length >= 5) {
        const last = p[p.length - 1]!;
        const first = p[0]!;
        if (Number.isFinite(last) && Number.isFinite(first)) {
          trend5dSum += last - first;
          trend5dN += 1;
        }
      }
      const vr = volRatioOf(s);
      if (vr != null) {
        volRatioSum += vr;
        volRatioN += 1;
      }
      const cp = s.currentPrice;
      if (cp != null && Number.isFinite(cp) && cp > 0) {
        const nat = nativeCurrencyForStock(s);
        const pv = nat === viewCurrency ? cp : convert(cp, nat, viewCurrency);
        if (Number.isFinite(pv) && pv > 0) {
          priceViewSamples.push(pv);
          const mv = s.marketValue;
          if (mv > 0 && Number.isFinite(mv)) {
            priceViewWeightedNum += pv * mv;
            priceViewWeightedDen += mv;
          }
        }
      }
    }

    const priceViewWeightedMean =
      priceViewWeightedDen > 0 && Number.isFinite(priceViewWeightedNum) ? priceViewWeightedNum / priceViewWeightedDen : null;
    const priceViewSimpleMean =
      priceViewSamples.length > 0
        ? priceViewSamples.reduce((a, b) => a + b, 0) / priceViewSamples.length
        : null;
    const priceViewMin = priceViewSamples.length > 0 ? Math.min(...priceViewSamples) : null;
    const priceViewMax = priceViewSamples.length > 0 ? Math.max(...priceViewSamples) : null;

    return {
      avgRuleOf40,
      avgFcfYield,
      avgZ: zN > 0 ? zSum / zN : null,
      avgDd: ddN > 0 ? ddSum / ddN : null,
      avgDailyAlphaVisible,
      avgLiveAlphaVisible,
      avgPeVisible: peN > 0 ? peSum / peN : null,
      avgPbrVisible: pbrN > 0 ? pbrSum / pbrN : null,
      avgPegVisible: pegN > 0 ? pegSum / pegN : null,
      avgTrrVisible: trrN > 0 ? trrSum / trrN : null,
      avgExpectedGrowthVisible: egrowthN > 0 ? egrowthSum / egrowthN : null,
      avgEpsVisible: epsN > 0 ? epsSum / epsN : null,
      avgForecastEpsVisible: fepsN > 0 ? fepsSum / fepsN : null,
      avgFiveDayAlphaDelta: trend5dN > 0 ? trend5dSum / trend5dN : null,
      avgVolRatioVisible: volRatioN > 0 ? volRatioSum / volRatioN : null,
      totalMarketValueVisible: totalMv,
      sumWeightVisible: sumWt,
      priceViewWeightedMean,
      priceViewSimpleMean,
      priceViewMin,
      priceViewMax,
      priceViewCount: priceViewSamples.length,
    };
  }, [sortedStocks, viewCurrency, convert]);

  function handleCsvDownload() {
    exportToCSV(stocksToCsvRows(sortedStocks), portfolioCsvFileName("portfolio"), STOCK_CSV_COLUMNS);
  }

  function toggleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(nextKey);
      setSortDir(
        nextKey === "earnings" ||
        nextKey === "research" ||
        nextKey === "peg" ||
        nextKey === "pbr" ||
        nextKey === "trr" ||
        nextKey === "lynch"
          ? "asc"
          : "desc",
      );
    }
  }

  function handleBookmarkClick(stock: Stock) {
    const prev = bookmarkDisplayed(stock);
    const next = !prev;
    startTransition(async () => {
      addBookmarkPatch({ id: stock.id, value: next });
      const r = await toggleHoldingBookmark(stock.id, { userId });
      if (!r.ok) {
        addBookmarkPatch({ id: stock.id, value: prev });
        return;
      }
      await onEarningsNoteSaved?.();
    });
  }

  function sortMark(k: SortKey) {
    if (k !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function tradeInitialForStock(stock: Stock): TradeEntryInitial {
    return {
      ticker: stock.ticker,
      name: stock.name || undefined,
      ...(stock.tag.trim().length > 0 ? { theme: stock.tag } : {}),
      sector: stock.sector ?? stock.secondaryTag,
      quantityDefault: 1,
      ...(stock.expectationCategory != null ? { expectationCategory: stock.expectationCategory } : {}),
      ...(stock.currentPrice != null && Number.isFinite(stock.currentPrice) && stock.currentPrice > 0
        ? { unitPrice: stock.currentPrice }
        : {}),
    };
  }

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

  function fmtPbr(v: number | null): string {
    if (v == null) return "—";
    if (!Number.isFinite(v) || v <= 0) return "—";
    return v >= 100 ? v.toFixed(0) : v.toFixed(2);
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

  function countdownJa(days: number | null, label: string): string | null {
    if (days == null || !Number.isFinite(days)) return null;
    if (days < 0) return null;
    if (days === 0) return `今日が${label}`;
    if (days === 1) return `あと1日で${label}`;
    return `あと${days}日で${label}`;
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
    <div className="relative w-full min-w-0">
    <div className={cn(
      "bg-card border border-border rounded-2xl overflow-hidden shadow-2xl",
      storyStock != null ? "max-w-none w-full" : "w-full"
    )}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-card/50 p-5">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Inventory Status
        </h3>
        <button
          type="button"
          onClick={handleCsvDownload}
          disabled={sortedStocks.length === 0}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted/70 disabled:pointer-events-none disabled:opacity-40"
          title="表示中の銘柄（フィルター・並び順反映）を CSV でダウンロード"
          aria-label="表示中の銘柄を UTF-8 BOM 付き CSV でダウンロード"
        >
          <FileSpreadsheet size={18} className="shrink-0" aria-hidden />
        </button>
      </div>
      <div className="space-y-3 border-b border-border bg-card/30 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
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
              onClick={() => setBookmarksOnly((v) => !v)}
              className={`text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-all inline-flex items-center gap-1 ${
                bookmarksOnly
                  ? "text-accent-amber border-accent-amber/50 bg-accent-amber/10"
                  : "text-muted-foreground border-border hover:bg-muted/50"
              }`}
              title="ブックマーク（★）済みの銘柄のみ表示"
            >
              <Star className={`h-3.5 w-3.5 shrink-0 ${bookmarksOnly ? "fill-accent-amber text-accent-amber" : ""}`} />
              ブックマークのみ
            </button>
            <button
              type="button"
              onClick={() => setHideIncompleteQuotes((v) => !v)}
              className={`text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-all inline-flex items-center gap-1 ${
                hideIncompleteQuotes
                  ? "text-rose-200 border-rose-500/45 bg-rose-500/10"
                  : "text-muted-foreground border-border hover:bg-muted/50"
              }`}
              title="現在株価が取得できていない銘柄を非表示（API 欠損・未更新）"
            >
              <CircleSlash className="h-3.5 w-3.5 shrink-0" aria-hidden />
              株価未取得を隠す
            </button>
            <button
              type="button"
              onClick={() => setVacuumUnpopularOnly((v) => !v)}
              className={`text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-all inline-flex items-center gap-1 ${
                vacuumUnpopularOnly
                  ? "text-amber-200 border-amber-500/50 bg-amber-950/40"
                  : "text-muted-foreground border-border hover:bg-muted/50"
              }`}
              title="機関30%未満、または機関比率が未計測の銘柄のみ（真空地帯）"
            >
              <Gem className="h-3.5 w-3.5 shrink-0" aria-hidden />
              真空地帯だけ
            </button>
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
              onClick={() => setDividendCalendarModalOpen(true)}
              className={`text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-all inline-flex items-center gap-1 ${
                dividendCalendarModalOpen
                  ? "text-sky-300 border-sky-500/45 bg-sky-500/10"
                  : "text-muted-foreground border-border hover:bg-muted/50"
              }`}
              title="配当カレンダー（モーダル・UTC・前月〜+6 ヶ月）。権利落ち X・権利確定 R"
            >
              <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              配当カレンダー
            </button>
            <div className="flex min-w-0 max-w-full flex-1 basis-[10rem] items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 sm:max-w-[18rem]">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <input
                value={structureFilter}
                onChange={(e) => setStructureFilter(e.target.value)}
                className="min-w-0 flex-1 bg-transparent border-none outline-none text-xs text-foreground/90"
                placeholder="構造で絞り込み…"
                aria-label="構造で絞り込み"
              />
            </div>
          </div>
          <div className="shrink-0 rounded-lg border border-border/80 bg-card/40 p-1.5">
            <InventoryTableColumnToolbar
              baseVisibleColumnIds={inventoryBaseVisibleColumnIds}
              userHiddenColumnIds={inventoryHiddenColumnIds}
              hiddenColumnIds={effectiveHiddenColumnIds}
              setHiddenColumnIds={handleInventoryHiddenColumnIdsChange}
              applyDisplayPreset={applyInventoryColumnDisplayPreset}
              markDisplayPresetCustom={markInventoryColumnDisplayPresetCustom}
              compactTable={inventoryTableCompact}
              setCompactTable={persistInventoryTableCompact}
            />
          </div>
        </div>
        <div className="min-w-0 max-w-full xl:max-w-[min(100%,56rem)]">
        <div
          className="flex min-w-0 max-w-full flex-col gap-1 rounded-lg border border-border bg-background/60 px-2 py-1.5 sm:flex-row sm:flex-wrap sm:items-center"
          role="group"
          aria-label="リンチの6分類で絞り込み（レンズ列プリセット）"
        >
          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground px-1 shrink-0 whitespace-nowrap">
            リンチ
          </span>
          <div className="flex min-w-0 max-w-full flex-none flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setLynchFilter("")}
            aria-pressed={lynchFilter === ""}
            title={LYNCH_RULE_TOOLTIP_ALL_JA}
            className={cn(
              "text-[9px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0 px-2 py-1 rounded-md border transition-colors",
              lynchFilter === ""
                ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-100"
                : "border-transparent text-muted-foreground hover:bg-muted/60",
            )}
          >
            すべて（{lynchCountSnapshot.total}）
          </button>
          {lynchToolbarSorted.map((seg) => {
            if (seg === "__unset__") {
              const n = lynchCountSnapshot.unset;
              return (
                <button
                  key="__unset__"
                  type="button"
                  onClick={() => setLynchFilter("__unset__")}
                  aria-pressed={lynchFilter === "__unset__"}
                  title={LYNCH_RULE_TOOLTIP_UNSET_JA}
                  className={cn(
                    "text-[9px] font-bold whitespace-nowrap shrink-0 px-2 py-1 rounded-md border transition-colors max-w-[8rem]",
                    lynchFilter === "__unset__"
                      ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-100"
                      : "border-transparent text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  未分類（{n}）
                </button>
              );
            }
            const k = seg;
            const n = lynchCountSnapshot.byCategory[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setLynchFilter(k)}
                aria-pressed={lynchFilter === k}
                title={LYNCH_RULE_TOOLTIP_BY_CATEGORY_JA[k]}
                className={cn(
                  "text-[9px] font-bold shrink-0 px-2 py-1 rounded-md border transition-colors max-w-[8rem] truncate",
                  lynchFilter === k
                    ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-100"
                    : "border-transparent text-muted-foreground hover:bg-muted/60",
                )}
              >
                {LYNCH_CATEGORY_LABEL_JA[k]}（{n}）
              </button>
            );
          })}
          </div>
        </div>
        </div>
      </div>

      <div
        className={cn(
          "relative w-full max-w-full overflow-x-auto overscroll-x-contain touch-auto [-webkit-overflow-scrolling:touch]",
          inventoryTableCompact &&
            "[&_thead_th]:!px-2.5 [&_thead_th]:!py-2 [&_thead_th]:!text-[9px] [&_thead_th]:!tracking-[0.08em] [&_tbody_td]:!px-2.5 [&_tbody_td]:!py-1.5 [&_tbody_td]:!text-[11px] [&_tfoot_td]:!px-2.5 [&_tfoot_td]:!py-2 [&_tfoot_td]:!text-[10px]",
        )}
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInventoryColumnDragEnd}>
          <table className="w-full min-w-[1200px] text-left text-xs lg:text-sm">
            <thead className="sticky top-0 z-30 bg-background/85 text-muted-foreground text-[10px] uppercase font-bold tracking-[0.1em] backdrop-blur-md supports-[backdrop-filter]:bg-background/75 border-b border-border shadow-sm">
              <tr>
                <SortableContext items={visibleColumnIds} strategy={horizontalListSortingStrategy}>
                  {visibleColumnIds.map((colId, idx) => {
                    const isFirst = idx === 0;
                    const stickyFirst = isFirst ? stickyThFirst : "";
                    switch (colId) {
                      case "asset":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="left"
                            className={`px-6 py-4 min-w-[12rem] max-w-[14rem] ${stickyFirst} cursor-pointer select-none`}
                            metricHelpText={METRIC_HEADER_TIP.asset}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-left font-[inherit] text-inherit"
                              onClick={() => toggleSort("asset")}
                            >
                              Asset{sortMark("asset")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "lynch":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="left"
                            className="px-3 py-4 min-w-[7.5rem] max-w-[10rem] cursor-pointer select-none"
                            metricHelpText={METRIC_HEADER_TIP.lynch}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-left font-[inherit] text-inherit"
                              onClick={() => toggleSort("lynch")}
                            >
                              リンチ{sortMark("lynch")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "listing":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="center"
                            className="px-3 py-4 text-center cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.listing}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 font-[inherit] text-inherit"
                              onClick={() => toggleSort("listing")}
                            >
                              初取引{sortMark("listing")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "mktCap":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.mktCap}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("mktCap")}
                            >
                              MCAP{sortMark("mktCap")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "perfListed":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.perfListed}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("perfListed")}
                            >
                              長期%{sortMark("perfListed")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "earnings":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="center"
                            className="px-4 py-4 text-center cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.earnings}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 font-[inherit] text-inherit"
                              onClick={() => toggleSort("earnings")}
                            >
                              決算まで{sortMark("earnings")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "research":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="left"
                            className="px-6 py-4 text-left cursor-pointer select-none min-w-[18rem]"
                            metricHelpText={METRIC_HEADER_TIP.research}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-left font-[inherit] text-inherit"
                              onClick={() => toggleSort("research")}
                            >
                              Research{sortMark("research")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "ruleOf40":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.ruleOf40}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("ruleOf40")}
                            >
                              Rule of 40{sortMark("ruleOf40")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "fcfYield":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.fcfYield}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("fcfYield")}
                            >
                              FCF Yield{sortMark("fcfYield")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "netCash":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.netCash}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("netCash")}
                            >
                              ネットC{sortMark("netCash")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "netCps":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.netCps}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("netCps")}
                            >
                              NC/株{sortMark("netCps")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "judgment":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="center"
                            className="px-4 py-4 text-center cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.judgment}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 font-[inherit] text-inherit"
                              onClick={() => toggleSort("judgment")}
                            >
                              判定{sortMark("judgment")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "deviation":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.alphaDeviationZ}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("deviation")}
                            >
                              乖離{sortMark("deviation")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "drawdown":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.drawdown}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("drawdown")}
                            >
                              落率{sortMark("drawdown")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "alpha":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-6 py-4 text-right cursor-pointer select-none"
                            metricHelpText={METRIC_HEADER_TIP.alpha}
                          >
                            <button
                              type="button"
                              className="block w-full bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("alpha")}
                            >
                              <span className="block">Alpha{sortMark("alpha")}</span>
                              <span className="block text-[8px] font-normal normal-case tracking-normal text-muted-foreground/85">
                                Live daily
                              </span>
                              {alphaDisplayMode === "fxNeutral" ? (
                                <span className="block text-[8px] font-normal normal-case tracking-normal text-muted-foreground/85">
                                  FX-neutral
                                </span>
                              ) : null}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "trend5d":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="center"
                            className="px-4 py-4 text-center cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.fiveDay}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 font-[inherit] text-inherit"
                              onClick={() => toggleSort("trend5d")}
                            >
                              5D{sortMark("trend5d")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "volRatio":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.volumeRatio}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("volRatio")}
                            >
                              Vol 比{sortMark("volRatio")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "position":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-6 py-4 text-right cursor-pointer select-none"
                            metricHelpText={METRIC_HEADER_TIP.position}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("position")}
                            >
                              Position{sortMark("position")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "pe":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.pe}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("pe")}
                            >
                              PER{sortMark("pe")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "pbr":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.pbr}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("pbr")}
                            >
                              PBR{sortMark("pbr")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "peg":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.peg}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("peg")}
                            >
                              PEG{sortMark("peg")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "trr":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.trr}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("trr")}
                            >
                              TRR{sortMark("trr")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "egrowth":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.egrowth}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("egrowth")}
                            >
                              成長%{sortMark("egrowth")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "eps":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.eps}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("eps")}
                            >
                              EPS{sortMark("eps")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "forecastEps":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.forwardEps}
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 text-right font-[inherit] text-inherit"
                              onClick={() => toggleSort("forecastEps")}
                            >
                              予想EPS{sortMark("forecastEps")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "price":
                        return (
                          <SortableInventoryTh onRequestHideColumn={handleInventoryHeaderHideColumn}
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right whitespace-nowrap"
                            metricHelpText={METRIC_HEADER_TIP.price}
                          >
                            <span className="pointer-events-none">Price</span>
                          </SortableInventoryTh>
                        );
                      default: {
                        const _exhaustive: never = colId;
                        return _exhaustive;
                      }
                    }
                  })}
                </SortableContext>
              </tr>
            </thead>
          <tbody className="divide-y divide-border/60">
            {sortedStocks.map((stock) => {
              const liveA = liveDailyAlphaPct(stock);
              const opp = isOpportunityRow(stock, themeStructuralTrendUp);
              const z = deviationOf(stock);
              const dd = drawdownOf(stock);
              const ecoKeep =
                resolveEcosystemKeep != null ? resolveEcosystemKeep(stock.ticker) : null;
              const rowRegion = regionDisplayFromYahooCountry(stock.yahooCountry);
              const hiQ = normalizeSearchQuery(highlightTicker ?? "");
              const rowHi =
                hiQ.length > 0 &&
                (normalizeSearchQuery(stock.ticker) === hiQ ||
                  (hiQ.length >= 2 && normalizeSearchQuery(stock.name).includes(hiQ)));
              return (
                <tr
                  key={stock.id}
                  id={`inventory-row-${stock.ticker.trim().toUpperCase()}`}
                  className={cn(
                    "group hover:bg-muted/60 transition-all scroll-mt-24",
                    rowRegion.rowBg,
                    rowHi ? "bg-cyan-500/12 ring-1 ring-cyan-500/40" : "",
                  )}
                >
                  {visibleColumnIds.map((colId, idx) => {
                    const isFirst = idx === 0;
                    const stickyFirst = isFirst ? stickyTdFirst : "";
                    switch (colId) {
                      case "asset":
                        return (
                          <td
                            key={colId}
                            className={cn(
                              "px-6 py-4 min-w-0",
                              inventoryTableCompact ? "max-w-[12rem]" : "max-w-[14rem]",
                              stickyFirst,
                            )}
                          >
                            <div className="flex min-w-0 flex-col gap-1">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleBookmarkClick(stock)}
                                    className={`inline-flex shrink-0 rounded-md p-0.5 transition-colors hover:bg-muted/80 ${
                                      bookmarkDisplayed(stock) ? "text-accent-amber" : "text-muted-foreground"
                                    }`}
                                    title={bookmarkDisplayed(stock) ? "ブックマークを外す" : "ブックマークに追加"}
                                    aria-pressed={bookmarkDisplayed(stock)}
                                  >
                                    <Star
                                      className={`h-3.5 w-3.5 ${bookmarkDisplayed(stock) ? "fill-accent-amber text-accent-amber" : ""}`}
                                    />
                                  </button>
                                  {opp ? (
                                    <span
                                      className="shrink-0 text-base leading-none"
                                      title="テーマ構造トレンド上向きでの統計的な割安（σ）、またはライブ日次 Alpha が対ベンチで −2% 以下の乖離（要確認）"
                                      aria-label="Opportunity"
                                    >
                                      ✨
                                    </span>
                                  ) : null}
                                  <RegionMarketBadge yahooCountry={stock.yahooCountry} />
                                  <InstitutionalOwnershipSensor ownership={stock.institutionalOwnership} className="ml-0" />
                                  <span
                                    className="min-w-0 truncate font-bold font-mono text-foreground group-hover:text-accent-cyan transition-colors"
                                    title={`Yahoo: ${yahooSymbolForTooltip(stock.ticker, stock.providerSymbol)}${
                                      stock.yahooCountry ? ` · ${stock.yahooCountry}` : ""
                                    }`}
                                  >
                                    {formatTickerForDisplay(stock.ticker, stock.instrumentKind)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openStory(stock, onEarningsNoteSaved)}
                                    className="shrink-0 rounded-md p-1 transition-all opacity-0 group-hover:opacity-100 hover:bg-teal-500/20"
                                    title="ストーリー・ハブを開く"
                                  >
                                    <BookOpen size={14} className="shrink-0" aria-hidden />
                                  </button>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  {ecoKeep != null && onToggleEcosystemKeep != null ? (
                                    <EcosystemKeepButton
                                      size="xs"
                                      isKept={ecoKeep.isKept}
                                      onClick={() => void onToggleEcosystemKeep(ecoKeep.memberId)}
                                    />
                                  ) : null}
                                  <span
                                    className={`shrink-0 text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
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
                              <div className="flex min-w-0 flex-wrap items-center gap-1">
                                {onTrade ? (
                                  <button
                                    type="button"
                                    onClick={() => onTrade(tradeInitialForStock(stock))}
                                    className="text-[9px] font-bold uppercase tracking-wide text-accent-cyan border border-accent-cyan/40 px-2 py-0.5 rounded-md hover:bg-accent-cyan/10"
                                  >
                                    Trade
                                  </button>
                                ) : null}
                              </div>
                              {stock.name ? (
                                <span
                                  className={cn(
                                    "text-[10px] text-muted-foreground leading-snug",
                                    inventoryTableCompact ? "line-clamp-1" : "line-clamp-2",
                                  )}
                                  title={stock.name}
                                >
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
                        );
                      case "lynch": {
                        const computedLynch = getLynchCategory(stock);
                        const hintLines =
                          computedLynch != null
                            ? lynchAlignmentHintLines({
                                lynchCategory: computedLynch,
                                expectedGrowth: stock.expectedGrowth,
                                trailingPe: stock.trailingPe,
                                forwardPe: stock.forwardPe,
                                dividendYieldPercent: stock.dividendYieldPercent,
                              })
                            : [];
                        return (
                          <td
                            key={colId}
                            className="px-3 py-4 align-top min-w-[7.5rem] max-w-[11rem] text-left"
                          >
                            <div className="flex flex-col gap-1">
                              {computedLynch ? (
                                <span
                                  className={`w-fit text-[8px] font-bold tracking-tight px-1.5 py-0.5 rounded border ${expectationCategoryBadgeClass(computedLynch)}`}
                                  title={LYNCH_CATEGORY_LABEL_JA[computedLynch]}
                                >
                                  {expectationCategoryBadgeShortJa(computedLynch)}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                              {hintLines.length > 0 ? (
                                <ul className="mt-0.5 space-y-0.5 text-[9px] leading-snug text-amber-700/90 dark:text-amber-400/85 list-disc pl-3.5">
                                  {hintLines.map((line, hi) => (
                                    <li key={hi}>{line}</li>
                                  ))}
                                </ul>
                              ) : null}
                              <p className="text-[8px] text-muted-foreground leading-snug">
                                自動分類（DB の手動値は未使用）
                              </p>
                            </div>
                          </td>
                        );
                      }
                      case "listing":
                        return (
                          <td
                            key={colId}
                            className="px-3 py-4 text-center font-mono text-xs tabular-nums text-foreground/90"
                            title={
                              stock.listingDate
                                ? `初回取引日（参照）: ${stock.listingDate}（IPO 日とは限らない）`
                                : undefined
                            }
                          >
                            {listingYearLabel(stock)}
                          </td>
                        );
                      case "mktCap":
                        return (
                          <td
                            key={colId}
                            className="px-4 py-4 text-right font-mono text-xs text-foreground/90"
                            title={
                              stock.marketCap != null
                                ? `時価総額（参照・同期時点）: ${stock.marketCap}`
                                : undefined
                            }
                          >
                            {fmtMarketCapShort(stock.marketCap)}
                          </td>
                        );
                      case "perfListed": {
                        const pf = stock.performanceSinceFoundation;
                        const tone = investmentMetricToneForSignedPercent(pf);
                        const cls = pf == null ? "text-muted-foreground" : INVESTMENT_METRIC_TONE_TEXT_CLASS[tone];
                        return (
                          <td
                            key={colId}
                            className={`px-4 py-4 text-right font-mono text-xs font-bold tabular-nums ${cls}`}
                            title="長期変動率: 日足の最古〜最新（adj ペア優先）。チャート取得不能時は現在価÷listing_price（IPO 公式ではない）"
                          >
                            {pf == null || !Number.isFinite(pf) ? (
                              "—"
                            ) : (
                              <>
                                {pf > 0 ? "+" : ""}
                                {pf.toFixed(1)}%
                              </>
                            )}
                          </td>
                        );
                      }
                      case "earnings":
                        return (
                          <td key={colId} className="px-4 py-4 text-center">
                            {stock.nextEarningsDate ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[11px] font-bold font-mono tabular-nums text-foreground">
                                  {stock.daysToEarnings != null ? `D-${stock.daysToEarnings}` : "—"}
                                </span>
                                <span className="text-[9px] text-muted-foreground font-mono">{stock.nextEarningsDate}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                        );
                      case "research":
                        return (
                          <td key={colId} className="px-6 py-4 min-w-[18rem]">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-bold text-muted-foreground border border-border bg-background/60 px-2 py-0.5 rounded-md">
                                  {stock.countryName}
                                </span>
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
                                {(() => {
                                  const d = stock.daysToExDividend;
                                  const soon = d != null && Number.isFinite(d) && d >= 0 && d <= 7;
                                  if (!soon) return null;
                                  return (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300 border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 rounded-md motion-safe:animate-pulse"
                                      title="配当落ち日が近い（7日以内）"
                                    >
                                      <CalendarClock className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden />
                                      X近
                                    </span>
                                  );
                                })()}
                                {stock.dividendYieldPercent != null && stock.dividendYieldPercent >= 3 ? (
                                  <span
                                    className="text-[10px] font-bold text-amber-200 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 rounded-md"
                                    title="高配当（Div% >= 3）"
                                  >
                                    還流
                                  </span>
                                ) : null}
                                </div>
                              <YahooReturnChips
                                consecutiveDividendYears={stock.consecutiveDividendYears}
                                ttmRepurchaseOfStock={stock.ttmRepurchaseOfStock}
                                yahooBuybackPosture={stock.yahooBuybackPosture}
                                yahooQuoteSharesOutstanding={stock.yahooQuoteSharesOutstanding}
                                yahooInsiderNetPurchaseShares={stock.yahooInsiderNetPurchaseShares}
                              />
                              <div className="flex flex-col gap-0.5">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono text-muted-foreground">
                                  <span title="配当落ち日（ex-dividend date）">
                                    X:{stock.exDividendDate ?? "—"}
                                    {stock.daysToExDividend != null && stock.daysToExDividend >= 0
                                      ? ` (D-${stock.daysToExDividend})`
                                      : ""}
                                  </span>
                                  <span title="権利確定日（record date）">
                                    R:{stock.recordDate ?? "—"}
                                    {stock.daysToRecordDate != null && stock.daysToRecordDate >= 0
                                      ? ` (D-${stock.daysToRecordDate})`
                                      : ""}
                                  </span>
                                </div>
                                {(() => {
                                  const r = countdownJa(stock.daysToRecordDate, "権利確定");
                                  const x = countdownJa(stock.daysToExDividend, "配当落ち");
                                  const text = r ?? x;
                                  if (!text) return null;
                                  return <span className="text-[10px] text-muted-foreground">{text}</span>;
                                })()}
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {stock.accountType ?? "特定"}
                              </span>
                            </div>
                          </td>
                        );
                      case "ruleOf40":
                        return (
                          <td key={colId} className="px-6 py-4 text-right font-mono text-xs">
                            {(() => {
                              const r40 = rule40Tone(stock.ruleOf40);
                              return (
                                <span className={r40.cls} title="Rule of 40 = revenueGrowth + fcfMargin">
                                  {r40.text}
                                </span>
                              );
                            })()}
                          </td>
                        );
                      case "fcfYield":
                        return (
                          <td key={colId} className="px-6 py-4 text-right font-mono text-xs">
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
                        );
                      case "netCash":
                        return (
                          <td
                            key={colId}
                            className="px-4 py-4 text-right font-mono text-xs text-foreground/90"
                            title={
                              stock.netCash != null
                                ? `P−NC/株 ギャップ: ${
                                    stock.priceMinusNetCashPerShare != null && Number.isFinite(stock.priceMinusNetCashPerShare)
                                      ? formatSignedLocalMoneyForView(
                                          stock.priceMinusNetCashPerShare,
                                          nativeCurrencyForStock(stock),
                                          viewCurrency,
                                          convert,
                                        )
                                      : "—"
                                  }（株価−1株ネットC）`
                                : undefined
                            }
                          >
                            {stock.netCash != null && Number.isFinite(stock.netCash) ? (
                              formatSignedLocalMoneyForView(
                                stock.netCash,
                                nativeCurrencyForStock(stock),
                                viewCurrency,
                                convert,
                              )
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      case "netCps":
                        return (
                          <td
                            key={colId}
                            className="px-4 py-4 text-right font-mono text-xs text-foreground/90"
                            title="1株当たりネットキャッシュ"
                          >
                            {stock.netCashPerShare != null && Number.isFinite(stock.netCashPerShare) ? (
                              formatSignedLocalPerShareForView(
                                stock.netCashPerShare,
                                nativeCurrencyForStock(stock),
                                viewCurrency,
                                convert,
                              )
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      case "judgment": {
                        const sync = resourceSyncJudgments?.[stock.ticker] ?? null;
                        return (
                          <td key={colId} className="px-4 py-4 text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              <JudgmentBadge status={stock.judgmentStatus} reason={stock.judgmentReason} />
                              {sync && sync.judgment && (
                                <div
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-tighter shadow-sm ring-1 ring-inset",
                                    sync.judgment === "BUY_OPPORTUNITY"
                                      ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
                                      : sync.judgment === "OVERHEATED"
                                        ? "bg-rose-500/15 text-rose-300 ring-rose-500/30"
                                        : sync.judgment === "DECOUPLED"
                                          ? "bg-slate-500/15 text-slate-300 ring-slate-500/30"
                                          : "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
                                  )}
                                  title={`物理資源との乖離: ${sync.spread > 0 ? "+" : ""}${sync.spread}pt`}
                                >
                                  {sync.judgment === "BUY_OPPORTUNITY"
                                    ? "物理出遅れ"
                                    : sync.judgment === "OVERHEATED"
                                      ? "物理過熱"
                                      : sync.judgment === "DECOUPLED"
                                        ? "デカップル"
                                        : "シンクロ"}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      }
                      case "deviation":
                        return (
                          <td
                            key={colId}
                            className={`px-6 py-4 text-right font-mono text-xs font-bold ${
                              z == null
                                ? "text-muted-foreground"
                                : z < -1
                                  ? "text-amber-400"
                                  : z > 1
                                    ? "text-emerald-400"
                                    : "text-foreground/90"
                            }`}
                          >
                            {fmtZ(z)}
                          </td>
                        );
                      case "drawdown":
                        return (
                          <td
                            key={colId}
                            className={`px-6 py-4 text-right font-mono text-xs font-bold ${
                              dd == null ? "text-muted-foreground" : dd < -10 ? "text-rose-400" : "text-foreground/90"
                            }`}
                          >
                            {fmtDd(dd)}
                          </td>
                        );
                      case "alpha":
                        return (
                          <td
                            key={colId}
                            title={appendTitleBlock(
                              `上段: 直近取引日の確定日次Alpha（dailyAlpha）\n` +
                                `下段: 現在値に連動したLive Alpha（liveAlpha, vs ${stock.liveAlphaBenchmarkTicker ?? "Benchmark"}）`,
                              holdingDailyAlphaStoryTitle(stock.alphaHistoryObservationDates, stock.alphaHistory),
                            )}
                            className={`px-6 py-4 text-right font-mono ${
                              liveA != null && liveA <= -2 ? "rounded-md ring-1 ring-cyan-400/45 bg-cyan-500/[0.06]" : ""
                            }`}
                          >
                            <div className="flex flex-col items-end leading-tight">
                              {(() => {
                                const dailyAlpha = recordedLastAlphaPct(stock);
                                const cls =
                                  dailyAlpha == null
                                    ? "text-muted-foreground"
                                    : dailyAlpha > 0
                                      ? "text-emerald-400 font-bold"
                                      : dailyAlpha < 0
                                        ? "text-rose-400 font-bold"
                                        : "text-muted-foreground font-bold";
                                return (
                                  <span className={`tabular-nums ${cls}`} aria-label="daily alpha">
                                    {dailyAlpha == null ? (
                                      "—"
                                    ) : (
                                      <>
                                        {dailyAlpha > 0 ? "+" : ""}
                                        {dailyAlpha.toFixed(2)}%
                                      </>
                                    )}
                                  </span>
                                );
                              })()}

                              {(() => {
                                const cls =
                                  liveA == null
                                    ? "text-muted-foreground"
                                    : liveA > 0
                                      ? "text-emerald-300/80"
                                      : liveA < 0
                                        ? "text-rose-300/80"
                                        : "text-muted-foreground";
                                return (
                                  <span
                                    className={`tabular-nums text-xs whitespace-nowrap ${cls}`}
                                    aria-label="live alpha"
                                  >
                                    {liveA == null ? (
                                      "(—)"
                                    ) : (
                                      <>
                                        ({liveA > 0 ? "+" : ""}
                                        {liveA.toFixed(2)}%)
                                      </>
                                    )}
                                  </span>
                                );
                              })()}
                            </div>
                          </td>
                        );
                      case "trend5d": {
                        const { series, hasIntradayPulse } = fiveDayPulseForStock(stock);
                        return (
                          <td key={colId} className="px-4 py-4 align-middle">
                            {series.length === 0 ? (
                              <span className="text-muted-foreground text-xs">No data</span>
                            ) : (
                              <TrendMiniChart history={series} maxPoints={5} lastBarPulse={hasIntradayPulse} />
                            )}
                          </td>
                        );
                      }
                      case "volRatio": {
                        const vr = volRatioOf(stock);
                        const volCls =
                          vr == null
                            ? "text-muted-foreground"
                            : vr >= 2
                              ? "text-amber-400 font-bold"
                              : vr >= 1.2
                                ? "text-cyan-300/90"
                                : vr >= 0.8
                                  ? "text-foreground/90"
                                  : "text-slate-500";
                        return (
                          <td
                            key={colId}
                            className={cn("px-4 py-4 text-right font-mono text-xs tabular-nums", volCls)}
                            title={vr != null ? `本日出来高 / 10 日平均: ${vr.toFixed(2)}×` : undefined}
                          >
                            {vr == null ? "—" : `${vr.toFixed(2)}×`}
                          </td>
                        );
                      }
                      case "position":
                        return (
                          <td key={colId} className="px-6 py-4 text-right">
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
                                {stock.weight > 0
                                  ? `${stock.weight.toFixed(1)}% wt`
                                  : stock.marketValue > 0
                                    ? "0% wt"
                                    : "—"}
                              </span>
                            </div>
                          </td>
                        );
                      case "pe":
                        return (
                          <td key={colId} className="px-4 py-4 text-right font-mono text-xs tabular-nums text-foreground/90">
                            <DailyAlphaContextTooltip
                              metricLabel="PER"
                              dailyValues={stock.alphaHistory}
                              observationDates={stock.alphaHistoryObservationDates}
                            >
                              <span className="inline-block w-full text-right">{fmtPe(peOf(stock))}</span>
                            </DailyAlphaContextTooltip>
                          </td>
                        );
                      case "pbr":
                        return (
                          <td
                            key={colId}
                            className="px-4 py-4 text-right font-mono text-xs tabular-nums text-foreground/90"
                            title={METRIC_HEADER_TIP.pbr}
                          >
                            {fmtPbr(pbrOf(stock))}
                          </td>
                        );
                      case "peg": {
                        const peg = stock.pegRatio;
                        return (
                          <td
                            key={colId}
                            className={cn(
                              "px-4 py-4 text-right font-mono text-xs tabular-nums align-top",
                              pegRatioTextClass(peg),
                            )}
                            title="PEG · 「成長%」列で予想成長率を参照"
                          >
                            <div className="flex flex-col items-end gap-0.5 leading-tight">
                              <div className="flex items-center justify-end gap-0.5">
                                {pegLynchTreasureEligible(peg) ? (
                                  <span title="お宝（PEG < 1 · PER が成長率を下回る帯）">
                                    <Gem className="h-3 w-3 shrink-0 text-amber-400" aria-hidden />
                                  </span>
                                ) : null}
                                <span>{fmtPegRatio(peg)}</span>
                              </div>
                              {pegLynchTenbaggerEligible(peg) ? (
                                <span
                                  className="text-[9px] font-semibold tracking-tight text-amber-300/95"
                                  title="PEG 極小ゾーン（前提データの質は別途確認）"
                                >
                                  🚀 テンバガー候補
                                </span>
                              ) : null}
                            </div>
                          </td>
                        );
                      }
                      case "trr": {
                        const trr = trrOf(stock);
                        return (
                          <td
                            key={colId}
                            className={cn(
                              "px-4 py-4 text-right font-mono text-xs tabular-nums",
                              totalReturnYieldRatioTextClass(trr),
                            )}
                            title={METRIC_HEADER_TIP.trr}
                          >
                            {fmtTotalReturnYieldRatio(trr)}
                          </td>
                        );
                      }
                      case "egrowth":
                        return (
                          <td
                            key={colId}
                            className="px-4 py-4 text-right font-mono text-xs tabular-nums text-foreground/90"
                            title={
                              stock.expectedGrowth != null && Number.isFinite(stock.expectedGrowth)
                                ? `内部値(小数)=${stock.expectedGrowth.toFixed(6)}`
                                : undefined
                            }
                          >
                            {fmtExpectedGrowthPercent(stock.expectedGrowth)}
                          </td>
                        );
                      case "eps":
                        return (
                          <td
                            key={colId}
                            className={`px-4 py-4 text-right font-mono text-xs font-bold tabular-nums ${
                              (() => {
                                const ep = epsOf(stock);
                                if (ep == null) return "text-muted-foreground";
                                return ep <= 0 ? "text-rose-300" : "text-foreground/90";
                              })()
                            }`}
                          >
                            <DailyAlphaContextTooltip
                              metricLabel="EPS（Trailing 優先）"
                              dailyValues={stock.alphaHistory}
                              observationDates={stock.alphaHistoryObservationDates}
                            >
                              <span className="inline-block w-full text-right">{fmtEps(epsOf(stock))}</span>
                            </DailyAlphaContextTooltip>
                          </td>
                        );
                      case "forecastEps":
                        return (
                          <td
                            key={colId}
                            className={`px-4 py-4 text-right font-mono text-xs font-bold tabular-nums ${
                              (() => {
                                const fe = forecastEpsOf(stock);
                                if (fe == null) return "text-muted-foreground";
                                return fe <= 0 ? "text-rose-300" : "text-cyan-200/90";
                              })()
                            }`}
                          >
                            <DailyAlphaContextTooltip
                              metricLabel="予想EPS（Forward）"
                              dailyValues={stock.alphaHistory}
                              observationDates={stock.alphaHistoryObservationDates}
                            >
                              <span className="inline-block w-full text-right">{fmtEps(forecastEpsOf(stock))}</span>
                            </DailyAlphaContextTooltip>
                          </td>
                        );
                      case "price": {
                        const curOk =
                          stock.currentPrice != null &&
                          Number.isFinite(stock.currentPrice) &&
                          stock.currentPrice > 0;
                        const avg = stock.avgAcquisitionPrice;
                        const avgOk = avg != null && Number.isFinite(avg) && avg > 0;
                        const pctForTone = curOk && avgOk ? stock.unrealizedPnlPercent : null;
                        const pctTone = investmentMetricToneForSignedPercent(pctForTone);
                        const pctCls =
                          pctForTone == null || !Number.isFinite(pctForTone)
                            ? "text-muted-foreground"
                            : INVESTMENT_METRIC_TONE_TEXT_CLASS[pctTone];
                        const pctStr =
                          pctForTone != null && Number.isFinite(pctForTone)
                            ? `${pctForTone > 0 ? "+" : ""}${pctForTone.toFixed(2)}%`
                            : null;
                        return (
                          <td key={colId} className="px-4 py-4 text-right group-hover:bg-muted/60">
                            <div className="flex flex-col items-end gap-0.5 min-w-[6.5rem]">
                              <span className="font-mono text-foreground/90 font-bold tabular-nums">
                                {curOk
                                  ? formatLocalPriceForView(
                                      stock.currentPrice!,
                                      nativeCurrencyForStock(stock),
                                      viewCurrency,
                                      convert,
                                    )
                                  : "—"}
                              </span>
                              {avgOk ? (
                                <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                                  {formatLocalPriceForView(
                                    avg!,
                                    nativeCurrencyForStock(stock),
                                    viewCurrency,
                                    convert,
                                  )}
                                  {pctStr != null ? (
                                    <span className={`ml-1.5 font-semibold ${pctCls}`} title="含み損益%（平均取得比）">
                                      {pctStr}
                                    </span>
                                  ) : null}
                                </span>
                              ) : null}
                              {stock.priceSource === "live" && stock.lastUpdatedAt ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[9px] text-muted-foreground font-mono"
                                  title={`Live（Yahoo quote）\n${new Date(stock.lastUpdatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`}
                                >
                                  <span
                                    className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0 motion-safe:animate-pulse"
                                    aria-hidden
                                  />
                                  <span className="text-[7px] font-bold uppercase tracking-wide text-emerald-400/90">
                                    Live
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          </td>
                        );
                      }
                      default: {
                        const _exhaustive: never = colId;
                        return _exhaustive;
                      }
                    }
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="group bg-card/90 border-t border-border">
              {visibleColumnIds.map((colId, idx) => {
                const isFirst = idx === 0;
                const stickyFoot = isFirst ? stickyTdFootFirst : "";
                switch (colId) {
                  case "asset":
                    return (
                      <td
                        key={colId}
                            className={`px-6 py-3 text-xs font-bold text-foreground/90 min-w-[12rem] max-w-[14rem] ${stickyFoot}`}
                      >
                        Total: {sortedStocks.length}
                        {sortedStocks.length === 1 ? " item" : " items"}
                        {structureFilter.trim() || lynchFilter !== "" || bookmarksOnly || hideIncompleteQuotes || vacuumUnpopularOnly
                          ? `（全 ${totalHoldings}）`
                          : ""}
                      </td>
                    );
                  case "lynch":
                  case "listing":
                  case "mktCap":
                  case "perfListed":
                  case "earnings":
                    return (
                      <td key={colId} className="px-4 py-3 text-[10px] text-muted-foreground">
                        —
                      </td>
                    );
                  case "research":
                    return <td key={colId} className="px-6 py-3 min-w-[18rem]" />;
                  case "ruleOf40":
                    return (
                      <td key={colId} className="px-6 py-3 text-right align-top">
                        {(() => {
                          const r40 = footerStats.avgRuleOf40;
                          const tone =
                            r40 == null || !Number.isFinite(r40)
                              ? { text: "—", cls: "text-muted-foreground" }
                              : rule40Tone(r40);
                          return (
                            <div className="flex flex-col items-end gap-0.5 font-mono text-[11px] leading-tight">
                              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                                Rule of 40
                              </span>
                              <span
                                className={`font-bold ${tone.cls}`}
                                title="時価加重（MV がある銘柄）。MV なしのみは単純平均"
                              >
                                加重 {tone.text}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                    );
                  case "fcfYield":
                    return (
                      <td key={colId} className="px-6 py-3 text-right align-top">
                        {(() => {
                          const fy = footerStats.avgFcfYield;
                          const tone =
                            fy == null || !Number.isFinite(fy)
                              ? { text: "—", cls: "text-muted-foreground" }
                              : fcfYieldTone(fy);
                          return (
                            <div className="flex flex-col items-end gap-0.5 font-mono text-[11px] leading-tight">
                              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                                FCF Yld
                              </span>
                              <span
                                className={`font-bold ${tone.cls}`}
                                title="時価加重（MV がある銘柄）。MV なしのみは単純平均"
                              >
                                加重 {tone.text}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                    );
                  case "netCash":
                  case "netCps":
                    return (
                      <td key={colId} className="px-4 py-3 text-[10px] text-muted-foreground text-right">
                        —
                      </td>
                    );
                  case "judgment":
                    return (
                      <td key={colId} className="px-4 py-3 text-center align-top text-[10px] text-muted-foreground">
                        —
                      </td>
                    );
                  case "deviation":
                    return (
                      <td key={colId} className="px-6 py-3 text-right align-top font-mono text-[11px] leading-tight">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">乖離</span>
                          <span className="font-bold text-foreground/90">{fmtZ(footerStats.avgZ)}</span>
                        </div>
                      </td>
                    );
                  case "drawdown":
                    return (
                      <td key={colId} className="px-6 py-3 text-right align-top font-mono text-[11px] leading-tight">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">落率</span>
                          <span className="font-bold text-foreground/90">{fmtDd(footerStats.avgDd)}</span>
                        </div>
                      </td>
                    );
                  case "alpha": {
                    const sumDaily = averageAlpha;
                    const sumLive = portfolioTotalLiveAlphaPct;
                    return (
                      <td key={colId} className="px-6 py-3 text-right align-top font-mono text-[11px] leading-tight">
                        <div
                          className="flex flex-col items-end gap-0.5"
                          title={
                            tableFilterActive
                              ? "上段・括弧: サマリーベース（ヘッダー Pulse と同じ定義）。下段: 表示中の行だけの算術平均。"
                              : "ダッシュボード/テーマ集計とヘッダー Pulse と同じ（確定日次αの平均・ライブは時価加重）。"
                          }
                        >
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            Avg Alpha
                          </span>
                          <span
                            className={`font-bold tabular-nums ${
                              Number.isFinite(sumDaily) && sumDaily > 0
                                ? "text-emerald-400"
                                : Number.isFinite(sumDaily) && sumDaily < 0
                                  ? "text-rose-400"
                                  : "text-slate-400"
                            }`}
                            aria-label="portfolio average daily alpha (summary)"
                          >
                            {Number.isFinite(sumDaily) ? `${sumDaily > 0 ? "+" : ""}${sumDaily.toFixed(2)}%` : "—"}
                          </span>
                          <span
                            className={`text-xs tabular-nums whitespace-nowrap ${
                              sumLive != null && Number.isFinite(sumLive) && sumLive > 0
                                ? "text-emerald-300/80"
                                : sumLive != null && Number.isFinite(sumLive) && sumLive < 0
                                  ? "text-rose-300/80"
                                  : "text-muted-foreground"
                            }`}
                            aria-label="portfolio live alpha weighted (summary)"
                          >
                            {sumLive != null && Number.isFinite(sumLive)
                              ? `(${sumLive > 0 ? "+" : ""}${sumLive.toFixed(2)}%)`
                              : "(—)"}
                          </span>
                          {tableFilterActive ? (
                            <span
                              className="text-[10px] text-muted-foreground tabular-nums text-right max-w-[12rem] leading-tight"
                              title="表の検索/フィルタで絞った行の単純平均"
                            >
                              表示中:{" "}
                              {footerStats.avgDailyAlphaVisible != null && Number.isFinite(footerStats.avgDailyAlphaVisible)
                                ? `${footerStats.avgDailyAlphaVisible > 0 ? "+" : ""}${footerStats.avgDailyAlphaVisible.toFixed(2)}%`
                                : "—"}{" "}
                              {footerStats.avgLiveAlphaVisible != null && Number.isFinite(footerStats.avgLiveAlphaVisible)
                                ? `(${footerStats.avgLiveAlphaVisible > 0 ? "+" : ""}${footerStats.avgLiveAlphaVisible.toFixed(2)}% 行平均)`
                                : ""}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    );
                  }
                  case "trend5d":
                    return (
                      <td key={colId} className="px-4 py-3 text-center align-top font-mono text-[11px] leading-tight">
                        {footerStats.avgFiveDayAlphaDelta != null && Number.isFinite(footerStats.avgFiveDayAlphaDelta) ? (
                          <span
                            className={`font-bold tabular-nums ${
                              footerStats.avgFiveDayAlphaDelta > 0
                                ? "text-emerald-400"
                                : footerStats.avgFiveDayAlphaDelta < 0
                                  ? "text-rose-400"
                                  : "text-muted-foreground"
                            }`}
                            title="表示行の 5D Pulse 系列（暫定含む）先頭→末尾の日次Alpha差の単純平均"
                          >
                            {footerStats.avgFiveDayAlphaDelta > 0 ? "+" : ""}
                            {footerStats.avgFiveDayAlphaDelta.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  case "volRatio":
                    return (
                      <td
                        key={colId}
                        className="px-4 py-3 text-right align-top font-mono text-[11px] leading-tight"
                        title="表示行の出来高比（本日/10日平均）の単純平均"
                      >
                        {footerStats.avgVolRatioVisible != null && Number.isFinite(footerStats.avgVolRatioVisible) ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                              Avg vol
                            </span>
                            <span className="font-bold text-foreground/90 tabular-nums">
                              {footerStats.avgVolRatioVisible.toFixed(2)}×
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  case "position":
                    return (
                      <td key={colId} className="px-6 py-3 text-right align-top">
                        <div className="flex flex-col items-end gap-0.5 font-mono text-[11px] leading-tight">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Σ 時価</span>
                          <span className="font-bold text-foreground/90 tabular-nums">
                            {footerStats.totalMarketValueVisible > 0
                              ? formatJpyValueForView(footerStats.totalMarketValueVisible, viewCurrency, convert)
                              : "—"}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground pt-0.5">
                            Σ ウエイト
                          </span>
                          <span className="font-bold text-blue-400 tabular-nums">
                            {footerStats.sumWeightVisible > 0 ? `${footerStats.sumWeightVisible.toFixed(1)}%` : "—"}
                          </span>
                        </div>
                      </td>
                    );
                  case "pe":
                    return (
                      <td key={colId} className="px-4 py-3 text-right align-top font-mono text-[11px] text-foreground/90">
                        {footerStats.avgPeVisible != null ? fmtPe(footerStats.avgPeVisible) : "—"}
                      </td>
                    );
                  case "pbr":
                    return (
                      <td
                        key={colId}
                        className="px-4 py-3 text-right align-top font-mono text-[11px] text-foreground/90"
                        title="表示行の PBR 単純平均"
                      >
                        {footerStats.avgPbrVisible != null ? fmtPbr(footerStats.avgPbrVisible) : "—"}
                      </td>
                    );
                  case "peg":
                    return (
                      <td
                        key={colId}
                        className={cn(
                          "px-4 py-3 text-right align-top font-mono text-[11px]",
                          pegRatioTextClass(footerStats.avgPegVisible),
                        )}
                      >
                        {footerStats.avgPegVisible != null ? fmtPegRatio(footerStats.avgPegVisible) : "N/A"}
                      </td>
                    );
                  case "trr":
                    return (
                      <td
                        key={colId}
                        className={cn(
                          "px-4 py-3 text-right align-top font-mono text-[11px]",
                          totalReturnYieldRatioTextClass(footerStats.avgTrrVisible),
                        )}
                        title="表示行の TRR 単純平均"
                      >
                        {footerStats.avgTrrVisible != null
                          ? fmtTotalReturnYieldRatio(footerStats.avgTrrVisible)
                          : "N/A"}
                      </td>
                    );
                  case "egrowth":
                    return (
                      <td
                        key={colId}
                        className="px-4 py-3 text-right align-top font-mono text-[11px] text-foreground/90"
                        title="表示行の単純平均（小数ベース）"
                      >
                        {fmtExpectedGrowthPercent(footerStats.avgExpectedGrowthVisible)}
                      </td>
                    );
                  case "eps":
                    return (
                      <td key={colId} className="px-4 py-3 text-right align-top font-mono text-[11px] text-foreground/90">
                        {footerStats.avgEpsVisible != null ? fmtEps(footerStats.avgEpsVisible) : "—"}
                      </td>
                    );
                  case "forecastEps":
                    return (
                      <td
                        key={colId}
                        className="px-4 py-3 text-right align-top font-mono text-[11px] text-foreground/90"
                        title="表示行の予想EPS（Forward）単純平均"
                      >
                        {footerStats.avgForecastEpsVisible != null ? fmtEps(footerStats.avgForecastEpsVisible) : "—"}
                      </td>
                    );
                  case "price":
                    return (
                      <td
                        key={colId}
                        className="px-4 py-3 text-right align-top font-mono text-[11px] leading-tight"
                        title="表示中の行について、現在株価をビュー通貨に換算した統計（時価加重平均・単純平均・min/max）"
                      >
                        {footerStats.priceViewCount > 0 ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                              Price ({viewCurrency})
                            </span>
                            {footerStats.priceViewWeightedMean != null ? (
                              <span className="font-bold text-foreground/90 tabular-nums">
                                加重{" "}
                                {formatLocalPriceForView(
                                  footerStats.priceViewWeightedMean,
                                  viewCurrency,
                                  viewCurrency,
                                  convert,
                                )}
                              </span>
                            ) : null}
                            {footerStats.priceViewSimpleMean != null ? (
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                単純{" "}
                                {formatLocalPriceForView(
                                  footerStats.priceViewSimpleMean,
                                  viewCurrency,
                                  viewCurrency,
                                  convert,
                                )}
                              </span>
                            ) : null}
                            {footerStats.priceViewMin != null && footerStats.priceViewMax != null ? (
                              <span className="text-[10px] text-muted-foreground/90 tabular-nums max-w-[14rem] leading-tight">
                                min{" "}
                                {formatLocalPriceForView(
                                  footerStats.priceViewMin,
                                  viewCurrency,
                                  viewCurrency,
                                  convert,
                                )}{" "}
                               〜 max{" "}
                                {formatLocalPriceForView(
                                  footerStats.priceViewMax,
                                  viewCurrency,
                                  viewCurrency,
                                  convert,
                                )}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  default: {
                    const _exhaustive: never = colId;
                    return _exhaustive;
                  }
                }
              })}
            </tr>
          </tfoot>
        </table>
        </DndContext>
      </div>
      </div>

      <DividendCalendarModal
        open={dividendCalendarModalOpen}
        onClose={() => setDividendCalendarModalOpen(false)}
        data={dividendCalendarData}
      />

    </div>
  );
}
