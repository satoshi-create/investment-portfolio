"use client";

import React from "react";

import { MetricHeaderHelp } from "@/src/components/dashboard/MetricHeaderHelp";
import { SortableEcoWatchlistTh } from "@/src/components/dashboard/SortableEcoWatchlistTh";
import { stickyThFirst } from "@/src/components/dashboard/table-sticky";
import type { EcosystemWatchlistColId } from "@/src/lib/ecosystem-watchlist-column-order";
import { METRIC_HEADER_TIP } from "@/src/lib/metric-header-tooltips";
import { cn } from "@/src/lib/cn";

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
  | "egrowth"
  | "eps"
  | "alpha"
  | "cumTrend"
  | "volRatio"
  | "price"
  | "deviation"
  | "drawdown"
  | "ruleOf40"
  | "fcfYield"
  | "judgment"
  | "viScore"
  | "dividend"
  | "payout";

function EcoSortTh({
  id,
  align,
  className,
  title,
  metricHelpText,
  label,
  toggleEcoSort,
  ecoSortMark,
  sortKey,
}: {
  id: EcosystemWatchlistColId;
  align: "left" | "right" | "center";
  className: string;
  title?: string;
  metricHelpText?: string;
  label: React.ReactNode;
  toggleEcoSort: (next: StructuralEcoSortKey) => void;
  ecoSortMark: (k: StructuralEcoSortKey) => string;
  sortKey: StructuralEcoSortKey;
}) {
  const sortOnlyBtnCls =
    align === "right"
      ? "bg-transparent p-0 min-w-0 text-right font-[inherit] text-inherit"
      : align === "center"
        ? "bg-transparent p-0 min-w-0 font-[inherit] text-inherit"
        : "bg-transparent p-0 min-w-0 text-left font-[inherit] text-inherit";
  const sortBtnClsNoHelp =
    align === "right"
      ? "inline-flex max-w-full min-w-0 items-start text-right font-[inherit] text-inherit"
      : align === "center"
        ? "inline-flex max-w-full min-w-0 items-center font-[inherit] text-inherit"
        : "inline-flex max-w-full min-w-0 items-center text-left font-[inherit] text-inherit";
  return (
    <SortableEcoWatchlistTh id={id} align={align} className={className} title={metricHelpText ? undefined : title}>
      {metricHelpText ? (
        <div
          className={cn(
            "flex w-full min-w-0 items-start gap-0.5",
            align === "right" && "justify-end text-right",
            align === "center" && "items-center justify-center text-center",
            align === "left" && "items-center text-left",
          )}
        >
          <button type="button" className={sortOnlyBtnCls} onClick={() => toggleEcoSort(sortKey)}>
            <span className="min-w-0 [word-break:break-word]">
              {label}
              {ecoSortMark(sortKey)}
            </span>
          </button>
          <MetricHeaderHelp text={metricHelpText} className="shrink-0 mt-0.5" />
        </div>
      ) : (
        <button type="button" className={sortBtnClsNoHelp} onClick={() => toggleEcoSort(sortKey)}>
          <span className="min-w-0 [word-break:break-word]">
            {label}
            {ecoSortMark(sortKey)}
          </span>
        </button>
      )}
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
                  metricHelpText={METRIC_HEADER_TIP.asset}
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
                  metricHelpText={METRIC_HEADER_TIP.fiveDay}
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
                  metricHelpText={METRIC_HEADER_TIP.listing}
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
                  metricHelpText={METRIC_HEADER_TIP.mktCap}
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
                  metricHelpText={METRIC_HEADER_TIP.perfListed}
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
                  metricHelpText={METRIC_HEADER_TIP.earnings}
                  label="決算まで"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "holder":
              return (
                <SortableEcoWatchlistTh
                  key={colId}
                  id={colId}
                  align="left"
                  className={`px-6 py-4 whitespace-nowrap ${sfirst}`}
                  metricHelpText={METRIC_HEADER_TIP.holder}
                >
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
                  metricHelpText={METRIC_HEADER_TIP.dividend}
                  label="Dividend"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "payout":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="payout"
                  align="right"
                  className={`px-4 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  metricHelpText={METRIC_HEADER_TIP.payout}
                  label="性向"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "defensiveRole":
              return (
                <SortableEcoWatchlistTh
                  key={colId}
                  id={colId}
                  align="left"
                  className={`px-6 py-4 whitespace-nowrap ${sfirst}`}
                  metricHelpText={METRIC_HEADER_TIP.defensiveRole}
                >
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
                  metricHelpText={METRIC_HEADER_TIP.research}
                  label="Research"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "role":
              return (
                <SortableEcoWatchlistTh
                  key={colId}
                  id={colId}
                  align="left"
                  className={`px-6 py-4 whitespace-nowrap ${sfirst}`}
                  metricHelpText={METRIC_HEADER_TIP.role}
                >
                  <span className="pointer-events-none">江戸的役割</span>
                </SortableEcoWatchlistTh>
              );
            case "viScore":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="viScore"
                  align="center"
                  className={`px-3 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  metricHelpText={METRIC_HEADER_TIP.viScore}
                  label="VI"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "ruleOf40":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="ruleOf40"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  metricHelpText={METRIC_HEADER_TIP.ruleOf40}
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
                  metricHelpText={METRIC_HEADER_TIP.fcfYield}
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
                  metricHelpText={METRIC_HEADER_TIP.judgment}
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
                  metricHelpText={METRIC_HEADER_TIP.alphaDeviationZ}
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
                  metricHelpText={METRIC_HEADER_TIP.drawdown}
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
                  metricHelpText={METRIC_HEADER_TIP.pe}
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
                  metricHelpText={METRIC_HEADER_TIP.peg}
                  label="PEG"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "egrowth":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="egrowth"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  metricHelpText={METRIC_HEADER_TIP.egrowth}
                  label="成長%"
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
                  metricHelpText={METRIC_HEADER_TIP.eps}
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
                  metricHelpText={METRIC_HEADER_TIP.alphaCumulative}
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
                  metricHelpText={METRIC_HEADER_TIP.cumTrend}
                  label="Cumulative trend"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                />
              );
            case "volRatio":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="volRatio"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  metricHelpText={METRIC_HEADER_TIP.volumeRatio}
                  label="Vol 比"
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
                  metricHelpText={METRIC_HEADER_TIP.priceLast}
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
