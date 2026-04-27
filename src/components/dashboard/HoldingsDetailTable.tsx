"use client";

import React, { useEffect, useMemo, useState } from "react";
import { GripVertical, TimerOff } from "lucide-react";
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

import type { Stock, TickerInstrumentKind } from "@/src/types/investment";
import { holdingSectorDisplay } from "@/src/lib/structure-tags";
import { cn } from "@/src/lib/cn";
import { stickyTdFirst, stickyTdFootFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";
import { YahooReturnChips } from "@/src/components/dashboard/YahooReturnChips";
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";
import { formatJpyValueForView, formatLocalPriceForView } from "@/src/lib/format-display-currency";
import {
  type HoldingsDetailColId,
  HOLDINGS_DETAIL_COLUMN_IDS,
  readHoldingsDetailColOrderFromStorage,
  writeHoldingsDetailColOrderToStorage,
} from "@/src/lib/holdings-detail-column-order";

function marketLabel(kind: TickerInstrumentKind): string {
  if (kind === "US_EQUITY") return "米国株";
  if (kind === "JP_LISTED_EQUITY") return "日本株";
  return "日本投信";
}

function nativeForKind(kind: TickerInstrumentKind): "USD" | "JPY" {
  return kind === "US_EQUITY" ? "USD" : "JPY";
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

function utcCalendarDaysFromToday(ymd: string | null): number | null {
  if (ymd == null || ymd.length < 10) return null;
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.round((d.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000));
}

function ShortTermRulesCell({ s }: { s: Stock }) {
  const pnlOk = s.avgAcquisitionPrice != null && s.currentPrice != null && s.currentPrice > 0;
  const pnl = pnlOk ? s.unrealizedPnlPercent : null;

  const hasBand = s.stopLossPct != null || s.targetProfitPct != null;
  const lo =
    s.stopLossPct != null
      ? -Math.abs(s.stopLossPct)
      : s.targetProfitPct != null
        ? 0
        : null;
  const hi =
    s.targetProfitPct != null
      ? Math.abs(s.targetProfitPct)
      : s.stopLossPct != null
        ? 0
        : null;

  let t = 0.5;
  if (pnl != null && lo != null && hi != null && hi > lo) {
    const raw = (pnl - lo) / (hi - lo);
    t = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.5;
  }

  const nearStop =
    s.exitRuleEnabled &&
    s.stopLossPct != null &&
    pnl != null &&
    pnl > -s.stopLossPct &&
    pnl <= -s.stopLossPct + 2;

  const daysLeft = utcCalendarDaysFromToday(s.tradeDeadline);

  if (!s.exitRuleEnabled) {
    return <span className="text-muted-foreground text-[10px]">—</span>;
  }

  return (
    <div className="flex flex-col gap-2 min-w-[7.5rem]">
      {hasBand && lo != null && hi != null && hi > lo ? (
        <div className={cn("space-y-1", nearStop && "animate-pulse")}>
          <div
            className={cn(
              "relative h-2 rounded-full bg-gradient-to-r from-accent-rose/45 via-muted to-accent-emerald/45 border border-border/60 overflow-visible",
              nearStop && "ring-1 ring-accent-rose/50",
            )}
            title={`損益レンジ ${lo.toFixed(1)}% 〜 ${hi.toFixed(1)}%（現在 ${pnl != null ? formatSignedPercent(pnl) : "—"}）`}
          >
            <div
              className="absolute top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-accent-cyan border-2 border-background shadow-sm z-10"
              style={{ left: `clamp(4px, calc(${t * 100}% - 5px), calc(100% - 14px))` }}
            />
          </div>
          <div className="flex justify-between gap-1 text-[8px] font-mono uppercase tracking-tight">
            <span className="text-accent-rose tabular-nums">{lo.toFixed(0)}%</span>
            <span className="text-accent-emerald tabular-nums">{hi.toFixed(0)}%</span>
          </div>
          {pnl != null ? (
            <span
              className={cn(
                "text-[9px] font-mono tabular-nums",
                nearStop ? "text-accent-rose font-bold" : "text-foreground/85",
              )}
            >
              現在 {formatSignedPercent(pnl)}
            </span>
          ) : (
            <span className="text-[9px] text-muted-foreground">損益率: —</span>
          )}
        </div>
      ) : (
        <span className="text-[9px] text-muted-foreground">損切・利確未設定</span>
      )}

      {s.tradeDeadline != null && s.tradeDeadline.length >= 10 ? (
        daysLeft != null && daysLeft < 0 ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent-rose">
            <TimerOff className="size-3.5 shrink-0 opacity-90" aria-hidden />
            期限切れ
          </span>
        ) : (
          <span
            className="inline-flex w-fit text-[10px] font-bold text-accent-cyan border border-border bg-background/60 px-2 py-0.5 rounded-md tabular-nums"
            title={`賞味期限 ${s.tradeDeadline}`}
          >
            残り {daysLeft != null ? `${daysLeft} 日` : "—"}
          </span>
        )
      ) : null}
    </div>
  );
}

export type HoldingsDetailSortKey =
  | "ticker"
  | "market"
  | "sector"
  | "qty"
  | "avg"
  | "price"
  | "day"
  | "mv"
  | "pnl"
  | "pnlpct"
  | "cat"
  | "research";

type HoldingsFooter = {
  count: number;
  sumQty: number;
  sumMarketValueJpy: number;
  sumUnrealizedPnlJpy: number;
  avgDayChangePercent: number | null;
  minDayChangePercent: number | null;
  maxDayChangePercent: number | null;
  portfolioUnrealizedPercent: number | null;
  pnlRowCount: number;
  hasJpTrust: boolean;
  marketBreakdown: string;
  uniqueSectorCount: number;
  sectorTopLine: string;
  researchEarningsCount: number;
  avgDividendYieldPercent: number | null;
  minDividendYieldPercent: number | null;
  maxDividendYieldPercent: number | null;
  dividendYieldRowCount: number;
  minDaysToEarnings: number | null;
  maxDaysToEarnings: number | null;
  daysToEarningsRowCount: number;
  rowsWithValidAvg: number;
  rowsWithValidPrice: number;
  minUnrealizedPnlPercent: number | null;
  maxUnrealizedPnlPercent: number | null;
  shortRuleEnabledCount: number;
  tradeDeadlineExpiredCount: number;
  coreCount: number;
  satelliteCount: number;
};

function computeFooterAggregates(stocks: Stock[]): HoldingsFooter {
  let sumQty = 0;
  let sumMarketValueJpy = 0;
  let sumUnrealizedPnlJpy = 0;
  let sumImpliedCostJpy = 0;
  const dayChanges: number[] = [];
  const marketCounts = new Map<string, number>();
  const sectorCounts = new Map<string, number>();
  let researchEarningsCount = 0;
  const divYields: number[] = [];
  const daysToEarn: number[] = [];
  let rowsWithValidAvg = 0;
  let rowsWithValidPrice = 0;
  const pnlpcts: number[] = [];
  let shortRuleEnabledCount = 0;
  let tradeDeadlineExpiredCount = 0;
  let coreCount = 0;
  let satelliteCount = 0;

  for (const s of stocks) {
    const ml = marketLabel(s.instrumentKind);
    marketCounts.set(ml, (marketCounts.get(ml) ?? 0) + 1);
    const sec = holdingSectorDisplay(s.sector, s.secondaryTag);
    sectorCounts.set(sec, (sectorCounts.get(sec) ?? 0) + 1);

    if (s.nextEarningsDate != null && s.nextEarningsDate.length > 0) researchEarningsCount++;
    if (s.dividendYieldPercent != null && Number.isFinite(s.dividendYieldPercent)) {
      divYields.push(s.dividendYieldPercent);
    }
    if (s.daysToEarnings != null && s.daysToEarnings >= 0 && Number.isFinite(s.daysToEarnings)) {
      daysToEarn.push(s.daysToEarnings);
    }
    if (s.avgAcquisitionPrice != null && s.avgAcquisitionPrice > 0) rowsWithValidAvg++;
    if (s.currentPrice != null && s.currentPrice > 0) rowsWithValidPrice++;
    if (
      s.avgAcquisitionPrice != null &&
      s.currentPrice != null &&
      s.currentPrice > 0 &&
      Number.isFinite(s.unrealizedPnlPercent)
    ) {
      pnlpcts.push(s.unrealizedPnlPercent);
    }
    if (s.exitRuleEnabled) {
      shortRuleEnabledCount++;
      if (s.tradeDeadline != null && s.tradeDeadline.length >= 10) {
        const d = utcCalendarDaysFromToday(s.tradeDeadline);
        if (d != null && d < 0) tradeDeadlineExpiredCount++;
      }
    }
    if (s.category === "Core") coreCount++;
    else if (s.category === "Satellite") satelliteCount++;

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
  const minDayChangePercent = dayChanges.length > 0 ? Math.min(...dayChanges) : null;
  const maxDayChangePercent = dayChanges.length > 0 ? Math.max(...dayChanges) : null;

  const portfolioUnrealizedPercent =
    sumImpliedCostJpy > 0 ? Math.round((sumUnrealizedPnlJpy / sumImpliedCostJpy) * 10000) / 100 : null;

  const hasJpTrust = stocks.some((s) => s.instrumentKind === "JP_INVESTMENT_TRUST");

  const marketBreakdown = [...marketCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ");

  const sectorTop = [...sectorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const sectorTopLine = sectorTop.map(([label, n]) => `${label.slice(0, 8)}${label.length > 8 ? "…" : ""} ${n}`).join(", ");

  const avgDividendYieldPercent =
    divYields.length > 0
      ? Math.round((divYields.reduce((a, b) => a + b, 0) / divYields.length) * 100) / 100
      : null;
  const minDividendYieldPercent = divYields.length > 0 ? Math.min(...divYields) : null;
  const maxDividendYieldPercent = divYields.length > 0 ? Math.max(...divYields) : null;

  const minDaysToEarnings = daysToEarn.length > 0 ? Math.min(...daysToEarn) : null;
  const maxDaysToEarnings = daysToEarn.length > 0 ? Math.max(...daysToEarn) : null;

  const minUnrealizedPnlPercent = pnlpcts.length > 0 ? Math.min(...pnlpcts) : null;
  const maxUnrealizedPnlPercent = pnlpcts.length > 0 ? Math.max(...pnlpcts) : null;

  return {
    count: stocks.length,
    sumQty,
    sumMarketValueJpy,
    sumUnrealizedPnlJpy,
    avgDayChangePercent,
    minDayChangePercent,
    maxDayChangePercent,
    portfolioUnrealizedPercent,
    pnlRowCount: stocks.filter(
      (s) => s.avgAcquisitionPrice != null && s.currentPrice != null && s.currentPrice > 0,
    ).length,
    hasJpTrust,
    marketBreakdown: marketBreakdown || "—",
    uniqueSectorCount: sectorCounts.size,
    sectorTopLine: sectorTopLine || "—",
    researchEarningsCount,
    avgDividendYieldPercent,
    minDividendYieldPercent,
    maxDividendYieldPercent,
    dividendYieldRowCount: divYields.length,
    minDaysToEarnings,
    maxDaysToEarnings,
    daysToEarningsRowCount: daysToEarn.length,
    rowsWithValidAvg,
    rowsWithValidPrice,
    minUnrealizedPnlPercent,
    maxUnrealizedPnlPercent,
    shortRuleEnabledCount,
    tradeDeadlineExpiredCount,
    coreCount,
    satelliteCount,
  };
}

const SORT_BY_COL: Partial<Record<HoldingsDetailColId, HoldingsDetailSortKey>> = {
  ticker: "ticker",
  market: "market",
  sector: "sector",
  research: "research",
  qty: "qty",
  avg: "avg",
  price: "price",
  day: "day",
  mv: "mv",
  pnl: "pnl",
  pnlpct: "pnlpct",
  cat: "cat",
};

function colHeaderLabel(id: HoldingsDetailColId, viewCurrency: "JPY" | "USD"): string {
  switch (id) {
    case "ticker":
      return "銘柄 / コード";
    case "market":
      return "市場区分";
    case "sector":
      return "セクター";
    case "research":
      return "リサーチ";
    case "qty":
      return "数量";
    case "avg":
      return "平均取得単価";
    case "price":
      return "現在価格";
    case "day":
      return "前日比";
    case "mv":
      return `評価額（${viewCurrency}）`;
    case "pnl":
      return `損益（${viewCurrency}）`;
    case "pnlpct":
      return "損益率";
    case "shortRules":
      return "短期ルール";
    case "cat":
      return "カテゴリ";
    default:
      return id;
  }
}

type SortableThProps = {
  id: HoldingsDetailColId;
  children: React.ReactNode;
  className: string;
};

function SortableTh({ id, className, children }: SortableThProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 0,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <th ref={setNodeRef} style={style as React.CSSProperties} className={className} scope="col">
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

export function HoldingsDetailTable({ stocks }: { stocks: Stock[] }) {
  const { convert, viewCurrency } = useCurrencyConverter();
  const footer = useMemo(() => computeFooterAggregates(stocks), [stocks]);
  const [colOrder, setColOrder] = useState<HoldingsDetailColId[]>(() => [...HOLDINGS_DETAIL_COLUMN_IDS]);
  const [sortKey, setSortKey] = useState<HoldingsDetailSortKey>("mv");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setColOrder(readHoldingsDetailColOrderFromStorage());
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onColDrag = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over == null || active.id === over.id) return;
    setColOrder((o) => {
      const a = o.indexOf(active.id as HoldingsDetailColId);
      const b = o.indexOf(over.id as HoldingsDetailColId);
      if (a < 0 || b < 0) return o;
      const n = arrayMove(o, a, b);
      writeHoldingsDetailColOrderToStorage(n);
      return n;
    });
  };

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

  function toggleSort(next: HoldingsDetailSortKey) {
    if (next === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(next);
      setSortDir("desc");
    }
  }

  function sortMark(k: HoldingsDetailSortKey) {
    if (k !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function renderBodyCell(s: Stock, cid: HoldingsDetailColId, isFirstCol: boolean) {
    const sCls = (extra: string) =>
      cn("px-4 py-3", extra, isFirstCol && stickyTdFirst, cid === "ticker" && "whitespace-nowrap min-w-[10rem] max-w-[12rem]");

    switch (cid) {
      case "ticker":
        return (
          <td key={cid} className={sCls("")}>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground max-w-[11rem] truncate" title={s.name || s.ticker}>
                  {s.name || s.ticker}
                </span>
                <span
                  className={cn(
                    "text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0",
                    (s.accountType ?? "特定") === "NISA"
                      ? "text-emerald-600 border-emerald-500/40 bg-emerald-500/10"
                      : "text-muted-foreground border-border bg-background/60",
                  )}
                  title="口座区分（holdings.account_type）"
                >
                  {s.accountType ?? "特定"}
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">{s.ticker}</span>
            </div>
          </td>
        );
      case "market":
        return (
          <td key={cid} className={sCls("text-muted-foreground text-xs whitespace-nowrap")}>
            {marketLabel(s.instrumentKind)}
          </td>
        );
      case "sector":
        return (
          <td
            key={cid}
            className={sCls("text-muted-foreground text-xs max-w-[140px] truncate")}
            title={
              s.sector != null && s.sector.trim().length > 0 && s.sector.trim() !== s.secondaryTag
                ? `DB: ${s.sector.trim()} / タグ2: ${s.secondaryTag}`
                : holdingSectorDisplay(s.sector, s.secondaryTag)
            }
          >
            {holdingSectorDisplay(s.sector, s.secondaryTag)}
          </td>
        );
      case "research":
        return (
          <td key={cid} className={sCls("text-xs whitespace-nowrap align-top")}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-muted-foreground border border-border bg-background/60 px-2 py-0.5 rounded-md">
                  {s.countryName}
                </span>
                {s.nextEarningsDate ? (
                  <span
                    className="text-[10px] font-bold text-foreground/90 border border-border bg-card/60 px-2 py-0.5 rounded-md"
                    title={`次期決算予定日: ${s.nextEarningsDate}`}
                  >
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
              <YahooReturnChips
                consecutiveDividendYears={s.consecutiveDividendYears}
                ttmRepurchaseOfStock={s.ttmRepurchaseOfStock}
                yahooBuybackPosture={s.yahooBuybackPosture}
                yahooQuoteSharesOutstanding={s.yahooQuoteSharesOutstanding}
                yahooInsiderNetPurchaseShares={s.yahooInsiderNetPurchaseShares}
                className="flex flex-wrap gap-1"
              />
            </div>
          </td>
        );
      case "qty":
        return (
          <td key={cid} className={sCls("text-right font-mono text-foreground/85 whitespace-nowrap")}>
            {s.quantity}
          </td>
        );
      case "avg":
        return (
          <td key={cid} className={sCls("text-right font-mono text-foreground/85 whitespace-nowrap")}>
            {s.avgAcquisitionPrice != null && s.avgAcquisitionPrice > 0
              ? formatLocalPriceForView(s.avgAcquisitionPrice, nativeForKind(s.instrumentKind), viewCurrency, convert)
              : "—"}
          </td>
        );
      case "price":
        return (
          <td key={cid} className={sCls("text-right font-mono text-foreground/85 whitespace-nowrap")}>
            {s.currentPrice != null && s.currentPrice > 0
              ? formatLocalPriceForView(s.currentPrice, nativeForKind(s.instrumentKind), viewCurrency, convert)
              : "—"}
          </td>
        );
      case "day":
        return (
          <td
            key={cid}
            className={sCls(`text-right font-mono font-medium whitespace-nowrap ${signedPctClass(s.dayChangePercent)}`)}
          >
            {formatSignedPercent(s.dayChangePercent)}
          </td>
        );
      case "mv":
        return (
          <td key={cid} className={sCls("text-right font-mono text-foreground/85 whitespace-nowrap")}>
            {s.marketValue > 0 ? formatJpyValueForView(s.marketValue, viewCurrency, convert) : "—"}
          </td>
        );
      case "pnl":
        return (
          <td
            key={cid}
            className={sCls(`text-right font-mono font-medium whitespace-nowrap ${signedValueClass(s.unrealizedPnlJpy)}`)}
          >
            {s.avgAcquisitionPrice != null && s.currentPrice != null && s.currentPrice > 0
              ? `${s.unrealizedPnlJpy > 0 ? "+" : s.unrealizedPnlJpy < 0 ? "−" : ""}${formatJpyValueForView(Math.abs(s.unrealizedPnlJpy), viewCurrency, convert)}`
              : "—"}
          </td>
        );
      case "pnlpct":
        return (
          <td
            key={cid}
            className={sCls(`text-right font-mono font-medium whitespace-nowrap ${signedPctClass(s.unrealizedPnlPercent)}`)}
          >
            {s.avgAcquisitionPrice != null && s.currentPrice != null && s.currentPrice > 0
              ? formatSignedPercent(s.unrealizedPnlPercent)
              : "—"}
          </td>
        );
      case "shortRules":
        return (
          <td key={cid} className={sCls("align-top")}>
            <ShortTermRulesCell s={s} />
          </td>
        );
      case "cat":
        return (
          <td key={cid} className={sCls("text-xs font-semibold text-muted-foreground whitespace-nowrap")}>
            {s.category}
          </td>
        );
      default:
        return null;
    }
  }

  function renderFooterCell(cid: HoldingsDetailColId, isFirstCol: boolean) {
    const fCls = (extra: string) =>
      cn("px-4 py-3", extra, isFirstCol && stickyTdFootFirst, cid === "ticker" && "text-xs font-bold text-foreground/90 min-w-[10rem] max-w-[12rem]");

    switch (cid) {
      case "ticker":
        return (
          <td key="f-ticker" className={fCls("")}>
            Σ / 平均
            <span className="block text-[10px] font-normal text-muted-foreground font-mono">{footer.count} 銘柄</span>
          </td>
        );
      case "market":
        return (
          <td key="f-market" className={fCls("text-[10px] text-muted-foreground leading-snug max-w-[12rem]")} title={footer.marketBreakdown}>
            <span className="line-clamp-3">{footer.marketBreakdown}</span>
          </td>
        );
      case "sector":
        return (
          <td key="f-sector" className={fCls("text-[10px] text-muted-foreground leading-snug max-w-[10rem]")}>
            <span className="font-mono text-foreground/90">{footer.uniqueSectorCount}</span> 種
            {footer.sectorTopLine !== "—" ? (
              <span className="block text-[9px] font-normal mt-0.5 line-clamp-2" title={footer.sectorTopLine}>
                {footer.sectorTopLine}
              </span>
            ) : null}
          </td>
        );
      case "research":
        return (
          <td key="f-research" className={fCls("text-[10px] text-muted-foreground align-top whitespace-nowrap")}>
            <div className="flex flex-col gap-0.5">
              <span title="次期決算日が入っている銘柄数">
                E 予定 <span className="font-mono text-foreground/90">{footer.researchEarningsCount}</span>
              </span>
              {footer.daysToEarningsRowCount > 0 ? (
                <span className="font-mono text-foreground/85" title="D 日数（≥0）の範囲">
                  D {footer.minDaysToEarnings}〜{footer.maxDaysToEarnings}
                </span>
              ) : (
                <span>D —</span>
              )}
              {footer.dividendYieldRowCount > 0 ? (
                <span title={`利回り ${footer.dividendYieldRowCount} 銘柄`}>
                  Div Avg{" "}
                  <span className={cn("font-mono", signedPctClass(footer.avgDividendYieldPercent))}>
                    {formatSignedPercent(footer.avgDividendYieldPercent)}
                  </span>
                </span>
              ) : (
                <span>Div —</span>
              )}
            </div>
          </td>
        );
      case "qty":
        return (
          <td
            key="f-qty"
            className={fCls("text-right whitespace-nowrap")}
            title="米国株・日本株の株数合計。投信（口・FANG+ 等）は単位が異なるため含みません。"
          >
            <span className="font-mono text-sm font-bold text-foreground">{footer.sumQty > 0 ? footer.sumQty : "—"}</span>
            {footer.hasJpTrust ? (
              <span className="block text-[9px] font-normal text-muted-foreground leading-tight mt-0.5 text-left">
                株のみ（投信の口は除外）
              </span>
            ) : null}
          </td>
        );
      case "avg":
        return (
          <td key="f-avg" className={fCls("text-right text-[10px] text-muted-foreground whitespace-nowrap")} title="通貨・銘柄が混在するため合計は出しません">
            単価あり <span className="font-mono text-foreground/90">{footer.rowsWithValidAvg}</span>
          </td>
        );
      case "price":
        return (
          <td key="f-price" className={fCls("text-right text-[10px] text-muted-foreground whitespace-nowrap")}>
            終値あり <span className="font-mono text-foreground/90">{footer.rowsWithValidPrice}</span>
          </td>
        );
      case "day":
        return (
          <td
            key="f-day"
            className={fCls(`text-right font-mono text-xs font-bold whitespace-nowrap ${signedPctClass(footer.avgDayChangePercent)}`)}
          >
            {footer.avgDayChangePercent != null ? (
              <span title="前日比が取れた銘柄の算術平均">Avg {formatSignedPercent(footer.avgDayChangePercent)}</span>
            ) : (
              "—"
            )}
          </td>
        );
      case "mv":
        return (
          <td key="f-mv" className={fCls("text-right font-mono text-sm font-bold text-foreground whitespace-nowrap")}>
            {footer.sumMarketValueJpy > 0 ? formatJpyValueForView(footer.sumMarketValueJpy, viewCurrency, convert) : "—"}
          </td>
        );
      case "pnl":
        return (
          <td
            key="f-pnl"
            className={fCls(`text-right font-mono text-sm font-bold whitespace-nowrap ${signedValueClass(footer.sumUnrealizedPnlJpy)}`)}
          >
            {footer.pnlRowCount > 0 ? (
              <>
                {footer.sumUnrealizedPnlJpy > 0 ? "+" : footer.sumUnrealizedPnlJpy < 0 ? "−" : ""}
                {formatJpyValueForView(Math.abs(footer.sumUnrealizedPnlJpy), viewCurrency, convert)}
              </>
            ) : (
              "—"
            )}
          </td>
        );
      case "pnlpct":
        return (
          <td
            key="f-pnlpct"
            className={fCls(`text-right font-mono text-xs font-bold whitespace-nowrap ${signedPctClass(footer.portfolioUnrealizedPercent)}`)}
          >
            {footer.portfolioUnrealizedPercent != null ? (
              <span title="Σ損益(円) ÷ Σ取得相当(円)（評価額−損益）">{formatSignedPercent(footer.portfolioUnrealizedPercent)}</span>
            ) : (
              "—"
            )}
          </td>
        );
      case "shortRules":
        return (
          <td key="f-short" className={fCls("text-[10px] text-muted-foreground leading-snug whitespace-nowrap")}>
            <span title="exit_rule_enabled">ON {footer.shortRuleEnabledCount}</span>
            {footer.tradeDeadlineExpiredCount > 0 ? (
              <span className="block text-accent-rose font-bold mt-0.5">期限切れ {footer.tradeDeadlineExpiredCount}</span>
            ) : (
              <span className="block mt-0.5">期限切れ 0</span>
            )}
          </td>
        );
      case "cat":
        return (
          <td key="f-cat" className={fCls("text-[10px] text-muted-foreground whitespace-nowrap")}>
            <span className="text-foreground/90 font-mono">Core {footer.coreCount}</span>
            <span className="mx-1">·</span>
            <span className="text-foreground/90 font-mono">Sat {footer.satelliteCount}</span>
          </td>
        );
      default:
        return null;
    }
  }

  function renderFooterSecondRow(cid: HoldingsDetailColId, isFirstCol: boolean) {
    const f2 = (extra: string) => cn("px-4 py-2", extra, isFirstCol && stickyTdFootFirst, "text-[10px] text-muted-foreground");
    switch (cid) {
      case "ticker":
        return (
          <td key="f2-ticker" className={f2("min-w-[10rem] max-w-[12rem]")}>
            最小 / 最大
          </td>
        );
      case "day":
        return (
          <td key="f2-day" className={f2("text-right font-mono text-[10px]")}>
            {footer.minDayChangePercent != null && footer.maxDayChangePercent != null
              ? `${formatSignedPercent(footer.minDayChangePercent)} 〜 ${formatSignedPercent(footer.maxDayChangePercent)}`
              : "—"}
          </td>
        );
      case "pnlpct":
        return (
          <td key="f2-pnlpct" className={f2("text-right font-mono text-[10px]")}>
            {footer.minUnrealizedPnlPercent != null && footer.maxUnrealizedPnlPercent != null
              ? `${formatSignedPercent(footer.minUnrealizedPnlPercent)} 〜 ${formatSignedPercent(footer.maxUnrealizedPnlPercent)}`
              : "—"}
          </td>
        );
      case "research":
        return (
          <td key="f2-research" className={f2("text-right font-mono whitespace-nowrap")}>
            {footer.minDividendYieldPercent != null && footer.maxDividendYieldPercent != null
              ? `Div ${footer.minDividendYieldPercent.toFixed(2)}〜${footer.maxDividendYieldPercent.toFixed(2)}%`
              : "—"}
          </td>
        );
      default:
        return (
          <td key={`f2-${cid}`} className={f2("")}>
            —
          </td>
        );
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-border bg-card/60">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Portfolio accounting</h3>
        <p className="text-[10px] text-muted-foreground mt-1">
          含み損益・損益率は平均取得単価と Yahoo 日足ベースの最新終値から算出。米株の円換算はダッシュボード取得の USD/JPY（JPY=X、失敗時フォールバック）を使用。
        </p>
        {stocks.length > 0 ? (
          <p className="text-[10px] text-muted-foreground/90 mt-1.5">
            各列見出し左のグリップをドラッグして列順を変更。列順はブラウザに保存されます。表下のフッターに列ごとの集計と min/max（該当列）を表示します。
          </p>
        ) : null}
      </div>

      <div className="relative overflow-x-auto overscroll-x-contain touch-auto [-webkit-overflow-scrolling:touch]">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onColDrag}>
          <table className="w-full text-left text-sm min-w-[1280px]">
            <thead className="bg-background text-muted-foreground text-[10px] uppercase font-bold tracking-[0.08em]">
              <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
                <tr>
                  {colOrder.map((cid, idx) => {
                    const sk = SORT_BY_COL[cid];
                    const alignR =
                      cid === "qty" ||
                      cid === "avg" ||
                      cid === "price" ||
                      cid === "day" ||
                      cid === "mv" ||
                      cid === "pnl" ||
                      cid === "pnlpct";
                    const thCls = cn(
                      "px-4 py-3 whitespace-nowrap select-none",
                      alignR ? "text-right" : "",
                      idx === 0 && stickyThFirst,
                      cid === "ticker" && "min-w-[10rem] max-w-[12rem]",
                    );
                    const label = colHeaderLabel(cid, viewCurrency);
                    return (
                      <SortableTh key={cid} id={cid} className={thCls}>
                        {sk ? (
                          <button
                            type="button"
                            className={cn("w-full min-w-0", alignR ? "text-right cursor-pointer" : "text-left cursor-pointer")}
                            onClick={() => toggleSort(sk)}
                            title="Sort"
                          >
                            <span className="break-words">{label}</span>
                            {sortMark(sk)}
                          </button>
                        ) : (
                          <span className={cn("text-left", alignR && "text-right block")}>{label}</span>
                        )}
                      </SortableTh>
                    );
                  })}
                </tr>
              </SortableContext>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sorted.map((s) => (
                <tr key={s.id} className="group hover:bg-muted/60 transition-colors">
                  {colOrder.map((cid) => {
                    const isFirstCol = colOrder[0] === cid;
                    return renderBodyCell(s, cid, isFirstCol);
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="group bg-card/95 border-t border-border">
                {colOrder.map((cid) => renderFooterCell(cid, colOrder[0] === cid))}
              </tr>
              <tr className="bg-muted/30 border-t border-border/50">
                {colOrder.map((cid) => renderFooterSecondRow(cid, colOrder[0] === cid))}
              </tr>
            </tfoot>
          </table>
        </DndContext>
      </div>
    </div>
  );
}
