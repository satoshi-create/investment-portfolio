"use client";

import React from "react";

import type { CumulativeAlphaPoint } from "@/src/types/investment";

const VB_W = 720;
const VB_H = 280;
const M = { top: 48, right: 24, bottom: 44, left: 56 };

function fmtAxisPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

export function StructuralProgressChart({
  series,
  anchorDateLabel,
  totalPct,
}: {
  series: CumulativeAlphaPoint[];
  anchorDateLabel: string | null;
  totalPct: number | null;
}) {
  if (series.length === 0) return null;

  const chartW = VB_W - M.left - M.right;
  const chartH = VB_H - M.top - M.bottom;
  const midY = M.top + chartH / 2;

  const vals = series.map((p) => p.cumulative);
  const minV = Math.min(0, ...vals);
  const maxV = Math.max(0, ...vals);
  const maxAbs = Math.max(Math.abs(minV), Math.abs(maxV), 0.5);

  function yFor(v: number) {
    return midY - (v / maxAbs) * (chartH / 2 - 6);
  }

  const n = series.length;
  function xFor(i: number) {
    if (n <= 1) return M.left + chartW / 2;
    return M.left + (i / (n - 1)) * chartW;
  }

  const points = series.map((p, i) => ({ x: xFor(i), y: yFor(p.cumulative), ...p }));

  const firstDate = series[0]!.date;
  const lastDate = series[series.length - 1]!.date;
  const midDate = series[Math.floor((series.length - 1) / 2)]!.date;

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

  return (
    <section
      aria-labelledby="structural-progress-heading"
      className="rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-2xl ring-1 ring-slate-800/60"
    >
      <div className="border-b border-slate-800/90 bg-slate-900/40 px-5 py-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-slate-600">Structural Alpha (Cumulative)</p>
            <h2 id="structural-progress-heading" className="text-lg md:text-xl font-bold tracking-tight text-slate-100">
              Structural Progress (Cumulative Alpha)
            </h2>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-xl">
              テーマ設置日をスタートラインとし、VOO 対比の日次 Alpha を積み上げた累積乖離。日々のノイズではなく、構造の「距離」を測ります。
            </p>
            {anchorDateLabel ? (
              <p className="text-[10px] font-mono text-slate-600">
                Base date (theme): <span className="text-slate-400">{anchorDateLabel}</span>
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-left lg:text-right">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              テーマ設定来のトータル乖離率
            </p>
            <p className={`text-2xl md:text-3xl font-mono font-bold tabular-nums ${totalClass}`}>{totalStr}</p>
          </div>
        </div>
      </div>

      <div className="px-2 pb-2 md:px-4 md:pb-4">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full h-auto max-h-[min(320px,55vh)] text-slate-200"
          role="img"
          aria-label="累積 Alpha の時系列"
        >
          <title>Structural cumulative alpha vs VOO from theme base date</title>
          {/* プラス領域（画面上部） / マイナス領域（画面下部） */}
          <rect x={M.left} y={M.top} width={chartW} height={chartH / 2} fill="rgba(16, 185, 129, 0.07)" />
          <rect x={M.left} y={midY} width={chartW} height={chartH / 2} fill="rgba(244, 63, 94, 0.07)" />

          <line
            x1={M.left}
            x2={M.left + chartW}
            y1={midY}
            y2={midY}
            className="stroke-slate-600"
            strokeWidth={1}
            strokeDasharray="4 4"
          />

          <text x={M.left - 8} y={M.top + 12} textAnchor="end" className="fill-slate-500 text-[10px] font-mono">
            {fmtAxisPct(maxAbs)}
          </text>
          <text x={M.left - 8} y={midY + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-mono font-bold">
            0
          </text>
          <text x={M.left - 8} y={M.top + chartH - 4} textAnchor="end" className="fill-slate-500 text-[10px] font-mono">
            {fmtAxisPct(-maxAbs)}
          </text>

          {n === 1 ? (
            <circle
              cx={points[0]!.x}
              cy={points[0]!.y}
              r={4}
              fill="rgb(226 232 240)"
              stroke="rgb(148 163 184)"
              strokeWidth={1}
            />
          ) : (
            series.slice(0, -1).map((_, i) => {
              const a = points[i]!;
              const b = points[i + 1]!;
              const avgCum = (a.cumulative + b.cumulative) / 2;
              const stroke = avgCum >= 0 ? "rgb(52 211 153)" : "rgb(251 113 133)";
              return (
                <line
                  key={`${a.date}-${b.date}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={stroke}
                  strokeWidth={2.25}
                  strokeLinecap="round"
                />
              );
            })
          )}

          <text
            x={M.left}
            y={VB_H - 12}
            className="fill-slate-600 text-[9px] font-mono"
          >
            {firstDate}
          </text>
          <text
            x={M.left + chartW / 2}
            y={VB_H - 12}
            textAnchor="middle"
            className="fill-slate-600 text-[9px] font-mono"
          >
            {midDate}
          </text>
          <text
            x={M.left + chartW}
            y={VB_H - 12}
            textAnchor="end"
            className="fill-slate-600 text-[9px] font-mono"
          >
            {lastDate}
          </text>
        </svg>
      </div>
    </section>
  );
}
