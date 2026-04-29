"use client";

import React from "react";

import { MetricHeaderHelp } from "@/src/components/dashboard/MetricHeaderHelp";
import { SortableEcoWatchlistTh } from "@/src/components/dashboard/SortableEcoWatchlistTh";
import { stickyThFirst } from "@/src/components/dashboard/table-sticky";
import type { EcosystemWatchlistColId } from "@/src/lib/ecosystem-watchlist-column-order";
import { ECOSYSTEM_ASSET_COL_WIDTH_CLASS } from "@/src/lib/ecosystem-watchlist-table-layout";
import { METRIC_HEADER_TIP } from "@/src/lib/metric-header-tooltips";
import { cn } from "@/src/lib/cn";

export type StructuralEcoSortKey =
  | "asset"
  | "lynch"
  | "research"
  | "earnings"
  | "listing"
  | "mktCap"
  | "perfListed"
  | "trend5d"
  | "pe"
  | "pbr"
  | "peg"
  | "trr"
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
  | "netCash"
  | "netCashYield"
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
  disableColumnReorder,
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
  disableColumnReorder?: boolean;
}) {
  const sortOnlyBtnCls =
    align === "right"
      ? "bg-transparent p-0 min-w-0 text-right font-[inherit] text-inherit"
      : align === "center"
        ? "bg-transparent p-0 min-w-0 text-center font-[inherit] text-inherit"
        : "bg-transparent p-0 min-w-0 text-left font-[inherit] text-inherit";
  const sortBtnClsNoHelp =
    align === "right"
      ? "inline-flex max-w-full min-w-0 items-start text-right font-[inherit] text-inherit"
      : align === "center"
        ? "inline-flex max-w-full min-w-0 items-center justify-center text-center font-[inherit] text-inherit"
        : "inline-flex max-w-full min-w-0 items-center text-left font-[inherit] text-inherit";
  return (
    <SortableEcoWatchlistTh
      id={id}
      align={align}
      className={className}
      title={metricHelpText ? undefined : title}
      disableColumnReorder={disableColumnReorder}
    >
      {metricHelpText ? (
        <div
          className={cn(
            "flex w-full min-w-0 gap-0.5",
            align === "right" && "items-start justify-end text-right",
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
          <MetricHeaderHelp
            text={metricHelpText}
            className={cn("shrink-0", align === "center" ? "mt-0" : "mt-0.5")}
          />
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
  disableColumnReorder = false,
}: {
  ecoVisibleColumnIds: EcosystemWatchlistColId[];
  toggleEcoSort: (next: StructuralEcoSortKey) => void;
  ecoSortMark: (k: StructuralEcoSortKey) => string;
  /** リンチレンズ中は列 DnD 無効 */
  disableColumnReorder?: boolean;
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
                  className={`px-6 py-4 ${ECOSYSTEM_ASSET_COL_WIDTH_CLASS} ${sfirst} cursor-pointer select-none`}
                  metricHelpText={METRIC_HEADER_TIP.asset}
                  label="Asset"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                  disableColumnReorder={disableColumnReorder}
                />
              );
            case "lynch":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="lynch"
                  align="center"
                  className={`align-middle px-3 py-4 min-w-[7.5rem] max-w-[10rem] cursor-pointer select-none text-center ${sfirst}`}
                  metricHelpText={METRIC_HEADER_TIP.lynch}
                  label="リンチ"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
                />
              );
            case "netCash":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="netCash"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  metricHelpText={METRIC_HEADER_TIP.netCash}
                  label="ネットC"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                  disableColumnReorder={disableColumnReorder}
                />
              );
            case "netCashYield":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="netCashYield"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  metricHelpText={METRIC_HEADER_TIP.netCashYield}
                  label="NC/MCAP"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
                />
              );
            case "pbr":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="pbr"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  metricHelpText={METRIC_HEADER_TIP.pbr}
                  label="PBR"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
                />
              );
            case "trr":
              return (
                <EcoSortTh
                  key={colId}
                  id={colId}
                  sortKey="trr"
                  align="right"
                  className={`px-6 py-4 cursor-pointer select-none whitespace-nowrap ${sfirst}`}
                  metricHelpText={METRIC_HEADER_TIP.trr}
                  label="TRR"
                  toggleEcoSort={toggleEcoSort}
                  ecoSortMark={ecoSortMark}
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
                  disableColumnReorder={disableColumnReorder}
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
