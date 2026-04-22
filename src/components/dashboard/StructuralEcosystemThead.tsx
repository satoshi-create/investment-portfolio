"use client";

import React from "react";

import { SortableEcoWatchlistTh } from "@/src/components/dashboard/SortableEcoWatchlistTh";
import { stickyThFirst } from "@/src/components/dashboard/table-sticky";
import type { EcosystemWatchlistColId } from "@/src/lib/ecosystem-watchlist-column-order";

export type StructuralEcoSortKey =
  | "asset"
  | "research"
  | "earnings"
  | "listing"
  | "mktCap"
  | "perfListed"
  | "trend5d"
  | "pe"
  | "peg"
  | "eps"
  | "alpha"
  | "cumTrend"
  | "price"
  | "deviation"
  | "drawdown"
  | "ruleOf40"
  | "fcfYield"
  | "judgment"
  | "dividend";

function EcoSortTh({
  id,
  align,
  className,
  title,
  label,
  toggleEcoSort,
  ecoSortMark,
  sortKey,
}: {
  id: EcosystemWatchlistColId;
  align: "left" | "right" | "center";
  className: string;
  title?: string;
  label: React.ReactNode;
  toggleEcoSort: (next: StructuralEcoSortKey) => void;
  ecoSortMark: (k: StructuralEcoSortKey) => string;
  sortKey: StructuralEcoSortKey;
}) {
  const btnCls =
    align === "right"
      ? "bg-transparent p-0 text-right font-[inherit] text-inherit"
      : align === "center"
        ? "bg-transparent p-0 font-[inherit] text-inherit"
        : "bg-transparent p-0 text-left font-[inherit] text-inherit";
  return (
    <SortableEcoWatchlistTh id={id} align={align} className={className} title={title}>
      <button type="button" className={btnCls} onClick={() => toggleEcoSort(sortKey)}>
        {label}
        {ecoSortMark(sortKey)}
      </button>
    </SortableEcoWatchlistTh>
  );
}

export function StructuralEcosystemThead({
  ecoVisibleColumnIds,
  toggleEcoSort,
  ecoSortMark,
}: {
  ecoVisibleColumnIds: EcosystemWatchlistColId[];
  toggleEcoSort: (next: StructuralEcoSortKey) => void;
  ecoSortMark: (k: StructuralEcoSortKey) => string;
}) {
  return (
    <thead className="sticky top-0 z-20 bg-muted/90 text-muted-foreground text-[10px] uppercase font-bold tracking-[0.1em] backdrop-blur-md supports-[backdrop-filter]:bg-muted/75 border-b border-border shadow-sm">
      <tr>
        {ecoVisibleColumnIds.map((colId, idx) => {
          const sfirst = idx === 0 ? stickyThFirst : "";
          switch (colId) {
            case "asset":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="asset"
                  align="left"
                  className={`px-6 py-4 min-w-[10rem] max-w-[14rem] ${sfirst} cursor-pointer select-none`}
                  title="Sort"
                  label="Asset"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "trend5d":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="trend5d"
                  align="center"
                  className={`px-4 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  title="直近5観測の日次 Alpha（ミニチャート）"
                  label="5D"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "listing":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="listing"
                  align="center"
                  className={`px-3 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  title="初回取引日の年で並べ替え（DB / Yahoo の first trade 近似。IPO 年とは限らない）"
                  label="初取引"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "mktCap":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="mktCap"
                  align="right"
                  className={`px-4 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  title="時価総額（参照: Yahoo Finance・取得／同期時点の値）"
                  label="MCAP"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "perfListed":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="perfListed"
                  align="right"
                  className={`px-4 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  title="長期変動率（%）: 日足の系列上・最古日〜最新日（調整後終値が揃えば adj のペア）。IPO 公式リターンではありません。取得不能時のみ 現在価÷listing_price"
                  label="長期%"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "earnings":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="earnings"
                  align="center"
                  className={`px-4 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  label="決算まで"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "holder":
              return (
                <SortableEcoWatchlistTh key={colId} id={colId} align="left" className={`px-6 py-4 whitespace-nowrap ${sfirst}`}>
                  <span className="pointer-events-none">Holder</span>
                </SortableEcoWatchlistTh>
              );
            case "dividend":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="dividend"
                  align="left"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  title="権利落ちまでの日数が近い順（未取得は末尾）。2回目クリックで昇順/降順切替"
                  label="Dividend"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "defensiveRole":
              return (
                <SortableEcoWatchlistTh key={colId} id={colId} align="left" className={`px-6 py-4 whitespace-nowrap ${sfirst}`}>
                  <span className="pointer-events-none">Defensive role</span>
                </SortableEcoWatchlistTh>
              );
            case "research":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="research"
                  align="left"
                  className={`px-6 py-4 cursor-pointer select-none ${sfirst}`}
                  title="決算までの日数 → 配当落ちまでの日数 → 配当利回りで並べ替え"
                  label="Research"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "role":
              return (
                <SortableEcoWatchlistTh key={colId} id={colId} align="left" className={`px-6 py-4 whitespace-nowrap ${sfirst}`}>
                  <span className="pointer-events-none">江戸的役割</span>
                </SortableEcoWatchlistTh>
              );
            case "ruleOf40":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="ruleOf40"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  title="Rule of 40（売上成長率% + FCFマージン%）"
                  label="Rule of 40"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "fcfYield":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="fcfYield"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  title="FCF Yield（%）"
                  label="FCF Yield"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "judgment":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="judgment"
                  align="center"
                  className={`px-4 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  title="投資優先度"
                  label="判定"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "deviation":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="deviation"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  title="日次 Alpha 乖離（σ）"
                  label="乖離"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "drawdown":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="drawdown"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  title="90 日高値比"
                  label="落率"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "pe":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="pe"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  title="Sort"
                  label="PE"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "peg":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="peg"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  title="PER÷成長率（小さいほど割安）"
                  label="PEG"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "eps":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="eps"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  title="Sort"
                  label="EPS"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "alpha":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="alpha"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none ${sfirst}`}
                  title="Sort"
                  label="Cum. α"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "cumTrend":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="cumTrend"
                  align="center"
                  className={`px-6 py-4 cursor-pointer select-none ${sfirst}`}
                  title="Sort"
                  label="Cumulative trend"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "price":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="price"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none ${sfirst}`}
                  title="Sort"
                  label="Last"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            default: {
              const _exhaustive: never = colId;
              return _exhaustive;
            }
          }
        })}
      </tr>
    </thead>
  );
}
