"use client";

import React, { useId, useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { StatBox } from "@/src/components/dashboard/StatBox";
import type { ResourceStructuralSyncData, ResourceStructuralSyncPoint } from "@/src/types/investment";

const GLD_STROKE = "#FFD700";
const SLV_STROKE = "#C0C0C0";
const CPER_STROKE = "#CD7F32";
const ECO_STROKE = "#34d399";
const COMPOSITE_STROKE = "#94a3b8";

function fmtAxisPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(0)}%`;
}

function fmtTooltipPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function mergeHighlightRanges(points: ResourceStructuralSyncPoint[]): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  let start: string | null = null;
  let prev: string | null = null;
  for (const p of points) {
    if (p.spreadWidening) {
      if (start == null) start = p.date;
    } else if (start != null && prev != null) {
      out.push({ from: start, to: prev });
      start = null;
    }
    prev = p.date;
  }
  if (start != null && prev != null) out.push({ from: start, to: prev });
  return out;
}

export function ResourceStructuralSyncChart({ data }: { data: ResourceStructuralSyncData }) {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const chartData = data.points;
  const ranges = useMemo(() => mergeHighlightRanges(chartData), [chartData]);

  const last = chartData.length > 0 ? chartData[chartData.length - 1]! : null;

  const { minY, maxY, pad } = useMemo(() => {
    if (chartData.length === 0) return { minY: 0, maxY: 0, pad: 1 };
    const vals: number[] = [];
    for (const p of chartData) {
      vals.push(p.gldPct, p.slvPct, p.cperPct, p.resourceCompositePct, p.ecosystemEquityAvgPct);
    }
    const minY = Math.min(...vals);
    const maxY = Math.max(...vals);
    const span = Math.abs(maxY - minY);
    const pad = span > 0 ? span * 0.08 : 1;
    return { minY, maxY, pad };
  }, [chartData]);

  const pctStr = (v: number | null) =>
    v != null && Number.isFinite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(2)}%` : "—";
  const pctClass = (v: number | null) => {
    if (v == null || !Number.isFinite(v)) return "text-slate-500";
    if (v > 0) return "text-emerald-400";
    if (v < 0) return "text-rose-400";
    return "text-slate-300";
  };

  return (
    <section
      aria-labelledby={`resource-sync-heading-${rawId}`}
      className="rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-2xl ring-1 ring-slate-800/60"
    >
      <div className="border-b border-slate-800/90 bg-slate-900/40 px-5 py-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-slate-600">Physical · equity sync</p>
            <h2 id={`resource-sync-heading-${rawId}`} className="text-lg md:text-xl font-bold tracking-tight text-slate-100">
              物理資源・銘柄シンクロ
            </h2>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-2xl">
              GLD / SLV / CPER（資源レイヤー）とウォッチ銘柄群の、同一起点からの累積騰落率（%）を重ね表示。乖離（Eco 平均 − 資源複合）が統計的に広がった日付帯をハイライトします。
            </p>
            <p className="text-[10px] font-mono text-slate-600">
              起点: <span className="text-slate-400">{data.anchorYmd ?? "—"}</span>
              {" · "}
              対象: {data.ecoTickersUsed.length > 0 ? data.ecoTickersUsed.join(", ") : "—"}
            </p>
          </div>
          <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 text-left lg:text-right">
            <StatBox label="資源複合" value={pctStr(last?.resourceCompositePct ?? null)} valueColor={pctClass(last?.resourceCompositePct ?? null)} />
            <StatBox label="Eco 平均" value={pctStr(last?.ecosystemEquityAvgPct ?? null)} valueColor={pctClass(last?.ecosystemEquityAvgPct ?? null)} />
            <StatBox label="Spread" value={pctStr(last?.spread ?? null)} valueColor={pctClass(last?.spread ?? null)} subLabel="乖離（pt）" />
            <StatBox label="SLV（銀）" value={pctStr(last?.slvPct ?? null)} valueColor="text-[#C0C0C0]" />
          </div>
        </div>
      </div>

      <div className="px-2 pb-4 pt-2 md:px-4 md:pb-6 h-[min(380px,52vh)] min-h-[260px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(51 65 85 / 0.35)" vertical={false} />
              {ranges.map((r, i) => (
                <ReferenceArea
                  key={`${r.from}-${r.to}-${i}`}
                  x1={r.from}
                  x2={r.to}
                  yAxisId="left"
                  fill="rgb(251 191 36 / 0.12)"
                />
              ))}
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "rgb(148 163 184)" }}
                tickLine={false}
                axisLine={{ stroke: "rgb(51 65 85 / 0.6)" }}
                minTickGap={28}
              />
              <YAxis
                yAxisId="left"
                width={52}
                tick={{ fontSize: 10, fill: "rgb(148 163 184)" }}
                tickLine={false}
                axisLine={{ stroke: "rgb(51 65 85 / 0.6)" }}
                domain={[minY - pad, maxY + pad]}
                tickFormatter={(v) => fmtAxisPct(Number(v))}
              />
              <ReferenceLine yAxisId="left" y={0} stroke="rgb(100 116 139)" strokeDasharray="4 4" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgb(15 23 42 / 0.95)",
                  border: "1px solid rgb(51 65 85)",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                  color: "rgb(226 232 240)",
                }}
                labelFormatter={(label) =>
                  typeof label === "string" && label.length >= 10 ? label.slice(0, 10) : String(label)
                }
              />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                formatter={(value) => <span className="text-slate-400">{value}</span>}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="gldPct"
                name="GLD（金）"
                stroke={GLD_STROKE}
                strokeWidth={2.25}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="slvPct"
                name="SLV（銀）"
                stroke={SLV_STROKE}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="cperPct"
                name="CPER（銅）"
                stroke={CPER_STROKE}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="resourceCompositePct"
                name="資源複合"
                stroke={COMPOSITE_STROKE}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ecosystemEquityAvgPct"
                name="Eco 平均"
                stroke={ECO_STROKE}
                strokeWidth={2.25}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-sm text-slate-400 leading-relaxed max-w-md">
              資源ETFとウォッチ銘柄の共通日足が不足しているため、同期チャートを描画できません。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
