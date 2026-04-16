"use client";

import React, { useEffect, useState } from "react";
import { Activity, Binoculars, LineChart } from "lucide-react";

import { cn } from "@/src/lib/cn";
import {
  supplyChainFieldSummary,
  type SemiconductorSupplyChainCatalogRow,
  SEMICONDUCTOR_SUPPLY_CHAIN_CSV_FILENAME,
} from "@/src/lib/semiconductor-supply-chain-catalog";

type LensJson = {
  asOf: string;
  sox: { close: number | null; changePct: number | null; date: string | null };
  ndx: { close: number | null; changePct: number | null; date: string | null };
  error?: string;
};

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function pctClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-slate-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-400";
}

export function SemiconductorSupplyChainObservationPanel(props: {
  rows: readonly SemiconductorSupplyChainCatalogRow[];
}) {
  const { rows } = props;
  const [lens, setLens] = useState<LensJson | null>(null);
  const [lensErr, setLensErr] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void fetch("/api/semiconductor-market-lens", { cache: "no-store", signal: ac.signal })
      .then(async (res) => {
        const j = (await res.json()) as LensJson & { error?: string };
        if (!res.ok) {
          setLensErr(j.error ?? `HTTP ${res.status}`);
          return;
        }
        setLens(j);
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setLensErr(e instanceof Error ? e.message : "fetch failed");
      });
    return () => ac.abort();
  }, []);

  const fieldBuckets = supplyChainFieldSummary(rows);

  return (
    <section
      aria-labelledby="semi-sc-obs-heading"
      className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 to-slate-950/90 p-5 md:p-6 space-y-5"
    >
      <div className="flex items-start gap-2">
        <Binoculars
          size={18}
          className="text-violet-400/90 shrink-0 mt-0.5"
          aria-hidden
        />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400/90 mb-1">
            Market lens · サプライチェーン観測
          </p>
          <h2
            id="semi-sc-obs-heading"
            className="text-lg font-bold text-slate-100 leading-snug"
          >
            半導体サイクルとチェーン全体の読み筋
          </h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            <span className="text-slate-400">材料・装置・設計・製造・後工程</span>
            を同一テーマで追い、SOX はチェーン全体のベータ、NDX は AI 資本支出の温度計として併読すると分解が進みます。未上場銘柄は
            <span className="font-mono text-slate-500"> N/A:… </span>
            行＋プロキシで Alpha を代理観測します。
          </p>
          <p className="text-[10px] text-slate-600 mt-2 font-mono">
            カタログ {rows.length} 社（{SEMICONDUCTOR_SUPPLY_CHAIN_CSV_FILENAME} 準拠）
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">
            <LineChart size={12} className="text-violet-400/80" aria-hidden />
            PHLX Semiconductor (^SOX)
          </div>
          {lensErr ? (
            <p className="text-xs text-rose-400 mt-2">{lensErr}</p>
          ) : lens ? (
            <>
              <p className="font-mono text-xl text-slate-100 mt-1 tabular-nums">
                {lens.sox.close != null
                  ? lens.sox.close.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : "—"}
              </p>
              <p className={cn("text-sm font-mono font-bold mt-0.5", pctClass(lens.sox.changePct))}>
                {fmtPct(lens.sox.changePct)}
                <span className="text-[10px] font-normal text-slate-600 ml-2">
                  {lens.sox.date ? `as of ${lens.sox.date}` : ""}
                </span>
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500 mt-2">読み込み中…</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">
            <Activity size={12} className="text-cyan-400/80" aria-hidden />
            NASDAQ-100 (^NDX) — AI 需要プロキシ
          </div>
          {lensErr ? (
            <p className="text-xs text-rose-400 mt-2">{lensErr}</p>
          ) : lens ? (
            <>
              <p className="font-mono text-xl text-slate-100 mt-1 tabular-nums">
                {lens.ndx.close != null
                  ? lens.ndx.close.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : "—"}
              </p>
              <p className={cn("text-sm font-mono font-bold mt-0.5", pctClass(lens.ndx.changePct))}>
                {fmtPct(lens.ndx.changePct)}
                <span className="text-[10px] font-normal text-slate-600 ml-2">
                  {lens.ndx.date ? `as of ${lens.ndx.date}` : ""}
                </span>
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500 mt-2">読み込み中…</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800/90 bg-slate-950/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            観測チェックリスト（定性）
          </p>
          <ul className="text-xs text-slate-400 space-y-2 leading-relaxed list-disc pl-4">
            <li>
              <span className="text-slate-300">材料 vs 装置 vs 設計</span>
              ：同じ SOX 上昇でも、どのレイヤーがリードしているかをエコシステム表の相対 Z で切る。
            </li>
            <li>
              <span className="text-slate-300">ファウンドリ・メモリ</span>
              ：増産コメントとメモリ ASP の組み合わせで、設備投資の質（持続か一発か）を見極める。
            </li>
            <li>
              <span className="text-slate-300">地政学・輸出規制</span>
              ：装置・EDA・先端ロジックはイベントでチェーン内相関が崩れやすい。
            </li>
            <li>
              <span className="text-slate-300">未上場（N/A:）行</span>
              ：プロキシは流動性の代表であって本体ではない。ニュース確認と併用する。
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800/90 bg-slate-950/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            データセット内訳（Field）
          </p>
          <div className="flex flex-wrap gap-2">
            {fieldBuckets.map(({ field, count }) => (
              <span
                key={field}
                className="text-[11px] font-bold text-slate-300 border border-slate-700 bg-slate-900/60 px-2.5 py-1 rounded-md"
              >
                {field}
                <span className="text-violet-400/90 ml-1 tabular-nums">{count}</span>
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 mt-3 leading-relaxed">
            元データ:{" "}
            <span className="font-mono text-slate-500">src/lib/{SEMICONDUCTOR_SUPPLY_CHAIN_CSV_FILENAME}</span>
            。信越化学工業は CSV 2 行を 4063 に統合。ティッカー誤結合・欠損はコード側で補正（DB の observation_notes 参照）。
          </p>
        </div>
      </div>
    </section>
  );
}
