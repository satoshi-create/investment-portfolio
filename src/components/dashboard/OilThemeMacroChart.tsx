"use client";

import React, { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { OilThemeMacroChartData } from "@/src/types/investment";

import { OIL_THEME_CORRELATION_MIN_PAIRS } from "@/src/lib/oil-theme-macro-chart";

const WTI_STROKE = "#f59e0b";
const THEME_STROKE = "#22d3ee";

function fmtAxisPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(0)}%`;
}

export function OilThemeMacroChart({ data }: { data: OilThemeMacroChartData }) {
  const chartData = useMemo(
    () =>
      data.points.map((p) => ({
        date: p.date,
        wti: p.wtiNormCumulativePct,
        theme: p.themeTrendCumulativePct,
      })),
    [data.points],
  );

  const { minY, maxY, pad } = useMemo(() => {
    if (chartData.length === 0) return { minY: 0, maxY: 0, pad: 1 };
    const vals: number[] = [];
    for (const p of chartData) {
      if (p.wti != null && Number.isFinite(p.wti)) vals.push(p.wti);
      if (p.theme != null && Number.isFinite(p.theme)) vals.push(p.theme);
    }
    if (vals.length === 0) return { minY: 0, maxY: 0, pad: 1 };
    const minY = Math.min(...vals);
    const maxY = Math.max(...vals);
    const span = Math.abs(maxY - minY);
    const pad = span > 0 ? span * 0.08 : 1;
    return { minY, maxY, pad };
  }, [chartData]);

  const corrStr =
    data.wtiVsThemeTrendCorrelation != null && Number.isFinite(data.wtiVsThemeTrendCorrelation)
      ? `ρ ≈ ${data.wtiVsThemeTrendCorrelation.toFixed(3)}（n=${data.correlationPairCount}、最低 ${OIL_THEME_CORRELATION_MIN_PAIRS} ペア）`
      : `相関: —（n=${data.correlationPairCount}、算出には ${OIL_THEME_CORRELATION_MIN_PAIRS} ペア以上）`;

  return (
    <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 overflow-hidden">
      <div className="border-b border-slate-800/80 px-3 py-2 md:px-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">WTI vs 構造トレンド</p>
        <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
          橙: WTI（CL=F）正規化累積%。青: テーマ構造トレンド累積%（年輪と同一）。{corrStr}
        </p>
      </div>
      <div className="h-[min(280px,45vh)] min-h-[200px] px-1 pb-2 pt-1">
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(51 65 85 / 0.35)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "rgb(148 163 184)" }}
                tickFormatter={(v) => (typeof v === "string" && v.length >= 10 ? v.slice(5) : String(v))}
              />
              <YAxis
                domain={[minY - pad, maxY + pad]}
                tick={{ fontSize: 9, fill: "rgb(148 163 184)" }}
                tickFormatter={fmtAxisPct}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  background: "rgb(15 23 42 / 0.95)",
                  border: "1px solid rgb(51 65 85)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                formatter={(value, name) => {
                  const v = typeof value === "number" ? value : Number(value);
                  if (!Number.isFinite(v)) return ["—", String(name)];
                  const sign = v > 0 ? "+" : "";
                  return [`${sign}${v.toFixed(2)}%`, String(name)];
                }}
                labelFormatter={(label) => (typeof label === "string" ? label : "")}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="wti" name="WTI 累積%" stroke={WTI_STROKE} dot={false} strokeWidth={2} connectNulls />
              <Line type="monotone" dataKey="theme" name="テーマ累積%" stroke={THEME_STROKE} dot={false} strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[10px] text-muted-foreground p-3">系列が不足しています。</p>
        )}
      </div>
    </div>
  );
}
