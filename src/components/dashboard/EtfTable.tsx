"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";

import { stickyTdFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";

export type EtfRegionGroup = "GLOBAL_DEVELOPED" | "EMERGING_FRONTIER" | "THEMATIC_STRATA";

export type EtfRow = {
  ticker: string;
  name: string;
  regionGroup: EtfRegionGroup;
  geographyLabel: string;
  geographyCode: string | null;
  underlyingStructure: string;
  currency: "USD" | "JPY";
  latestDailyAlpha: number | null;
  dailyAlphaZ: number | null;
  cumulativeAlpha90d: number | null;
  trackingAlphaScore: number;
  expenseDrag5y: number;
  phaseShift: boolean;
  phaseShiftDirection: "UP" | "DOWN" | null;
  spilloverHoldings: { ticker: string; name: string; reason: string }[];
};

export type RegionMomentumRow = { region: string; cumulativeAlpha: number; gravityWeight: number };

type SortKey =
  | "asset"
  | "region"
  | "tracking"
  | "alpha90d"
  | "latestAlpha"
  | "z"
  | "expense"
  | "phase";

function regionLabelJa(region: EtfRegionGroup): string {
  if (region === "GLOBAL_DEVELOPED") return "Global / Developed";
  if (region === "EMERGING_FRONTIER") return "Emerging / Frontier";
  return "Thematic Strata";
}

function fmtPct(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(digits)}%`;
}

function fmtZ(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(2)}σ`;
}

function geoBadge(code: string | null, label: string) {
  const text = (code ?? label).trim();
  const short = text.length > 6 ? text.slice(0, 6) : text;
  return (
    <span
      className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-foreground/90 border border-border bg-background/60 px-2 py-0.5 rounded-md"
      title={label}
    >
      <span className="h-2.5 w-2.5 rounded-full bg-accent-cyan/60 shadow-[0_0_10px_rgba(34,211,238,0.25)]" aria-hidden />
      <span className="font-mono">{short}</span>
    </span>
  );
}

export function EtfTable({
  etfs,
  fxUsdJpy,
  regionFilter,
}: {
  etfs: EtfRow[];
  fxUsdJpy: number | null;
  regionFilter: "ALL" | EtfRegionGroup;
}) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("alpha90d");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = etfs;
    if (regionFilter !== "ALL") list = list.filter((e) => e.regionGroup === regionFilter);
    if (query.length === 0) return list;
    return list.filter((e) => {
      const hay = [
        e.ticker,
        e.name,
        e.geographyLabel,
        e.underlyingStructure,
        regionLabelJa(e.regionGroup),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [etfs, q, regionFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const cmpStr = (a: string, b: string) => a.localeCompare(b, "ja");
    const cmpNum = (a: number | null, b: number | null) => {
      const ax = a == null || !Number.isFinite(a) ? null : a;
      const by = b == null || !Number.isFinite(b) ? null : b;
      if (ax == null && by == null) return 0;
      if (ax == null) return 1;
      if (by == null) return -1;
      return ax < by ? -1 : ax > by ? 1 : 0;
    };
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortKey === "asset") return dir * cmpStr(a.ticker, b.ticker);
      if (sortKey === "region") return dir * cmpStr(regionLabelJa(a.regionGroup), regionLabelJa(b.regionGroup));
      if (sortKey === "tracking") return dir * cmpNum(a.trackingAlphaScore, b.trackingAlphaScore);
      if (sortKey === "alpha90d") return dir * cmpNum(a.cumulativeAlpha90d, b.cumulativeAlpha90d);
      if (sortKey === "latestAlpha") return dir * cmpNum(a.latestDailyAlpha, b.latestDailyAlpha);
      if (sortKey === "z") return dir * cmpNum(a.dailyAlphaZ, b.dailyAlphaZ);
      if (sortKey === "expense") return dir * cmpNum(a.expenseDrag5y, b.expenseDrag5y);
      // phase: show phase shift first, then z-score magnitude.
      const pA = a.phaseShift ? 1 : 0;
      const pB = b.phaseShift ? 1 : 0;
      if (pA !== pB) return dir * (pA < pB ? -1 : 1);
      const zA = a.dailyAlphaZ != null ? Math.abs(a.dailyAlphaZ) : null;
      const zB = b.dailyAlphaZ != null ? Math.abs(b.dailyAlphaZ) : null;
      return dir * cmpNum(zA, zB);
    });
    return arr;
  }, [filtered, sortDir, sortKey]);

  function toggleSort(nextKey: SortKey) {
    if (nextKey === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(nextKey);
      setSortDir("desc");
    }
  }

  function sortMark(k: SortKey) {
    if (k !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const fx = fxUsdJpy != null && Number.isFinite(fxUsdJpy) && fxUsdJpy > 0 ? fxUsdJpy : null;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-border flex justify-between items-center bg-card/60 gap-3 flex-wrap">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Global Strata</h3>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-56 min-w-0 text-foreground/90"
              placeholder="ETF / 構造 / 地域で検索…"
              aria-label="ETF検索"
            />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground border border-border bg-background/60 px-2.5 py-2 rounded-lg">
            FX: {fx ? `USD/JPY ${fx.toFixed(2)}` : "—"}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
        <table className="w-full min-w-[1100px] text-left text-xs lg:text-sm">
          <thead className="bg-background text-muted-foreground text-[10px] uppercase font-bold tracking-[0.1em]">
            <tr>
              <th
                className={`px-6 py-4 min-w-[12rem] max-w-[14rem] ${stickyThFirst} cursor-pointer select-none`}
                onClick={() => toggleSort("asset")}
                title="Sort"
              >
                ETF{sortMark("asset")}
              </th>
              <th
                className="px-6 py-4 cursor-pointer select-none whitespace-nowrap"
                onClick={() => toggleSort("region")}
                title="Sort"
              >
                Geography{sortMark("region")}
              </th>
              <th className="px-6 py-4 min-w-[22rem]">Underlying Structure</th>
              <th
                className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                onClick={() => toggleSort("tracking")}
                title="ETF の抽出純度（Tracking Alpha）"
              >
                Tracking{sortMark("tracking")}
              </th>
              <th
                className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                onClick={() => toggleSort("alpha90d")}
                title="直近90日・累積 Alpha（対VOO）"
              >
                90D{sortMark("alpha90d")}
              </th>
              <th
                className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                onClick={() => toggleSort("latestAlpha")}
                title="直近日次 Alpha（対VOO）"
              >
                1D{sortMark("latestAlpha")}
              </th>
              <th
                className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                onClick={() => toggleSort("z")}
                title="直近日次 Alpha の Z-score"
              >
                Z{sortMark("z")}
              </th>
              <th
                className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                onClick={() => toggleSort("expense")}
                title="Expense Ratio Drag（5年換算）"
              >
                Drag{sortMark("expense")}
              </th>
              <th className="px-6 py-4 whitespace-nowrap">Currency Impact</th>
              <th
                className="px-6 py-4 cursor-pointer select-none whitespace-nowrap"
                onClick={() => toggleSort("phase")}
                title="相転移（Phase Shift）検知"
              >
                Phase{sortMark("phase")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sorted.map((e) => {
              const alpha90 = e.cumulativeAlpha90d;
              const alpha1d = e.latestDailyAlpha;
              const z = e.dailyAlphaZ;
              const tracking = e.trackingAlphaScore;
              const trackingClass =
                tracking >= 70
                  ? "text-emerald-300"
                  : tracking >= 55
                    ? "text-foreground/90"
                    : "text-amber-300";
              const alpha90Class =
                alpha90 == null ? "text-muted-foreground" : alpha90 > 0 ? "text-emerald-400" : "text-rose-400";
              const alpha1dClass =
                alpha1d == null ? "text-muted-foreground" : alpha1d > 0 ? "text-emerald-400" : "text-rose-400";
              const zClass =
                z == null
                  ? "text-muted-foreground"
                  : z <= -2
                    ? "text-amber-400"
                    : z >= 2
                      ? "text-emerald-400"
                      : "text-foreground/90";

              return (
                <tr key={e.ticker} className="group hover:bg-muted/60 transition-all">
                  <td className={`px-6 py-4 min-w-[12rem] max-w-[14rem] ${stickyTdFirst}`}>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-foreground group-hover:text-accent-cyan transition-colors inline-flex items-center gap-2 min-w-0">
                          {e.phaseShift ? (
                            <span
                              className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 shrink-0"
                              title="Phase Shift detected"
                              aria-label="Phase Shift detected"
                            >
                              <AlertTriangle size={14} />
                            </span>
                          ) : null}
                          <span className="truncate">{e.ticker}</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-snug line-clamp-2" title={e.name}>
                        {e.name}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">
                        {regionLabelJa(e.regionGroup)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      {geoBadge(e.geographyCode, e.geographyLabel)}
                      <span className="text-[10px] text-muted-foreground">{e.geographyLabel}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[11px] leading-snug text-foreground/90 line-clamp-3" title={e.underlyingStructure}>
                      {e.underlyingStructure}
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-right font-mono font-bold ${trackingClass}`} title="Tracking Alpha score">
                    {Number.isFinite(tracking) ? tracking.toFixed(2) : "—"}
                  </td>
                  <td className={`px-6 py-4 text-right font-mono font-bold ${alpha90Class}`}>
                    {fmtPct(alpha90)}
                  </td>
                  <td className={`px-6 py-4 text-right font-mono font-bold ${alpha1dClass}`}>
                    {fmtPct(alpha1d)}
                  </td>
                  <td className={`px-6 py-4 text-right font-mono font-bold ${zClass}`}>{fmtZ(z)}</td>
                  <td
                    className="px-6 py-4 text-right font-mono font-bold text-muted-foreground"
                    title="Expense Ratio Drag over 5y"
                  >
                    {e.expenseDrag5y > 0 ? `-${e.expenseDrag5y.toFixed(2)}%` : "—"}
                  </td>
                  <td className="px-6 py-4">
                    {e.currency === "JPY" ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/90 border border-border bg-background/60 px-2 py-0.5 rounded-md">
                        JPY
                      </span>
                    ) : (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide text-blue-300 border border-blue-500/35 bg-blue-500/10 px-2 py-0.5 rounded-md"
                        title="円建てでは USD/JPY の歪みが乗る"
                      >
                        USD{fx ? ` × ${fx.toFixed(1)}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {e.phaseShift ? (
                      <div className="flex flex-col gap-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border w-fit ${
                            e.phaseShiftDirection === "UP"
                              ? "text-emerald-300 border-emerald-500/35 bg-emerald-500/10"
                              : "text-amber-300 border-amber-500/35 bg-amber-500/10"
                          }`}
                        >
                          Phase {e.phaseShiftDirection ?? ""}
                        </span>
                        {e.spilloverHoldings.length > 0 ? (
                          <div className="text-[10px] text-muted-foreground leading-snug">
                            <span className="font-bold text-foreground/80">Spillover</span>{" "}
                            {e.spilloverHoldings.slice(0, 2).map((h) => (
                              <span key={h.ticker} className="mr-2">
                                <span className="font-mono text-foreground/90">{h.ticker}</span>
                              </span>
                            ))}
                            {e.spilloverHoldings.length > 2 ? (
                              <span className="text-[10px] text-muted-foreground">+{e.spilloverHoldings.length - 2}</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Spillover: —</span>
                        )}
                      </div>
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
              <td className={`px-6 py-3 text-xs font-bold text-foreground/90 min-w-[12rem] max-w-[14rem] ${stickyTdFirst}`}>
                Total: {sorted.length} ETFs
              </td>
              <td className="px-6 py-3" />
              <td className="px-6 py-3" />
              <td className="px-6 py-3" />
              <td className="px-6 py-3" />
              <td className="px-6 py-3" />
              <td className="px-6 py-3" />
              <td className="px-6 py-3" />
              <td className="px-6 py-3" />
              <td className="px-6 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

