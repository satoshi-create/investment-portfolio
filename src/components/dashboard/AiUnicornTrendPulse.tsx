"use client";

import React, { useMemo } from "react";

import type { ThemeEcosystemWatchItem } from "@/src/types/investment";
import { cn } from "@/src/lib/cn";

type ProxyPulse = {
  proxy: string;
  score: number;
  regime: "rising" | "fading" | "flat" | "no_data";
  latest: number | null;
  sampleCount: number;
};

function lastFinite(xs: number[]): number | null {
  for (let i = xs.length - 1; i >= 0; i--) {
    const v = xs[i]!;
    if (Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * Simple slope over the last N points of cumulative alpha.
 * Positive => rising heat, negative => fading.
 */
function slopeOverLast(history: number[], n: number): number | null {
  const h = Array.isArray(history) ? history.filter((v) => Number.isFinite(v)) : [];
  if (h.length < Math.max(3, n)) return null;
  const slice = h.slice(-n);
  const first = slice[0]!;
  const last = slice[slice.length - 1]!;
  return (last - first) / Math.max(1, slice.length - 1);
}

function regimeFromScore(score: number | null): ProxyPulse["regime"] {
  if (score == null || !Number.isFinite(score)) return "no_data";
  if (score >= 0.08) return "rising";
  if (score <= -0.08) return "fading";
  return "flat";
}

function regimeLabelJa(r: ProxyPulse["regime"]): string {
  if (r === "rising") return "上昇";
  if (r === "fading") return "失速";
  if (r === "flat") return "横ばい";
  return "データ不足";
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function AiUnicornTrendPulse({ ecosystem }: { ecosystem: ThemeEcosystemWatchItem[] }) {
  const proxies = useMemo(() => {
    const byProxy = new Map<string, number[]>();
    for (const e of ecosystem) {
      if (!e.isUnlisted) continue;
      const p = (e.proxyTicker ?? "").trim().toUpperCase();
      if (p.length === 0) continue;
      if (!byProxy.has(p)) byProxy.set(p, []);
      byProxy.get(p)!.push(...(Array.isArray(e.alphaHistory) ? e.alphaHistory : []));
    }

    const out: ProxyPulse[] = [];
    for (const [proxy, merged] of byProxy.entries()) {
      const score = slopeOverLast(merged, 10);
      const latest = lastFinite(merged);
      out.push({
        proxy,
        score: score ?? 0,
        regime: regimeFromScore(score),
        latest,
        sampleCount: merged.length,
      });
    }

    // Sort by absolute score (most "changing" proxies first), then by latest.
    out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    return out;
  }, [ecosystem]);

  const themeScore =
    proxies.length > 0 ? proxies.reduce((s, p) => s + (Number.isFinite(p.score) ? p.score : 0), 0) / proxies.length : 0;
  const themeRegime = regimeFromScore(themeScore);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
            AI Trend Pulse (Surface)
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="text-sm font-bold text-slate-200">
              影の地合い:{" "}
              <span
                className={cn(
                  themeRegime === "rising"
                    ? "text-emerald-300"
                    : themeRegime === "fading"
                      ? "text-rose-300"
                      : themeRegime === "flat"
                        ? "text-slate-300"
                        : "text-slate-500",
                )}
              >
                {regimeLabelJa(themeRegime)}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              直近傾き（10点）:{" "}
              <span className="font-mono text-slate-400">{fmtPct(themeScore)}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            未上場の“地表”は proxy の累積Alphaで観測（値が動いたところだけを先に読む）
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
            Proxies
          </p>
          <p className="text-sm font-bold text-slate-200">{proxies.length}</p>
        </div>
      </div>

      {proxies.length === 0 ? (
        <p className="text-xs text-slate-600">proxy_ticker が設定された未上場銘柄がありません</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {proxies.slice(0, 6).map((p) => (
            <div
              key={p.proxy}
              className="rounded-xl border border-slate-800 bg-slate-950/30 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-200 font-mono truncate">
                    {p.proxy}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    影の転調:{" "}
                    <span
                      className={cn(
                        p.regime === "rising"
                          ? "text-emerald-300"
                          : p.regime === "fading"
                            ? "text-rose-300"
                            : p.regime === "flat"
                              ? "text-slate-300"
                              : "text-slate-500",
                      )}
                    >
                      {regimeLabelJa(p.regime)}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-slate-500">
                    傾き{" "}
                    <span className="font-mono text-slate-400">
                      {fmtPct(p.score)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    CUM α{" "}
                    <span className="font-mono text-slate-400">
                      {fmtPct(p.latest)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-slate-600 font-mono">
                samples={p.sampleCount}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

