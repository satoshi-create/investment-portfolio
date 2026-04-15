"use client";

import React, { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CumulativeAlphaPoint } from "@/src/types/investment";

const EMERALD = "#34d399";
const ROSE = "#fb7185";

function fmtAxisPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function fmtTooltipPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export function ThemeStructuralTrendChart({
  series,
  totalPct,
  lookbackDays,
  startDateLabel,
}: {
  series: CumulativeAlphaPoint[];
  totalPct: number | null;
  lookbackDays: number;
  startDateLabel: string | null;
}) {
  const rawId = useId();
  const gradId = `theme-alpha-fill-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const hasSeries = series.length > 0;

  let stroke = EMERALD;
  let minY = 0;
  let maxY = 0;
  let pad = 0.35;
  if (hasSeries) {
    const values = series.map((p) => p.cumulative);
    const last = values[values.length - 1] ?? 0;
    stroke = last >= 0 ? EMERALD : ROSE;
    minY = Math.min(0, ...values);
    maxY = Math.max(0, ...values);
    const span = Math.abs(maxY - minY);
    pad = span > 0 ? span * 0.08 : 0.35;
  }

  const totalStr =
    totalPct != null && Number.isFinite(totalPct)
      ? `${totalPct > 0 ? "+" : ""}${totalPct.toFixed(2)}%`
      : "—";
  const totalClass =
    totalPct != null && Number.isFinite(totalPct)
      ? totalPct > 0
        ? "text-emerald-400"
        : totalPct < 0
          ? "text-rose-400"
          : "text-slate-300"
      : "text-slate-500";

  const data = hasSeries ? series.map((p) => ({ ...p })) : [];

  return (
    <section
      aria-labelledby="theme-structural-trend-heading"
      className="rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-2xl ring-1 ring-slate-800/60"
    >
      <div className="border-b border-slate-800/90 bg-slate-900/40 px-5 py-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-slate-600">Theme cumulative alpha</p>
            <h2 id="theme-structural-trend-heading" className="text-lg md:text-xl font-bold tracking-tight text-slate-100">
              構造的年輪トレンド (Theme Cumulative Alpha)
            </h2>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-2xl">
              このラインが右肩上がりであることは、構造（テーマ）がベンチマークを凌駕し続けていることを示します。
            </p>
            <p className="text-[10px] font-mono text-slate-600">
              期間: 直近 {lookbackDays} 日（起点{" "}
              <span className="text-slate-400">{startDateLabel ?? "—"}</span> 以降の累積）
            </p>
          </div>
          <div className="shrink-0 text-left lg:text-right">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">期間終端の加重累積</p>
            <p className={`text-2xl md:text-3xl font-mono font-bold tabular-nums ${totalClass}`}>{totalStr}</p>
          </div>
        </div>
      </div>

      <div className="px-2 pb-4 pt-2 md:px-4 md:pb-6 h-[min(360px,50vh)] min-h-[240px]">
        {hasSeries ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.38} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(51 65 85 / 0.35)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "rgb(148 163 184)" }}
                tickLine={false}
                axisLine={{ stroke: "rgb(51 65 85 / 0.6)" }}
                minTickGap={28}
              />
              <YAxis
                width={52}
                tick={{ fontSize: 10, fill: "rgb(148 163 184)" }}
                tickLine={false}
                axisLine={{ stroke: "rgb(51 65 85 / 0.6)" }}
                domain={[minY - pad, maxY + pad]}
                tickFormatter={(v) => fmtAxisPct(Number(v))}
              />
              <ReferenceLine y={0} stroke="rgb(100 116 139)" strokeDasharray="4 4" />
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
                formatter={(value) => [fmtTooltipPct(Number(value ?? 0)), "累積 Alpha"]}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={stroke}
                strokeWidth={2.25}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 1, stroke: "rgb(15 23 42)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-sm text-slate-400 leading-relaxed max-w-md">
              直近 {lookbackDays} 日分の Alpha 履歴が不足しているか、観測対象ティッカーが未設定のため、累積系列を描画できません。
            </p>
            <p className="text-[11px] text-slate-600">
              エコシステムに上場ティッカー（未上場は代理ティッカー）を登録し、日次 Alpha のバックフィルを行うと表示されます。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
