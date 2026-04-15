"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

import { cn } from "@/src/lib/cn";
import type { PeriodicTableAlphaPoint, PeriodicTableCellData } from "@/src/lib/dashboard-data";
import { ElementCell } from "@/src/components/dashboard/ElementCell";

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function pctClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-slate-500";
  if (v > 0) return "text-emerald-300";
  if (v < 0) return "text-rose-300";
  return "text-slate-300";
}

export function PeriodicTableBoard({ cells }: { cells: PeriodicTableCellData[] }) {
  const [selected, setSelected] = useState<PeriodicTableCellData | null>(null);
  const [alphaPoints, setAlphaPoints] = useState<PeriodicTableAlphaPoint[] | null>(null);
  const [alphaLoading, setAlphaLoading] = useState(false);
  const [alphaError, setAlphaError] = useState<string | null>(null);

  const byPos = useMemo(() => {
    const m = new Map<string, PeriodicTableCellData>();
    for (const c of cells) {
      const k = `${c.element.x},${c.element.y}`;
      m.set(k, c);
    }
    return m;
  }, [cells]);

  useEffect(() => {
    const tk = selected?.ticker?.trim();
    if (!tk) {
      setAlphaPoints(null);
      setAlphaLoading(false);
      setAlphaError(null);
      return;
    }
    const ac = new AbortController();
    setAlphaLoading(true);
    setAlphaError(null);
    fetch(`/api/periodic-table/alpha-series?ticker=${encodeURIComponent(tk)}&limit=60`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as { points?: PeriodicTableAlphaPoint[]; error?: string };
        if (!res.ok) {
          setAlphaPoints([]);
          setAlphaError(json.error ?? `HTTP ${res.status}`);
          return;
        }
        setAlphaPoints(Array.isArray(json.points) ? json.points : []);
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setAlphaPoints([]);
        setAlphaError(e instanceof Error ? e.message : "Failed to load alpha series");
      })
      .finally(() => setAlphaLoading(false));

    return () => ac.abort();
  }, [selected?.ticker]);

  const latestAlpha = useMemo(() => {
    if (!alphaPoints || alphaPoints.length === 0) return null;
    const v = alphaPoints[alphaPoints.length - 1]!.alpha;
    return Number.isFinite(v) ? v : null;
  }, [alphaPoints]);

  const alphaPoints30d = useMemo(() => {
    if (!alphaPoints || alphaPoints.length === 0) return [];
    return alphaPoints.slice(-30);
  }, [alphaPoints]);

  const cumulativeAlpha30d = useMemo(() => {
    if (!alphaPoints30d || alphaPoints30d.length === 0) return null;
    const sum = alphaPoints30d.reduce((acc, p) => acc + (Number.isFinite(p.alpha) ? p.alpha : 0), 0);
    return Number.isFinite(sum) ? Math.round(sum * 100) / 100 : null;
  }, [alphaPoints30d]);

  const cumulativeSeries30d = useMemo(() => {
    if (!alphaPoints30d || alphaPoints30d.length === 0) return [];
    let running = 0;
    return alphaPoints30d.map((p) => {
      const a = Number.isFinite(p.alpha) ? p.alpha : 0;
      running += a;
      return { date: p.date, alpha: p.alpha, cumulative: Math.round(running * 100) / 100 };
    });
  }, [alphaPoints30d]);

  return (
    <div className="flex flex-col gap-4">
      {/* Detail (top) */}
      <section className="w-full">
        <div className="rounded-2xl border border-white/10 bg-slate-950/30 backdrop-blur-[2px] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
                Periodic table · critical metals
              </p>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                {selected ? "セルを選択中（再クリックで解除）" : "セルをクリックして詳細を表示"}
              </p>
            </div>
            {selected ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border border-white/10 px-2.5 py-1.5 rounded-lg hover:bg-slate-900/60"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
            {selected ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-black tracking-tight text-slate-100 leading-none">
                      {selected.element.symbol}
                      <span className="ml-2 text-xs font-mono text-slate-500">
                        #{selected.element.number}
                      </span>
                    </p>
                    {selected.element.nameJa ? (
                      <p className="text-sm text-slate-300 mt-1 leading-snug">
                        {selected.element.nameJa}
                      </p>
                    ) : null}
                    <p className="text-[10px] font-mono text-slate-500 mt-1">
                      col {selected.element.x} · row {selected.element.y}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-lg font-mono font-bold tabular-nums leading-none",
                        pctClass(selected.changePct),
                      )}
                    >
                      {fmtPct(selected.changePct)}
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 mt-1">
                      {selected.ticker ?? "—"}
                    </p>
                    {selected.priceSource !== "none" ? (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                        Source:{" "}
                        <span
                          className={cn(
                            "ml-1 inline-flex items-center rounded border px-1.5 py-0.5",
                            selected.priceSource === "live"
                              ? "text-emerald-200 border-emerald-500/25 bg-emerald-500/10"
                              : selected.priceSource === "chart"
                                ? "text-amber-200 border-amber-500/25 bg-amber-500/10"
                                : "text-slate-300 border-white/10 bg-slate-950/40",
                          )}
                          title={selected.fetchError ?? undefined}
                        >
                          {selected.priceSource === "live"
                            ? "LIVE"
                            : selected.priceSource === "chart"
                              ? "1D"
                              : "DB"}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                      Price
                    </p>
                    <p className="mt-1 font-mono text-slate-200 tabular-nums">
                      {selected.price != null &&
                      Number.isFinite(selected.price) &&
                      selected.price > 0
                        ? selected.price >= 1000
                          ? selected.price.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })
                          : selected.price.toFixed(2)
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                      As of
                    </p>
                    <p
                      className="mt-1 font-mono text-[11px] text-slate-400 truncate"
                      title={selected.asOf ?? undefined}
                    >
                      {selected.asOf
                        ? new Date(selected.asOf).toLocaleString("ja-JP", {
                            timeZone: "Asia/Tokyo",
                          })
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="flex items-end justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                        Alpha trend vs VOO
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        日次α（%）と直近30本の累積α（%）
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <p className={cn("text-sm font-mono font-bold tabular-nums", pctClass(latestAlpha))}>
                          {latestAlpha != null ? fmtPct(latestAlpha) : "—"}
                        </p>
                        <p className={cn("text-[11px] font-mono font-bold tabular-nums", pctClass(cumulativeAlpha30d))}>
                          {cumulativeAlpha30d != null ? `${cumulativeAlpha30d > 0 ? "+" : ""}${cumulativeAlpha30d.toFixed(2)}%` : "—"}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
                          30D cum α
                        </p>
                      </div>
                    </div>
                  </div>

                  {alphaLoading ? (
                    <p className="text-[11px] text-slate-500">チャート取得中…</p>
                  ) : alphaError ? (
                    <p className="text-[11px] text-rose-400">{alphaError}</p>
                  ) : cumulativeSeries30d && cumulativeSeries30d.length >= 2 ? (
                    <>
                      <div className="h-[88px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={cumulativeSeries30d}>
                          <YAxis
                            width={28}
                            tick={{ fill: "#94a3b8", fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            domain={["auto", "auto"]}
                          />
                          <Tooltip
                            cursor={{ stroke: "rgba(148,163,184,0.25)" }}
                            contentStyle={{
                              background: "rgba(2,6,23,0.92)",
                              border: "1px solid rgba(255,255,255,0.10)",
                              borderRadius: 12,
                              fontSize: 12,
                            }}
                            labelStyle={{ color: "rgba(148,163,184,0.9)" }}
                            formatter={(value) => {
                              const n = Number(value);
                              if (!Number.isFinite(n)) return ["—", "α"];
                              const sign = n > 0 ? "+" : "";
                              return [`${sign}${n.toFixed(2)}%`, "α"];
                            }}
                            labelFormatter={(label) => `Date: ${String(label)}`}
                          />
                          <Line
                            type="monotone"
                            dataKey="alpha"
                            stroke="rgba(34,211,238,0.9)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="cumulative"
                            stroke="rgba(16,185,129,0.85)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 3 }}
                          />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-500 leading-relaxed">
                        <p>
                          <span className="font-bold text-cyan-300">青</span>：日次α（その日の
                          「素材−VOO」％）。プラスが続くほど、直近で市場（VOO）に対して相対優位。
                        </p>
                        <p>
                          <span className="font-bold text-emerald-300">緑</span>：直近30本の累積α（青の合計）。
                          上向き＝優位が積み上がっている／下向き＝劣後が積み上がっている。
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      表示できる系列がありません（`alpha_history` をバックフィルしてください）。
                    </p>
                  )}
                </div>

                {selected.element.uses && selected.element.uses.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selected.element.uses.map((u) => (
                      <span
                        key={u}
                        className="text-[10px] font-bold tracking-wide text-slate-300 border border-white/10 bg-slate-950/50 px-2 py-1 rounded-full"
                        title={u}
                      >
                        {u}
                      </span>
                    ))}
                  </div>
                ) : null}

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  データは Turso の{" "}
                  <span className="font-mono">alpha_history</span>{" "}
                  （バックフィル済み）から最新2本の終値で算出しています。
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">
                  透明感のあるボーダーと、変化率の熱量で「硬質素材マーケット」を観測します。
                </p>
                <p className="text-[11px] text-slate-600">
                  ヒント:{" "}
                  <span className="font-mono">periodic_table_watchlist</span>{" "}
                  にティッカーを投入し、{" "}
                  <span className="font-mono">alpha_history</span>{" "}
                  をバックフィルすると値が表示されます。
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Table (bottom) */}
      <section className="w-full min-w-0">
        <div className="rounded-2xl border border-white/10 bg-slate-950/30 backdrop-blur-[2px] p-3">
          <div className="overflow-x-auto">
            <div className="min-w-[56rem]">
              <div className="grid grid-cols-18 grid-rows-7 gap-2">
                {Array.from({ length: 7 }).flatMap((_, ry) => {
                  const y = ry + 1;
                  return Array.from({ length: 18 }).map((__, rx) => {
                    const x = rx + 1;
                    const k = `${x},${y}`;
                    const c = byPos.get(k) ?? null;
                    if (!c) {
                      return (
                        <div
                          key={k}
                          className={cn(
                            "min-h-[4.25rem] rounded-xl border border-white/10",
                            "bg-slate-950/20",
                          )}
                          aria-hidden
                        />
                      );
                    }
                    return (
                      <ElementCell
                        key={k}
                        cell={c}
                        selected={selected?.element.symbol === c.element.symbol}
                        onSelect={(next) =>
                          setSelected((cur) =>
                            cur?.element.symbol === next.element.symbol
                              ? null
                              : next,
                          )
                        }
                      />
                    );
                  });
                })}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-slate-500">
            18列レイアウト（モバイルは横スクロール）。騰落率でヒートマップ化（上昇=Emerald / 下落=Rose）。
          </p>
        </div>
      </section>
    </div>
  );
}

