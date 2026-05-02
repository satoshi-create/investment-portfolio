"use client";

import React, { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { NaphthaCorrelationChartData } from "@/src/types/naphtha";

const NAPHTHA_AREA = "#f59e0b";
const LINE_PALETTE = ["#34d399", "#38bdf8", "#fb7185", "#a78bfa", "#fbbf24"];

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export function NaphthaCorrelationChart({ data }: { data: NaphthaCorrelationChartData }) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradId = `naphtha-fill-${rawId}`;

  const upperData = data.priceArea.map((p) => ({ ...p }));
  const lowerData = data.alphaComboRows.map((row) => ({ ...row }));

  const hasUpper = upperData.length > 0;
  const hasLower = lowerData.length > 0 && data.alphaSeries.length > 0;

  const corrStr =
    data.aggregateCorrelation != null && Number.isFinite(data.aggregateCorrelation)
      ? data.aggregateCorrelation.toFixed(3)
      : "—";

  return (
    <section
      aria-labelledby="naphtha-correlation-heading"
      className="rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-2xl ring-1 ring-slate-800/60"
    >
      <div className="border-b border-slate-800/90 bg-slate-900/40 px-5 py-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-slate-600">
              Naphtha correlation · VOO lens
            </p>
            <h2
              id="naphtha-correlation-heading"
              className="text-lg md:text-xl font-bold tracking-tight text-slate-100"
            >
              ナフサ相関エンジン（江戸還流トリガー）
            </h2>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-3xl">
              中東・クラックマージンをプロキシする指数（既定 <span className="font-mono text-slate-400">{data.naphthaProxyYahooSymbol}</span>
              ）と、監視銘柄の対 VOO 日次 Alpha を重ね、スパイク日に Edo Transition Trigger を表示します。
            </p>
            <p className="text-[10px] font-mono text-slate-600">
              窓: 直近 {data.lookbackDays} 日 · 価格ソース: {data.priceSource} · 相関ペア数{" "}
              {data.correlationPairCount}
            </p>
          </div>
          <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left lg:text-right">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">ρ（加重平均α）</p>
              <p className="text-xl font-mono font-bold tabular-nums text-slate-100">{corrStr}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">プロキシ 1D</p>
              <p className="text-xl font-mono font-bold tabular-nums text-amber-300/90">{fmtPct(data.change24hPct)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">プロキシ ~1W</p>
              <p className="text-xl font-mono font-bold tabular-nums text-amber-200/80">{fmtPct(data.change7dPct)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">スパイク日数</p>
              <p className="text-xl font-mono font-bold tabular-nums text-slate-200">{data.spikeDates.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-2 pb-3 pt-2 md:px-4 space-y-6 md:pb-6">
        <div className="h-[min(280px,42vh)] min-h-[200px]">
          {hasUpper ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={upperData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NAPHTHA_AREA} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={NAPHTHA_AREA} stopOpacity={0} />
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
                  domain={["auto", "auto"]}
                />
                {data.spikeDates.map((d) => (
                  <ReferenceLine
                    key={`spike-u-${d}`}
                    x={d}
                    stroke="rgb(251 191 36 / 0.55)"
                    strokeDasharray="4 4"
                    ifOverflow="extendDomain"
                  />
                ))}
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
                <Area
                  type="monotone"
                  dataKey="price"
                  name="ナフサ・プロキシ"
                  stroke={NAPHTHA_AREA}
                  strokeWidth={2}
                  fill={`url(#${gradId})`}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">
              価格系列が不足しています（DB の commodity_prices または Yahoo プロキシを確認）。
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">
            対 VOO 日次 Alpha（%） — Edo Transition Trigger = オレンジ破線
          </p>
          <div className="h-[min(320px,48vh)] min-h-[220px]">
            {hasLower ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={lowerData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(51 65 85 / 0.35)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "rgb(148 163 184)" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgb(51 65 85 / 0.6)" }}
                    minTickGap={24}
                  />
                  <YAxis
                    width={48}
                    tick={{ fontSize: 10, fill: "rgb(148 163 184)" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgb(51 65 85 / 0.6)" }}
                    tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                  />
                  <ReferenceLine y={0} stroke="rgb(100 116 139)" strokeDasharray="4 4" />
                  {data.spikeDates.map((d) => (
                    <ReferenceLine
                      key={`spike-l-${d}`}
                      x={d}
                      stroke="rgb(251 191 36 / 0.65)"
                      strokeDasharray="4 4"
                      ifOverflow="extendDomain"
                    />
                  ))}
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
                    wrapperStyle={{ fontSize: "11px", color: "rgb(148 163 184)" }}
                    formatter={(value) => <span className="text-slate-400">{String(value)}</span>}
                  />
                  {data.alphaSeries.map((s, idx) => (
                    <Line
                      key={s.dataKey}
                      type="monotone"
                      dataKey={s.dataKey}
                      name={`${s.labelJa} (${s.ticker})`}
                      stroke={LINE_PALETTE[idx % LINE_PALETTE.length]}
                      dot={false}
                      strokeWidth={1.75}
                      connectNulls
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                Alpha 系列が不足しています（alpha_history のバックフィルまたは Yahoo を確認）。
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
