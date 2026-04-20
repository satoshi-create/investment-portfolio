"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, GripVertical, NotebookPen, Search, X } from "lucide-react";
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
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";
import {
  formatJpyValueForView,
  formatLocalPriceForView,
  nativeCurrencyForStock,
} from "@/src/lib/format-display-currency";
import { JudgmentBadge } from "@/src/components/dashboard/JudgmentBadge";
import { judgmentPriorityRank, type JudgmentStatus } from "@/src/lib/judgment-logic";
import { computeLiveAlphaDayPercent } from "@/src/lib/alpha-logic";
import {
  DEFAULT_COLUMN_ORDER,
  type InventoryColId,
  loadInventoryColumnOrder,
  saveInventoryColumnOrder,
} from "@/src/lib/inventory-column-order";

type SortKey =
  | "asset"
  | "alpha"
  | "trend"
  | "position"
  | "research"
  | "deviation"
  | "drawdown"
  | "ruleOf40"
  | "fcfYield"
  | "judgment"
  | "pe"
  | "eps";

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

function liveDailyAlphaPct(s: Stock): number | null {
  return computeLiveAlphaDayPercent({
    livePrice: s.currentPrice,
    previousClose: s.previousClose,
    benchmarkDayChangePercent: s.benchmarkDayChangePercent,
  });
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

function SortableInventoryTh({
  id,
  className,
  align = "left",
  title,
  children,
}: {
  id: InventoryColId;
  className?: string;
  align?: "left" | "right" | "center";
  title?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.88, zIndex: 50 } : {}),
  };
  const justify =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <th ref={setNodeRef} style={style} className={className} title={title}>
      <div className={`flex w-full items-center gap-1 ${justify}`}>
        <button
          type="button"
          className="cursor-grab touch-none shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="列をドラッグして並べ替え"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
        <div
          className={`min-w-0 ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""}`}
        >
          {children}
        </div>
      </div>
    </th>
  );
}

export function InventoryTable({
  stocks,
  totalHoldings,
  averageAlpha,
  averageFxNeutralAlpha: _averageFxNeutralAlpha,
  userId,
  onEarningsNoteSaved,
  onTrade,
  onTradeNew,
  themeStructuralTrendUp = false,
  resolveEcosystemKeep,
  onToggleEcosystemKeep,
  livePricePollIntervalMs,
  onLivePricePoll,
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
  /** 設定時、間隔ごとに `onLivePricePoll` で株価・ベンチを再取得（ライブ Alpha の更新用） */
  livePricePollIntervalMs?: number;
  onLivePricePoll?: () => void | Promise<void>;
}) {
  const { convert, viewCurrency, alphaDisplayMode } = useCurrencyConverter();

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
  const [columnOrder, setColumnOrder] = useState<InventoryColId[]>(DEFAULT_COLUMN_ORDER);

  useEffect(() => {
    setColumnOrder(loadInventoryColumnOrder());
  }, []);

  useEffect(() => {
    saveInventoryColumnOrder(columnOrder);
  }, [columnOrder]);

  useEffect(() => {
    const ms = livePricePollIntervalMs ?? 0;
    if (ms <= 0 || !onLivePricePoll) return;
    const id = window.setInterval(() => void onLivePricePoll(), ms);
    return () => window.clearInterval(id);
  }, [livePricePollIntervalMs, onLivePricePoll]);

  const visibleColumnIds = useMemo(
    () =>
      columnOrder.filter((id) => {
        if (id === "deviation" || id === "drawdown") return showValueCols;
        return true;
      }),
    [columnOrder, showValueCols],
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
      return arrayMove(items, oldIndex, newIndex);
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
    if (expectationFilter === "__unset__") {
      list = list.filter((s) => s.expectationCategory == null);
    } else if (expectationFilter !== "") {
      list = list.filter((s) => s.expectationCategory === expectationFilter);
    }
    return list;
  }, [stocks, structureFilter, expectationFilter]);

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
      if (key === "alpha") return dir * cmpNum(sortableAlphaValue(a), sortableAlphaValue(b));
      if (key === "trend") return dir * cmpNum(recordedLastAlphaPct(a), recordedLastAlphaPct(b));
      if (key === "position") return dir * cmpNum(a.marketValue, b.marketValue);
      if (key === "judgment") {
        const ja = judgmentPriorityRank(a.judgmentStatus as JudgmentStatus);
        const jb = judgmentPriorityRank(b.judgmentStatus as JudgmentStatus);
        if (ja !== jb) return dir * (ja - jb);
        return dir * cmpStr(a.ticker, b.ticker);
      }
      if (key === "pe") return dir * cmpNum(peOf(a), peOf(b));
      if (key === "eps") return dir * cmpNum(epsOf(a), epsOf(b));
      if (key === "ruleOf40") return dir * cmpNum(ruleOf40SortValue(a), ruleOf40SortValue(b));
      if (key === "fcfYield") return dir * cmpNum(fcfYieldSortValue(a), fcfYieldSortValue(b));
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
    let epsSum = 0;
    let epsN = 0;
    let trend5dSum = 0;
    let trend5dN = 0;
    for (const s of rows) {
      const pe = peOf(s);
      if (pe != null) {
        peSum += pe;
        peN += 1;
      }
      const ep = epsOf(s);
      if (ep != null) {
        epsSum += ep;
        epsN += 1;
      }
      const h = s.alphaHistory;
      if (h.length >= 5) {
        const last = h[h.length - 1]!;
        const prev5 = h[h.length - 5]!;
        if (Number.isFinite(last) && Number.isFinite(prev5)) {
          trend5dSum += last - prev5;
          trend5dN += 1;
        }
      }
    }

    return {
      avgRuleOf40,
      avgFcfYield,
      avgZ: zN > 0 ? zSum / zN : null,
      avgDd: ddN > 0 ? ddSum / ddN : null,
      avgDailyAlphaVisible,
      avgLiveAlphaVisible,
      avgPeVisible: peN > 0 ? peSum / peN : null,
      avgEpsVisible: epsN > 0 ? epsSum / epsN : null,
      avgFiveDayAlphaDelta: trend5dN > 0 ? trend5dSum / trend5dN : null,
      totalMarketValueVisible: totalMv,
      sumWeightVisible: sumWt,
    };
  }, [sortedStocks]);

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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInventoryColumnDragEnd}>
          <table className="w-full min-w-[1040px] text-left text-xs lg:text-sm">
            <thead className="bg-background text-muted-foreground text-[10px] uppercase font-bold tracking-[0.1em]">
              <tr>
                <SortableContext items={visibleColumnIds} strategy={horizontalListSortingStrategy}>
                  {visibleColumnIds.map((colId, idx) => {
                    const isFirst = idx === 0;
                    const stickyFirst = isFirst ? stickyThFirst : "";
                    switch (colId) {
                      case "asset":
                        return (
                          <SortableInventoryTh
                            key={colId}
                            id={colId}
                            align="left"
                            className={`px-6 py-4 min-w-[12rem] max-w-[14rem] ${stickyFirst} cursor-pointer select-none`}
                            title="Sort"
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
                      case "research":
                        return (
                          <SortableInventoryTh
                            key={colId}
                            id={colId}
                            align="left"
                            className="px-6 py-4 text-left cursor-pointer select-none"
                            title="Sort"
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
                          <SortableInventoryTh
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            title="Rule of 40（売上成長率% + FCFマージン%）"
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
                          <SortableInventoryTh
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            title="FCF Yield（%）= 年次 FCF / (株価×希薄化株数)。負の FCF はマイナス%で表示"
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
                      case "judgment":
                        return (
                          <SortableInventoryTh
                            key={colId}
                            id={colId}
                            align="center"
                            className="px-4 py-4 text-center cursor-pointer select-none whitespace-nowrap"
                            title="投資優先度（ELITE → ACCUMULATE → WATCH → DANGER）"
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
                          <SortableInventoryTh
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            title="Alpha 乖離（σ）"
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
                          <SortableInventoryTh
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            title="90 日高値比"
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
                          <SortableInventoryTh
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-6 py-4 text-right cursor-pointer select-none"
                            title="対ベンチ日次超過（現在値×^GSPC / ^TPX）。データ欠損時は記録 Alpha で並び替え"
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
                      case "trend":
                        return (
                          <SortableInventoryTh
                            key={colId}
                            id={colId}
                            align="center"
                            className="px-6 py-4 text-center cursor-pointer select-none"
                            title="Sort"
                          >
                            <button
                              type="button"
                              className="bg-transparent p-0 font-[inherit] text-inherit"
                              onClick={() => toggleSort("trend")}
                            >
                              5D Trend{sortMark("trend")}
                            </button>
                          </SortableInventoryTh>
                        );
                      case "position":
                        return (
                          <SortableInventoryTh
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-6 py-4 text-right cursor-pointer select-none"
                            title="Sort"
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
                          <SortableInventoryTh
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            title="Trailing 優先、なければ Forward PER"
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
                      case "eps":
                        return (
                          <SortableInventoryTh
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            title="Trailing 優先、なければ Forward EPS"
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
                      case "price":
                        return (
                          <SortableInventoryTh
                            key={colId}
                            id={colId}
                            align="right"
                            className="px-4 py-4 text-right whitespace-nowrap"
                            title="現在値（Price）"
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
              return (
                <tr key={stock.id} className="group hover:bg-muted/60 transition-all">
                  {visibleColumnIds.map((colId, idx) => {
                    const isFirst = idx === 0;
                    const stickyFirst = isFirst ? stickyTdFirst : "";
                    switch (colId) {
                      case "asset":
                        return (
                          <td key={colId} className={`px-6 py-4 min-w-[12rem] max-w-[14rem] ${stickyFirst}`}>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex flex-row flex-nowrap items-start justify-between gap-2 whitespace-nowrap">
                                <span className="font-bold text-foreground group-hover:text-accent-cyan transition-colors inline-flex items-center gap-1 min-w-0 whitespace-nowrap">
                                  {opp ? (
                                    <span
                                      className="shrink-0 text-base leading-none"
                                      title="テーマ構造トレンド上向きでの統計的な割安（σ）、またはライブ日次 Alpha が対ベンチで −2% 以下の乖離（要確認）"
                                      aria-label="Opportunity"
                                    >
                                      ✨
                                    </span>
                                  ) : null}
                                  <span className="truncate whitespace-nowrap">{stock.ticker}</span>
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
                              {onTrade ? (
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onTrade(tradeInitialForStock(stock))}
                                    className="text-[9px] font-bold uppercase tracking-wide text-accent-cyan border border-accent-cyan/40 px-2 py-0.5 rounded-md hover:bg-accent-cyan/10"
                                  >
                                    Trade
                                  </button>
                                </div>
                              ) : null}
                              {stock.name ? (
                                <span
                                  className="text-[10px] text-muted-foreground leading-snug line-clamp-2"
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
                      case "research":
                        return (
                          <td key={colId} className="px-6 py-4">
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
                      case "judgment":
                        return (
                          <td key={colId} className="px-4 py-4 text-center">
                            <JudgmentBadge status={stock.judgmentStatus} reason={stock.judgmentReason} />
                          </td>
                        );
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
                            title={
                              `上段: 直近取引日の確定日次Alpha（dailyAlpha）\n` +
                              `下段: 現在値に連動したLive Alpha（liveAlpha, vs ${stock.liveAlphaBenchmarkTicker ?? "Benchmark"}）`
                            }
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
                      case "trend":
                        return (
                          <td key={colId} className="px-6 py-4">
                            {stock.alphaHistory.length === 0 ? (
                              <span className="text-muted-foreground text-xs">No data</span>
                            ) : (
                              <TrendMiniChart history={stock.alphaHistory} maxPoints={5} />
                            )}
                          </td>
                        );
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
                            {fmtPe(peOf(stock))}
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
                            title={
                              epsOf(stock) != null && epsOf(stock)! <= 0
                                ? "EPS <= 0（赤字・特損など含む）。PERは参考になりにくい場合があります。"
                                : undefined
                            }
                          >
                            {fmtEps(epsOf(stock))}
                          </td>
                        );
                      case "price":
                        return (
                          <td key={colId} className="px-4 py-4 text-right group-hover:bg-muted/60">
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
                        {structureFilter.trim() || expectationFilter !== "" ? `（全 ${totalHoldings}）` : ""}
                      </td>
                    );
                  case "research":
                    return <td key={colId} className="px-6 py-3" />;
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
                  case "alpha":
                    return (
                      <td key={colId} className="px-6 py-3 text-right align-top font-mono text-[11px] leading-tight">
                        <div
                          className="flex flex-col items-end gap-0.5"
                          title={"上段: 表示行の確定日次Alpha（dailyAlpha）の単純平均\n下段: 表示行の現在連動Alpha（liveAlpha）の単純平均"}
                        >
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            Avg Alpha
                          </span>
                          <span
                            className={`font-bold tabular-nums ${
                              footerStats.avgDailyAlphaVisible != null && footerStats.avgDailyAlphaVisible > 0
                                ? "text-emerald-400"
                                : footerStats.avgDailyAlphaVisible != null && footerStats.avgDailyAlphaVisible < 0
                                  ? "text-rose-400"
                                  : "text-slate-400"
                            }`}
                            aria-label="avg daily alpha"
                          >
                            {footerStats.avgDailyAlphaVisible != null && Number.isFinite(footerStats.avgDailyAlphaVisible)
                              ? `${footerStats.avgDailyAlphaVisible > 0 ? "+" : ""}${footerStats.avgDailyAlphaVisible.toFixed(2)}%`
                              : "—"}
                          </span>
                          <span
                            className={`text-xs tabular-nums whitespace-nowrap ${
                              footerStats.avgLiveAlphaVisible != null && footerStats.avgLiveAlphaVisible > 0
                                ? "text-emerald-300/80"
                                : footerStats.avgLiveAlphaVisible != null && footerStats.avgLiveAlphaVisible < 0
                                  ? "text-rose-300/80"
                                  : "text-muted-foreground"
                            }`}
                            aria-label="avg live alpha"
                          >
                            {footerStats.avgLiveAlphaVisible != null && Number.isFinite(footerStats.avgLiveAlphaVisible)
                              ? `(${footerStats.avgLiveAlphaVisible > 0 ? "+" : ""}${footerStats.avgLiveAlphaVisible.toFixed(2)}%)`
                              : "(—)"}
                          </span>
                        </div>
                      </td>
                    );
                  case "trend":
                    return (
                      <td key={colId} className="px-6 py-3 text-center align-top font-mono text-[11px] leading-tight">
                        {footerStats.avgFiveDayAlphaDelta != null && Number.isFinite(footerStats.avgFiveDayAlphaDelta) ? (
                          <span
                            className={`font-bold tabular-nums ${
                              footerStats.avgFiveDayAlphaDelta > 0
                                ? "text-emerald-400"
                                : footerStats.avgFiveDayAlphaDelta < 0
                                  ? "text-rose-400"
                                  : "text-muted-foreground"
                            }`}
                            title="表示行の Alpha 終値における直近5営業日変化の単純平均"
                          >
                            {footerStats.avgFiveDayAlphaDelta > 0 ? "+" : ""}
                            {footerStats.avgFiveDayAlphaDelta.toFixed(2)}%
                          </span>
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
                  case "eps":
                    return (
                      <td key={colId} className="px-4 py-3 text-right align-top font-mono text-[11px] text-foreground/90">
                        {footerStats.avgEpsVisible != null ? fmtEps(footerStats.avgEpsVisible) : "—"}
                      </td>
                    );
                  case "price":
                    return <td key={colId} className="px-4 py-3 align-top" />;
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
