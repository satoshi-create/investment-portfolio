"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
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

import { cn } from "@/src/lib/cn";
import type { BtcThemeChartPeriod } from "@/src/lib/btc-theme-chart-series";

type ChartApiRow = Record<string, string | number>;

type ChartApiResponse = {
  period: BtcThemeChartPeriod;
  tickers: string[];
  rows: ChartApiRow[];
  errors?: { ticker: string; message: string }[];
  error?: string;
};

const BTC_KEY = "BTC-USD";

const STROKE_PALETTE = [
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#fb7185",
  "#fbbf24",
  "#94a3b8",
  "#2dd4bf",
  "#e879f9",
  "#4ade80",
  "#f472b6",
  "#818cf8",
];

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

export function BitcoinThemePriceComparisonChart(props: {
  /** 比較に含める Yahoo シンボル（大文字）。BTC-USD は API 側で常に付与。 */
  compareTickers: string[];
  className?: string;
}) {
  const { compareTickers, className } = props;
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [period, setPeriod] = useState<BtcThemeChartPeriod>("1mo");
  const [rows, setRows] = useState<ChartApiRow[]>([]);
  const [tickers, setTickers] = useState<string[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [partialErrors, setPartialErrors] = useState<{ ticker: string; message: string }[]>([]);

  const tickersParam = useMemo(() => {
    const u = compareTickers.map((t) => t.trim().toUpperCase()).filter((t) => t.length > 0);
    return [...new Set(u)].slice(0, 20).join(",");
  }, [compareTickers]);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setLoadErr(null);
      try {
        const q = new URLSearchParams();
        q.set("period", period);
        if (tickersParam.length > 0) q.set("tickers", tickersParam);
        const res = await fetch(`/api/btc-theme-chart?${q.toString()}`, {
          cache: "no-store",
          signal,
        });
        const j = (await res.json()) as ChartApiResponse;
        if (!res.ok) {
          setRows([]);
          setTickers([]);
          setPartialErrors(j.errors ?? []);
          setLoadErr(j.error ?? j.errors?.[0]?.message ?? `HTTP ${res.status}`);
          return;
        }
        setRows(Array.isArray(j.rows) ? j.rows : []);
        setTickers(Array.isArray(j.tickers) ? j.tickers : []);
        setPartialErrors(Array.isArray(j.errors) ? j.errors : []);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setLoadErr(e instanceof Error ? e.message : "fetch failed");
        setRows([]);
        setTickers([]);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [period, tickersParam],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const lineKeys = useMemo(() => {
    const ordered: string[] = [];
    if (tickers.includes(BTC_KEY)) ordered.push(BTC_KEY);
    for (const t of tickers) {
      if (t === BTC_KEY) continue;
      ordered.push(t);
    }
    return ordered;
  }, [tickers]);

  const strokeFor = useCallback(
    (tk: string, i: number) => {
      if (tk === BTC_KEY) return "#f59e0b";
      return STROKE_PALETTE[(i + STROKE_PALETTE.length) % STROKE_PALETTE.length]!;
    },
    [],
  );

  const hasData = rows.length >= 2 && lineKeys.length > 0;

  return (
    <section
      aria-labelledby={`btc-price-compare-${rawId}`}
      className={cn(
        "rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-950/20 to-card/40 overflow-hidden shadow-xl",
        className,
      )}
    >
      <div className="border-b border-border/80 px-4 py-4 md:px-6 md:py-5 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-500/85">
              Price lens · 共通カレンダー
            </p>
            <h2 id={`btc-price-compare-${rawId}`} className="text-lg font-bold text-foreground tracking-tight">
              BTC とエコシステム銘柄の累積騰落（％）
            </h2>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-2xl">
              各銘柄の<strong className="text-foreground/90">全シンボルに共通する取引日</strong>
              だけをつなぎ、先頭日の終値を 0% 基準にした推移です。VOO 比 Alpha とは別物で、
              <span className="font-mono text-amber-200/90"> BTC-USD </span>
              との<strong>方向の連動</strong>を読む用途向けです。
            </p>
          </div>
          <div
            className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5 shrink-0"
            role="group"
            aria-label="チャート期間"
          >
            {(["5d", "1mo", "3mo"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase transition-colors",
                  period === p
                    ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
                    : "text-muted-foreground hover:text-foreground border border-transparent",
                )}
              >
                {p === "5d" ? "5D" : p === "1mo" ? "1M" : "3M"}
              </button>
            ))}
          </div>
        </div>
        {partialErrors.length > 0 ? (
          <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 font-mono">
            一部取得スキップ: {partialErrors.map((e) => `${e.ticker} (${e.message})`).join(" · ")}
          </p>
        ) : null}
      </div>

      <div className="h-[min(380px,52vh)] min-h-[260px] px-1 pb-4 pt-2 md:px-3 md:pb-6">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            チャート読み込み中…
          </div>
        ) : loadErr ? (
          <div className="h-full flex items-center justify-center px-4 text-center text-sm text-rose-400">
            {loadErr}
          </div>
        ) : !hasData ? (
          <div className="h-full flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
            共通日足が 2 日未満のため比較できません。ティッカーや期間を変えて試してください。
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(51 65 85 / 0.25)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "rgb(148 163 184)" }}
                tickLine={false}
                axisLine={{ stroke: "rgb(51 65 85 / 0.45)" }}
                minTickGap={32}
                tickFormatter={(v) => (typeof v === "string" && v.length >= 10 ? v.slice(5, 10) : String(v))}
              />
              <YAxis
                width={48}
                tick={{ fontSize: 9, fill: "rgb(148 163 184)" }}
                tickLine={false}
                axisLine={{ stroke: "rgb(51 65 85 / 0.45)" }}
                tickFormatter={(v) => fmtAxisPct(Number(v))}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgb(15 23 42 / 0.96)",
                  border: "1px solid rgb(51 65 85)",
                  borderRadius: "0.75rem",
                  fontSize: "11px",
                  color: "rgb(226 232 240)",
                }}
                labelFormatter={(label) =>
                  typeof label === "string" && label.length >= 10 ? label.slice(0, 10) : String(label)
                }
                formatter={(value, name) => [fmtTooltipPct(Number(value ?? 0)), String(name)]}
              />
              <Legend
                wrapperStyle={{ fontSize: "10px", paddingTop: "4px" }}
                formatter={(value) => <span className="text-muted-foreground">{value}</span>}
              />
              {lineKeys.map((tk, idx) => (
                <Line
                  key={tk}
                  type="monotone"
                  dataKey={tk}
                  name={tk}
                  stroke={strokeFor(tk, tk === BTC_KEY ? 0 : idx)}
                  strokeWidth={tk === BTC_KEY ? 2.6 : 1.35}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
