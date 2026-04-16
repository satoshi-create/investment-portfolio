"use client";

import React, { useEffect, useState } from "react";
import { Activity, Binoculars, LineChart } from "lucide-react";

import { cn } from "@/src/lib/cn";
import {
  equipmentFieldSummary,
  SEMICONDUCTOR_EQUIPMENT_CATALOG,
} from "@/src/lib/semiconductor-equipment-catalog";

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

export function SemiconductorEquipmentObservationPanel() {
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

  const fieldBuckets = equipmentFieldSummary(SEMICONDUCTOR_EQUIPMENT_CATALOG);

  return (
    <section
      aria-labelledby="semi-equip-obs-heading"
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
            Market lens · 観測精度
          </p>
          <h2
            id="semi-equip-obs-heading"
            className="text-lg font-bold text-slate-100 leading-snug"
          >
            半導体サイクルと装置需要の読み筋
          </h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            データセットはチェーン全体を含むため、本テーマでは
            <span className="text-slate-400">「装置・検査・露光・後工程ツール」</span>
            に限定してウォッチしています。SOX
            は装置〜チップ全体のベータ感、NDX は AI 資本支出サイドの温度計として併読すると分解が進みます。
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
              <span className="text-slate-300">ファウンドリ設備投資（WFE）</span>
              ：先端ロジックの増産計画・稼働率と、メモリの建て直し局面を分けて見る。
            </li>
            <li>
              <span className="text-slate-300">メモリ ASP</span>
              ：NAND/DRAM の価格反転は後工程〜テスト需要に遅れて波及しやすい。
            </li>
            <li>
              <span className="text-slate-300">地政学・輸出規制</span>
              ：露光・検査・EDA など「境界デバイス」はイベントで SOX 対βが跳ねやすい。
            </li>
            <li>
              <span className="text-slate-300">エコシステム表の Z・落率</span>
              ：テーマ構造トレンドが上でも個別が冷え込むときは在庫調整フェーズのサインになり得る。
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
            元 CSV:{" "}
            <span className="font-mono text-slate-500">src/lib/semiconducter-data.csv</span>
            。銘柄ティッカーは公開情報に基づき正規化。
          </p>
        </div>
      </div>
    </section>
  );
}
