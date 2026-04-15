"use client";

import React, { useId, useMemo, useState } from "react";
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
const NEON_PURPLE = "#d946ef";
const NEON_PURPLE_HI = "#f0abfc";

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
  isNonLinearExplosion = false,
}: {
  series: CumulativeAlphaPoint[];
  totalPct: number | null;
  lookbackDays: number;
  startDateLabel: string | null;
  isNonLinearExplosion?: boolean;
}) {
  const rawId = useId();
  const gradId = `theme-alpha-fill-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const hasSeries = series.length > 0;
  const [logView, setLogView] = useState(false);

  let stroke = EMERALD;
  if (hasSeries) {
    const values = series.map((p) => p.cumulative);
    const last = values[values.length - 1] ?? 0;
    stroke = last >= 0 ? EMERALD : ROSE;
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

  const explosionStroke = isNonLinearExplosion ? NEON_PURPLE : stroke;

  const data = useMemo(() => {
    if (!hasSeries) return [];
    if (!logView) return series.map((p) => ({ ...p, plot: p.cumulative }));
    // Symmetric log-like transform (symlog): sign(x)*log10(1+|x|)
    return series.map((p) => {
      const x = Number(p.cumulative);
      const s = x >= 0 ? 1 : -1;
      const y = Number.isFinite(x) ? s * Math.log10(1 + Math.abs(x)) : 0;
      return { ...p, plot: y };
    });
  }, [hasSeries, logView, series]);

  const yDomain = useMemo(() => {
    if (!hasSeries) return [0, 0] as [number, number];
    const values = (data as any[]).map((p) => Number(p.plot));
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const span = Math.abs(max - min);
    const p = span > 0 ? span * 0.08 : 0.2;
    return [min - p, max + p] as [number, number];
  }, [data, hasSeries]);

  const tickFormatter = (v: number) => {
    if (!logView) return fmtAxisPct(Number(v));
    const y = Number(v);
    if (!Number.isFinite(y)) return "—";
    const s = y >= 0 ? 1 : -1;
    const x = s * (Math.pow(10, Math.abs(y)) - 1);
    return fmtAxisPct(x);
  };

  return (
    <section
      aria-labelledby="theme-structural-trend-heading"
      className={`rounded-2xl border overflow-hidden shadow-2xl ring-1 ${
        isNonLinearExplosion
          ? "border-fuchsia-500/30 bg-slate-950/80 ring-fuchsia-500/20"
          : "border-slate-800 bg-slate-950/80 ring-slate-800/60"
      }`}
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
          <div className="shrink-0 text-left lg:text-right space-y-2">
            <div className="flex items-center gap-2 justify-start lg:justify-end">
              <button
                type="button"
                onClick={() => setLogView((v) => !v)}
                className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg border transition-colors ${
                  logView
                    ? "text-fuchsia-200 border-fuchsia-500/45 bg-fuchsia-500/10"
                    : "text-slate-400 border-slate-700 hover:bg-slate-800/60"
                }`}
                title="Y軸を（対数っぽく）圧縮して、急伸を一直線の突破として確認"
              >
                Logarithmic
              </button>
              {isNonLinearExplosion ? (
                <span
                  className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-200/90 border border-fuchsia-500/35 bg-fuchsia-500/10 px-2 py-1 rounded-lg"
                  title="Phase Shift（相転移）: 非線形な加速が検知されました"
                >
                  Phase shift
                </span>
              ) : null}
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">期間終端の加重累積</p>
              <p className={`text-2xl md:text-3xl font-mono font-bold tabular-nums ${totalClass}`}>{totalStr}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative px-2 pb-4 pt-2 md:px-4 md:pb-6 h-[min(360px,50vh)] min-h-[240px]">
        {isNonLinearExplosion ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="explosion-particles absolute inset-0 opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-fuchsia-500/5 via-transparent to-transparent" />
          </div>
        ) : null}
        {hasSeries ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isNonLinearExplosion ? NEON_PURPLE_HI : stroke} stopOpacity={0.55} />
                  <stop offset="40%" stopColor={isNonLinearExplosion ? NEON_PURPLE : stroke} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={isNonLinearExplosion ? NEON_PURPLE : stroke} stopOpacity={0} />
                </linearGradient>
                {isNonLinearExplosion ? (
                  <filter id={`${gradId}-glow`} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="3.25" result="blur" />
                    <feColorMatrix
                      in="blur"
                      type="matrix"
                      values="1 0 0 0 0  0 0.4 0 0 0  0 0 1 0 0  0 0 0 0.9 0"
                      result="colored"
                    />
                    <feMerge>
                      <feMergeNode in="colored" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                ) : null}
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
                domain={yDomain as any}
                tickFormatter={(v) => tickFormatter(Number(v))}
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
                formatter={(value) => {
                  if (!logView) return [fmtTooltipPct(Number(value ?? 0)), "累積 Alpha"];
                  const y = Number(value ?? 0);
                  const s = y >= 0 ? 1 : -1;
                  const x = s * (Math.pow(10, Math.abs(y)) - 1);
                  return [fmtTooltipPct(x), "累積 Alpha（log view）"];
                }}
              />
              <Area
                type="monotone"
                dataKey="plot"
                stroke={explosionStroke}
                strokeWidth={2.25}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 1, stroke: "rgb(15 23 42)" }}
                {...(isNonLinearExplosion ? { filter: `url(#${gradId}-glow)` } : {})}
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

      <style jsx>{`
        .explosion-particles {
          background-image: radial-gradient(circle at 20% 120%, rgba(217, 70, 239, 0.18), transparent 42%),
            radial-gradient(circle at 75% 110%, rgba(240, 171, 252, 0.14), transparent 46%),
            radial-gradient(circle at 45% 130%, rgba(34, 211, 238, 0.08), transparent 52%);
        }
        .explosion-particles::before,
        .explosion-particles::after {
          content: "";
          position: absolute;
          inset: -30% -10%;
          background-image: radial-gradient(circle, rgba(240, 171, 252, 0.14) 0 2px, transparent 3px),
            radial-gradient(circle, rgba(217, 70, 239, 0.1) 0 1.5px, transparent 3px),
            radial-gradient(circle, rgba(34, 211, 238, 0.06) 0 1.5px, transparent 3px);
          background-size: 42px 42px, 58px 58px, 74px 74px;
          background-position: 0 0, 20px 30px, 10px 50px;
          animation: particles-rise 7.5s linear infinite;
          opacity: 0.7;
          filter: blur(0.1px);
        }
        .explosion-particles::after {
          background-size: 54px 54px, 76px 76px, 96px 96px;
          animation-duration: 10.5s;
          opacity: 0.45;
        }
        @keyframes particles-rise {
          0% {
            transform: translateY(16%);
          }
          100% {
            transform: translateY(-18%);
          }
        }
      `}</style>
    </section>
  );
}
