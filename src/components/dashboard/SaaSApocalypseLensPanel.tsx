"use client";

import React, { useEffect, useState } from "react";
import { Flame, Waves } from "lucide-react";

import { cn } from "@/src/lib/cn";

type LensJson = {
  asOf: string;
  lookbackDays: number;
  upstream: string;
  basketTickers: string[];
  corr0: number | null;
  bestLagDays: number;
  bestLagCorr: number | null;
  soxCumulativeReturn: number | null;
  saasCumulativeReturn: number | null;
  reboundPotential: number | null;
  dataOk: boolean;
  error?: string;
};

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}%`;
}

function fmtNum(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

function pctClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-slate-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-400";
}

export function SaaSApocalypseLensPanel() {
  const [lens, setLens] = useState<LensJson | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void fetch("/api/saas-apocalypse-lens?lookbackDays=90", {
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (res) => {
        const j = (await res.json()) as LensJson;
        if (!res.ok) {
          setErr(j.error ?? `HTTP ${res.status}`);
          return;
        }
        setLens(j);
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setErr(e instanceof Error ? e.message : "fetch failed");
      });
    return () => ac.abort();
  }, []);

  const titleTickers = lens?.basketTickers?.length ? lens.basketTickers.join(", ") : "SaaS basket";

  return (
    <section
      aria-labelledby="saas-apoc-lens-heading"
      className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-[#2a0f12]/70 via-slate-950/70 to-slate-950/90 p-5 md:p-6 space-y-4"
    >
      <div className="flex items-start gap-2">
        <Flame size={18} className="text-rose-400/90 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300/90 mb-1">
            Market lens · SaaS Apocalypse
          </p>
          <h2 id="saas-apoc-lens-heading" className="text-lg font-bold text-slate-100 leading-snug">
            上流（半導体）に対する遅行とリバウンド余地
          </h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            上流を <span className="font-mono text-slate-300">^SOX</span>、SaaSを{" "}
            <span className="font-mono text-slate-300">{titleTickers}</span> の等分バスケットで近似。
            日次リターン相関と、相関が最大になる「遅行日数」を表示します。
          </p>
        </div>
      </div>

      {err ? <p className="text-xs text-rose-300 font-bold">{err}</p> : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-800/90 bg-slate-950/40 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Corr (0-lag)</p>
          <p className="font-mono text-xl text-slate-100 mt-1 tabular-nums">
            {lens ? fmtNum(lens.corr0) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800/90 bg-slate-950/40 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Best lag</p>
            <Waves size={14} className="text-cyan-400/80 shrink-0" aria-hidden />
          </div>
          <p className="font-mono text-xl text-slate-100 mt-1 tabular-nums">
            {lens && lens.dataOk ? `${lens.bestLagDays}D` : "—"}
          </p>
          <p className="text-[10px] text-slate-500 font-mono mt-1">r={lens ? fmtNum(lens.bestLagCorr) : "—"}</p>
        </div>
        <div className="rounded-xl border border-slate-800/90 bg-slate-950/40 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Rebound potential</p>
          <p className={cn("font-mono text-xl mt-1 tabular-nums", pctClass(lens?.reboundPotential ?? null))}>
            {lens ? fmtPct(lens.reboundPotential) : "—"}
          </p>
          <p className="text-[10px] text-slate-500 font-mono mt-1">
            SOX {lens ? fmtPct(lens.soxCumulativeReturn) : "—"} / SaaS {lens ? fmtPct(lens.saasCumulativeReturn) : "—"}
          </p>
        </div>
      </div>
    </section>
  );
}

