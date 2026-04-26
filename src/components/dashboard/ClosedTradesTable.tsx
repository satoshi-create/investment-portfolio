import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileSpreadsheet, GripVertical, History, Search } from "lucide-react";
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
import { cn } from "@/src/lib/cn";

import type { ClosedTradeDashboardRow } from "@/src/types/investment";
import { CLOSED_TRADE_CSV_COLUMNS, closedTradesToCsvRows } from "@/src/lib/csv-dashboard-presets";
import {
  type ClosedTradeColId,
  CLOSED_TRADE_COLUMN_IDS,
  readClosedTradesColOrderFromStorage,
  writeClosedTradesColOrderToStorage,
} from "@/src/lib/closed-trades-column-order";
import { exportToCSV, portfolioCsvFileName } from "@/src/lib/csv-export";
import { normalizeSearchQuery } from "@/src/lib/search-normalize";
import { stickyTdFirst, stickyTdFootFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";

const jpyFmt = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
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
  if (v == null || !Number.isFinite(v)) return "text-muted-foreground";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function pnlClass(v: number): string {
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function computeClosedTradesFooter(rows: ClosedTradeDashboardRow[]) {
  let sumQty = 0;
  let sumCostJpy = 0;
  let sumProceedsJpy = 0;
  let sumFeesJpy = 0;
  let sumRealizedPnlJpy = 0;
  const postExitPcts: number[] = [];
  const pnls: number[] = [];
  const prices: number[] = [];

  for (const r of rows) {
    if (Number.isFinite(r.quantity) && r.quantity > 0) sumQty += r.quantity;
    if (Number.isFinite(r.costJpy)) sumCostJpy += r.costJpy;
    if (Number.isFinite(r.proceedsJpy)) sumProceedsJpy += r.proceedsJpy;
    if (Number.isFinite(r.feesJpy)) sumFeesJpy += r.feesJpy;
    if (Number.isFinite(r.realizedPnlJpy)) {
      sumRealizedPnlJpy += r.realizedPnlJpy;
      pnls.push(r.realizedPnlJpy);
    }
    if (r.postExitReturnPct != null && Number.isFinite(r.postExitReturnPct)) {
      postExitPcts.push(r.postExitReturnPct);
    }
    if (r.currentPriceJpy != null && Number.isFinite(r.currentPriceJpy) && r.currentPriceJpy > 0) {
      prices.push(r.currentPriceJpy);
    }
  }

  const avgPostExitPct =
    postExitPcts.length > 0
      ? Math.round((postExitPcts.reduce((a, b) => a + b, 0) / postExitPcts.length) * 100) / 100
      : null;
  const minPnl = pnls.length > 0 ? Math.min(...pnls) : null;
  const maxPnl = pnls.length > 0 ? Math.max(...pnls) : null;
  const minPost = postExitPcts.length > 0 ? Math.min(...postExitPcts) : null;
  const maxPost = postExitPcts.length > 0 ? Math.max(...postExitPcts) : null;
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

  return {
    count: rows.length,
    sumQty,
    sumCostJpy,
    sumProceedsJpy,
    sumFeesJpy,
    sumRealizedPnlJpy,
    avgPostExitPct,
    postExitCount: postExitPcts.length,
    minPnl,
    maxPnl,
    minPost,
    maxPost,
    minPrice,
    maxPrice,
  };
}

function formatMoneyJpyOrUsd(jpy: number, mode: "JPY" | "USD", fx: number | null) {
  if (mode === "JPY" || fx == null || !Number.isFinite(fx) || fx <= 0) return jpyFmt.format(jpy);
  return usdFmt.format(jpy / fx);
}

type SortableThProps = {
  id: ClosedTradeColId;
  children: React.ReactNode;
  className: string;
};

function SortableTh({ id, className, children }: SortableThProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 20 : 0, opacity: isDragging ? 0.85 : 1 };
  return (
    <th
      ref={setNodeRef}
      style={style as React.CSSProperties}
      className={className}
      scope="col"
    >
      <div className="inline-flex w-full items-center justify-between gap-1.5 min-w-0">
        <span
          className="cursor-grab touch-manipulation p-0.5 rounded text-muted-foreground hover:text-foreground/90 shrink-0"
          {...attributes}
          {...listeners}
          title="列をドラッグして移動"
          aria-label="Drag column"
        >
          <GripVertical size={14} />
        </span>
        {children}
      </div>
    </th>
  );
}

type SortKey =
  | "name"
  | "ticker"
  | "date"
  | "market"
  | "account"
  | "side"
  | "qty"
  | "cost"
  | "proceeds"
  | "fees"
  | "pnl"
  | "price"
  | "post"
  | "verdict";

const SORT_BY_COL: Partial<Record<ClosedTradeColId, SortKey>> = {
  name: "name",
  ticker: "ticker",
  date: "date",
  market: "market",
  account: "account",
  side: "side",
  qty: "qty",
  cost: "cost",
  proceeds: "proceeds",
  fees: "fees",
  pnl: "pnl",
  price: "price",
  post: "post",
  reason: undefined,
  verdict: "verdict",
};

function colHeaderLabel(id: ClosedTradeColId, displayCurrency: "JPY" | "USD"): string {
  const yen = displayCurrency === "JPY";
  switch (id) {
    case "name":
      return "銘柄名";
    case "ticker":
      return "ティッカー";
    case "date":
      return "約定日";
    case "market":
      return "市場";
    case "account":
      return "口座";
    case "side":
      return "売買";
    case "qty":
      return "数量";
    case "cost":
      return yen ? "取得代金（円）" : "取得代金（相当USD）";
    case "proceeds":
      return yen ? "譲渡代金（円）" : "譲渡代金（相当USD）";
    case "fees":
      return yen ? "諸経費" : "諸経費（相当USD）";
    case "pnl":
      return yen ? "確定損益" : "確定損益（相当USD）";
    case "price":
      return yen ? "現在価格（円/単位）" : "現在価格（USD/単位）";
    case "post":
      return "売却後騰落率";
    case "reason":
      return "理由";
    case "verdict":
      return "売却判定";
    default:
      return id;
  }
}

function closedTradeRowMatchesQuery(r: ClosedTradeDashboardRow, q: string): boolean {
  if (q.length === 0) return true;
  const parts = [
    r.ticker,
    r.name,
    r.tradeDate,
    r.accountName,
    r.market,
    r.side,
    r.verdictLabel ?? "",
    r.reason ?? "",
  ].map((x) => normalizeSearchQuery(String(x)));
  return parts.some((p) => p.includes(q));
}

export function ClosedTradesTable({
  rows,
  displayCurrency = "JPY",
  fxUsdJpy = null,
}: {
  rows: ClosedTradeDashboardRow[];
  displayCurrency?: "JPY" | "USD";
  /** USD 表示用（円価 / fx）。 */
  fxUsdJpy?: number | null;
}) {
  const [colOrder, setColOrder] = useState<ClosedTradeColId[]>(() => [...CLOSED_TRADE_COLUMN_IDS]);
  const [expandedReasonId, setExpandedReasonId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tradeSearchQuery, setTradeSearchQuery] = useState("");

  useEffect(() => {
    setColOrder(readClosedTradesColOrderFromStorage());
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onColDrag = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over == null || active.id === over.id) return;
    setColOrder((o) => {
      const a = o.indexOf(active.id as ClosedTradeColId);
      const b = o.indexOf(over.id as ClosedTradeColId);
      if (a < 0 || b < 0) return o;
      const n = arrayMove(o, a, b);
      writeClosedTradesColOrderToStorage(n);
      return n;
    });
  };

  const filteredRows = useMemo(() => {
    const q = normalizeSearchQuery(tradeSearchQuery);
    if (q.length === 0) return rows;
    return rows.filter((r) => closedTradeRowMatchesQuery(r, q));
  }, [rows, tradeSearchQuery]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...filteredRows];
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
        case "name":
          return dir * cmpStr(a.name ?? "", b.name ?? "");
        case "ticker":
          return dir * cmpStr(a.ticker, b.ticker);
        case "date":
          return dir * cmpStr(a.tradeDate, b.tradeDate);
        case "market":
          return dir * cmpStr(a.market, b.market);
        case "account":
          return dir * cmpStr(a.accountName ?? "", b.accountName ?? "");
        case "side":
          return dir * cmpStr(a.side, b.side);
        case "qty":
          return dir * cmpNum(a.quantity, b.quantity);
        case "cost":
          return dir * cmpNum(a.costJpy, b.costJpy);
        case "proceeds":
          return dir * cmpNum(a.proceedsJpy, b.proceedsJpy);
        case "fees":
          return dir * cmpNum(a.feesJpy, b.feesJpy);
        case "pnl":
          return dir * cmpNum(a.realizedPnlJpy, b.realizedPnlJpy);
        case "price":
          return dir * cmpNum(a.currentPriceJpy, b.currentPriceJpy);
        case "post":
          return dir * cmpNum(a.postExitReturnPct, b.postExitReturnPct);
        case "verdict":
          return dir * cmpStr(a.verdictLabel ?? "", b.verdictLabel ?? "");
        default:
          return 0;
      }
    });
    return arr;
  }, [filteredRows, sortDir, sortKey]);

  const footer = useMemo(() => computeClosedTradesFooter(sorted), [sorted]);

  function toggleSort(next: SortKey) {
    if (next === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(next);
      setSortDir("desc");
    }
  }

  function sortMark(k: SortKey) {
    if (k !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const nCol = colOrder.length;

  function handleCsvDownload() {
    exportToCSV(closedTradesToCsvRows(sorted), portfolioCsvFileName("closed_trades"), CLOSED_TRADE_CSV_COLUMNS);
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-border bg-card/60 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <History size={16} className="text-amber-500/90 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">取引履歴</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              完了済み売買（DB: trade_history・売却のみ）。現在価格は Yahoo 終値ベース（米国株は{" "}
              <span className="font-mono text-muted-foreground/90">JPY=X</span> で円換算）。金額の JPY/USD
              はログページ上部のトグルに連動します。
            </p>
            {rows.length > 0 ? (
              <p className="text-[10px] text-muted-foreground/90 mt-1.5">
                各列見出し左のグリップ（縦点アイコン）をドラッグして列順を変更。表下のフッターは検索後の表示行に対する合計・min/max。CSV
                は検索・並び順を反映した表示行のみ出力。列順はブラウザに保存されます。
              </p>
            ) : null}
          </div>
        </div>
        {rows.length > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            <label className="relative flex items-center min-w-[10rem] max-w-[18rem]">
              <span className="sr-only">取引履歴を検索</span>
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none shrink-0"
                aria-hidden
              />
              <input
                type="search"
                value={tradeSearchQuery}
                onChange={(e) => setTradeSearchQuery(e.target.value)}
                placeholder="銘柄・名前・日付・理由…"
                className="w-full rounded-lg border border-border bg-muted/80 py-2 pl-8 pr-3 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/40"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              onClick={handleCsvDownload}
              disabled={sorted.length === 0}
              className="inline-flex items-center gap-1.5 shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-muted/50 transition-all disabled:opacity-40 disabled:pointer-events-none"
              title="検索・並び順を反映した行のみ CSV でダウンロード"
            >
              <FileSpreadsheet size={14} />
              CSV
            </button>
          </div>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 space-y-3 text-sm text-muted-foreground">
          <p>
            行がありません。マイグレーション{" "}
            <span className="font-mono text-muted-foreground/90">005_trade_history</span> を適用し、
            <span className="font-mono text-muted-foreground/90"> trade_history</span> にデータを投入してください。
          </p>
          <p className="text-[11px] leading-relaxed border-t border-border/60 pt-3">
            <span className="font-bold text-foreground/80">列の並べ替え（DnD）とフッター集計</span>は、売却完了行が 1 行以上あるときに表の下で利用できます（空のときは表を出していません）。
          </p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted-foreground">
          検索に一致する取引がありません。条件を変えるか検索をクリアしてください。
        </div>
      ) : (
        <div className="overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onColDrag}>
            <table className="w-full text-left text-sm min-w-[1360px]">
            <thead className="bg-background text-muted-foreground text-[10px] uppercase font-bold tracking-[0.06em]">
              <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
                <tr>
                  {colOrder.map((cid, idx) => {
                    const sk = SORT_BY_COL[cid];
                    const alignR =
                      cid === "qty" || cid === "cost" || cid === "proceeds" || cid === "fees" || cid === "pnl" || cid === "price" || cid === "post";
                    const thCls = cn(
                      "px-3 py-3 whitespace-nowrap select-none",
                      alignR ? "text-right" : "",
                      idx === 0 && stickyThFirst,
                      idx === 0 && cid === "name" && "min-w-[7rem] max-w-[10rem]",
                    );
                    const label = colHeaderLabel(cid, displayCurrency);
                    return (
                      <SortableTh key={cid} id={cid} className={thCls}>
                        {sk ? (
                          <button
                            type="button"
                            className={cn("w-full", alignR ? "text-right" : "text-left cursor-pointer") + " "}
                            onClick={() => toggleSort(sk)}
                            title="Sort"
                          >
                            {label}
                            {sortMark(sk)}
                          </button>
                        ) : (
                          <span className="text-left" title="trade_history.reason">
                            {label}
                          </span>
                        )}
                      </SortableTh>
                    );
                  })}
                </tr>
              </SortableContext>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sorted.map((r) => {
                const reasonOpen = expandedReasonId === r.id;
                const hasReason = r.reason != null && r.reason.trim().length > 0;
                return (
                  <React.Fragment key={r.id}>
                    <tr className="group hover:bg-muted/60 transition-colors">
                      {colOrder.map((cid) => {
                        const isFirstCol = colOrder[0] === cid;
                        const sCls = cn(
                          "px-3 py-2.5 text-xs",
                          isFirstCol && stickyTdFirst,
                          cid === "name" && "min-w-[7rem] max-w-[10rem] text-muted-foreground",
                        );
                        switch (cid) {
                          case "name":
                            return (
                              <td key={cid} className={sCls} title={r.name || undefined}>
                                <span className="line-clamp-3 break-words">{r.name || "—"}</span>
                              </td>
                            );
                          case "ticker":
                            return (
                              <td key={cid} className="px-3 py-2.5 font-mono text-foreground/90 text-xs whitespace-nowrap">
                                {r.ticker}
                              </td>
                            );
                          case "date":
                            return (
                              <td key={cid} className="px-3 py-2.5 font-mono text-muted-foreground text-xs whitespace-nowrap">
                                {r.tradeDate}
                              </td>
                            );
                          case "market":
                            return (
                              <td key={cid} className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                                {marketLabel(r.market)}
                              </td>
                            );
                          case "account":
                            return (
                              <td key={cid} className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                                {r.accountName}
                              </td>
                            );
                          case "side":
                            return (
                              <td key={cid} className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                                {sideLabel(r.side)}
                              </td>
                            );
                          case "qty":
                            return (
                              <td key={cid} className="px-3 py-2.5 text-right font-mono text-muted-foreground text-xs">
                                {fmtQty(r.quantity)}
                              </td>
                            );
                          case "cost":
                            return (
                              <td key={cid} className="px-3 py-2.5 text-right font-mono text-muted-foreground text-xs">
                                {formatMoneyJpyOrUsd(r.costJpy, displayCurrency, fxUsdJpy)}
                              </td>
                            );
                          case "proceeds":
                            return (
                              <td key={cid} className="px-3 py-2.5 text-right font-mono text-muted-foreground text-xs">
                                {formatMoneyJpyOrUsd(r.proceedsJpy, displayCurrency, fxUsdJpy)}
                              </td>
                            );
                          case "fees":
                            return (
                              <td key={cid} className="px-3 py-2.5 text-right font-mono text-muted-foreground text-xs">
                                {formatMoneyJpyOrUsd(r.feesJpy, displayCurrency, fxUsdJpy)}
                              </td>
                            );
                          case "pnl":
                            return (
                              <td
                                key={cid}
                                className={`px-3 py-2.5 text-right font-mono text-xs font-medium ${pnlClass(r.realizedPnlJpy)}`}
                              >
                                {formatMoneyJpyOrUsd(r.realizedPnlJpy, displayCurrency, fxUsdJpy)}
                              </td>
                            );
                          case "price":
                            return (
                              <td key={cid} className="px-3 py-2.5 text-right font-mono text-foreground/90 text-xs">
                                {r.currentPriceJpy != null && Number.isFinite(r.currentPriceJpy)
                                  ? formatMoneyJpyOrUsd(r.currentPriceJpy, displayCurrency, fxUsdJpy)
                                  : "—"}
                              </td>
                            );
                          case "post":
                            return (
                              <td
                                key={cid}
                                className={`px-3 py-2.5 text-right font-mono text-xs font-medium ${pctClass(r.postExitReturnPct)}`}
                              >
                                {fmtPct(r.postExitReturnPct)}
                              </td>
                            );
                          case "reason":
                            return (
                              <td key={cid} className="px-3 py-2.5 align-top max-w-[9rem]">
                                {hasReason ? (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedReasonId(reasonOpen ? null : r.id)}
                                    className="flex w-full items-start justify-between gap-1 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-left transition-colors hover:bg-muted"
                                    aria-expanded={reasonOpen}
                                    title={r.reason ?? undefined}
                                  >
                                    <span className="line-clamp-2 break-words text-[11px] text-muted-foreground leading-snug">
                                      {r.reason}
                                    </span>
                                    <ChevronDown
                                      size={14}
                                      className={`mt-0.5 shrink-0 text-muted-foreground transition-transform ${
                                        reasonOpen ? "rotate-180" : ""
                                      }`}
                                      aria-hidden
                                    />
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            );
                          case "verdict":
                            return (
                              <td key={cid} className="px-3 py-2.5 text-xs whitespace-nowrap text-foreground/90">
                                {r.verdictLabel}
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>
                    {reasonOpen && hasReason ? (
                      <tr className="bg-muted/30 border-t border-border/50">
                        <td colSpan={nCol} className="px-4 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                            取引の理由・反省
                          </p>
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{r.reason}</p>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="group bg-card/95 border-t border-border">
                {colOrder.map((cid) => {
                  const isFirstCol = colOrder[0] === cid;
                  const fCls = cn(
                    "px-3 py-3",
                    isFirstCol && stickyTdFootFirst,
                    cid === "name" && "text-xs font-bold text-foreground/90 min-w-[7rem] max-w-[10rem]",
                  );
                  switch (cid) {
                    case "name":
                      return (
                        <td key="f-name" className={fCls}>
                          Σ / 代表
                          <span className="block text-[10px] font-normal text-muted-foreground font-mono">
                            {footer.count} 件
                          </span>
                        </td>
                      );
                    case "ticker":
                    case "date":
                    case "market":
                    case "account":
                    case "side":
                    case "reason":
                    case "verdict":
                      return (
                        <td key={`f-${cid}`} className="px-3 py-3 text-[10px] text-muted-foreground whitespace-nowrap">
                          —
                        </td>
                      );
                    case "qty":
                      return (
                        <td
                          key="f-qty"
                          className="px-3 py-3 text-right font-mono text-sm font-bold text-foreground whitespace-nowrap"
                          title="日本株・米株で単位が異なるため参考値です。"
                        >
                          {footer.sumQty > 0 ? fmtQty(footer.sumQty) : "—"}
                        </td>
                      );
                    case "cost":
                      return (
                        <td key="f-cost" className="px-3 py-3 text-right font-mono text-sm font-bold text-foreground whitespace-nowrap">
                          {footer.count > 0 ? formatMoneyJpyOrUsd(footer.sumCostJpy, displayCurrency, fxUsdJpy) : "—"}
                        </td>
                      );
                    case "proceeds":
                      return (
                        <td key="f-proc" className="px-3 py-3 text-right font-mono text-sm font-bold text-foreground whitespace-nowrap">
                          {footer.count > 0 ? formatMoneyJpyOrUsd(footer.sumProceedsJpy, displayCurrency, fxUsdJpy) : "—"}
                        </td>
                      );
                    case "fees":
                      return (
                        <td key="f-fees" className="px-3 py-3 text-right font-mono text-xs font-bold text-muted-foreground whitespace-nowrap">
                          {footer.count > 0 ? formatMoneyJpyOrUsd(footer.sumFeesJpy, displayCurrency, fxUsdJpy) : "—"}
                        </td>
                      );
                    case "pnl":
                      return (
                        <td
                          key="f-pnl"
                          className={`px-3 py-3 text-right font-mono text-sm font-bold whitespace-nowrap ${pnlClass(footer.sumRealizedPnlJpy)}`}
                        >
                          {footer.count > 0 ? formatMoneyJpyOrUsd(footer.sumRealizedPnlJpy, displayCurrency, fxUsdJpy) : "—"}
                        </td>
                      );
                    case "price":
                      return (
                        <td key="f-price" className="px-3 py-3 text-right text-[10px] text-muted-foreground whitespace-nowrap">
                          {footer.minPrice != null && footer.maxPrice != null
                            ? `min–max 価格 参考`
                            : "—"}
                        </td>
                      );
                    case "post":
                      return (
                        <td
                          key="f-post"
                          className={`px-3 py-3 text-right font-mono text-xs font-bold whitespace-nowrap ${pctClass(footer.avgPostExitPct)}`}
                          title={`売却後騰落率が算出できた ${footer.postExitCount} 件の算術平均`}
                        >
                          {footer.avgPostExitPct != null ? <span>Avg {fmtPct(footer.avgPostExitPct)}</span> : "—"}
                        </td>
                      );
                    default:
                      return null;
                  }
                })}
              </tr>
              <tr className="bg-muted/30 border-t border-border/50 text-[10px] text-muted-foreground">
                {colOrder.map((cid) => {
                  const isFirstCol = colOrder[0] === cid;
                  if (cid === "name") {
                    return (
                      <td key="f2-name" className={cn("px-3 py-2", isFirstCol && stickyTdFootFirst, "min-w-[7rem] max-w-[10rem]")}>
                        最小/最大
                      </td>
                    );
                  }
                  if (cid === "pnl") {
                    return (
                      <td key="f2-pnl" className="px-3 py-2 text-right font-mono text-[10px] text-foreground/80">
                        {footer.minPnl != null && footer.maxPnl != null
                          ? `${formatMoneyJpyOrUsd(footer.minPnl, displayCurrency, fxUsdJpy)} 〜 ${formatMoneyJpyOrUsd(footer.maxPnl, displayCurrency, fxUsdJpy)}`
                          : "—"}
                      </td>
                    );
                  }
                  if (cid === "post") {
                    return (
                      <td key="f2-post" className="px-3 py-2 text-right font-mono text-[10px]">
                        {footer.minPost != null && footer.maxPost != null
                          ? `${fmtPct(footer.minPost)} 〜 ${fmtPct(footer.maxPost)}`
                          : "—"}
                      </td>
                    );
                  }
                  if (cid === "price") {
                    return (
                      <td key="f2-price" className="px-3 py-2 text-right font-mono text-[10px]">
                        {footer.minPrice != null && footer.maxPrice != null
                          ? `${formatMoneyJpyOrUsd(footer.minPrice, displayCurrency, fxUsdJpy)} 〜 ${formatMoneyJpyOrUsd(footer.maxPrice, displayCurrency, fxUsdJpy)}`
                          : "—"}
                      </td>
                    );
                  }
                  return (
                    <td key={`f2-${cid}`} className="px-3 py-2">
                      —
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
          </DndContext>
        </div>
      )}
    </div>
  );
}
