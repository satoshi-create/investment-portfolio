"use client";

import React from "react";
import { Bitcoin, Layers, Pickaxe } from "lucide-react";

import { cn } from "@/src/lib/cn";

export type StructuralBtcGlancePayload = {
  asOf: string;
  btcUsd: { close: number | null; changePct: number | null; date: string | null };
  ibit: { close: number | null; changePct: number | null; date: string | null };
  error?: string;
};

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function pctClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-muted-foreground";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function fmtUsd0(v: number | null): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtUsd2(v: number | null): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function BitcoinStructuralHeaderAside(props: {
  glance: StructuralBtcGlancePayload | null;
  error: string | null;
  loading: boolean;
}) {
  const { glance, error, loading } = props;

  return (
    <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto sm:max-w-[20rem]">
      <div className="grid grid-cols-2 gap-2">
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-right",
            "border-amber-500/25 bg-gradient-to-br from-amber-950/30 to-card/60",
          )}
        >
          <p className="text-[9px] font-bold uppercase tracking-wider text-amber-500/90 flex items-center justify-end gap-1">
            <Bitcoin size={12} className="opacity-90" aria-hidden />
            BTC-USD
          </p>
          {loading && !glance ? (
            <p className="text-xs text-muted-foreground mt-2">取得中…</p>
          ) : error ? (
            <p className="text-xs text-rose-400 mt-2">{error}</p>
          ) : (
            <>
              <p className="font-mono text-lg text-foreground mt-1">
                {fmtUsd0(glance?.btcUsd.close ?? null)}
              </p>
              <p className={cn("font-mono text-[11px] mt-0.5", pctClass(glance?.btcUsd.changePct ?? null))}>
                {fmtPct(glance?.btcUsd.changePct ?? null)}
              </p>
            </>
          )}
        </div>
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-right",
            "border-amber-500/20 bg-card/60",
          )}
        >
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            IBIT <span className="text-[8px] font-normal normal-case">(spot ETF proxy)</span>
          </p>
          {loading && !glance ? (
            <p className="text-xs text-muted-foreground mt-2">取得中…</p>
          ) : error ? (
            <p className="text-xs text-rose-400/90 mt-2">—</p>
          ) : (
            <>
              <p className="font-mono text-lg text-foreground mt-1">
                {fmtUsd2(glance?.ibit.close ?? null)}
              </p>
              <p className={cn("font-mono text-[11px] mt-0.5", pctClass(glance?.ibit.changePct ?? null))}>
                {fmtPct(glance?.ibit.changePct ?? null)}
              </p>
            </>
          )}
        </div>
      </div>
      {glance?.asOf ? (
        <p className="text-[9px] text-muted-foreground text-right font-mono">
          ref: {new Date(glance.asOf).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}

const LAYERS: readonly { title: string; body: string }[] = [
  {
    title: "供給構造",
    body: "半減期・発行スケジュールに基づく希少性。S2F 乖離など「コード上の供給」と価格のズレを見る。",
  },
  {
    title: "需要構造",
    body: "現物 ETF フロー（IBIT 等）で機関の配分・積み上げを読む。個人投機から資産クラス化へのシフトのバロメータ。",
  },
  {
    title: "流動性・保有",
    body: "取引所残高の枯れ、長短保有者バランス。売りに出せる BTC が減るほど底の硬さが増す、という視点。",
  },
  {
    title: "コスト・採掘",
    body: "ハッシュレートとマイナー採算。ネットワークのセキュリティ投資と「降伏」局面はサイクルのフロア付近の手掛かりになりうる。",
  },
];

export function BitcoinStructuralObservationPanel(props: {
  glance: StructuralBtcGlancePayload | null;
  glanceError: string | null;
}) {
  const { glance, glanceError } = props;

  return (
    <section
      aria-labelledby="btc-structural-obs-heading"
      className={cn(
        "rounded-2xl border p-5 md:p-6 space-y-5",
        "border-amber-500/20 bg-gradient-to-br from-amber-950/25 via-background to-background",
      )}
    >
      <div className="flex items-start gap-2">
        <Layers size={18} className="text-amber-500/90 shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/85 mb-1">
            Structure lens · ビットコイン
          </p>
          <h2
            id="btc-structural-obs-heading"
            className="text-lg font-bold text-foreground leading-snug"
          >
            価格だけでなく「背後の構造」を並べて読む
          </h2>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            下の{" "}
            <span className="font-semibold text-foreground/90">構造トレンド（加重累積 Alpha）</span>
            はテーマ内の銘柄・ウォッチの相対動きの要約、エコシステム表は銘柄単位の Z・累積との{" "}
            <span className="text-amber-200/90">ミクロのずれ</span>
            です。BTC 特有のオンチェーン・ETF 系列はこのパネルから順次接続予定です。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card/50 px-4 py-3">
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            <Bitcoin size={12} className="text-amber-500/85" aria-hidden />
            現物参照 · BTC-USD
          </div>
          {glanceError ? (
            <p className="text-xs text-rose-400 mt-2">{glanceError}</p>
          ) : (
            <>
              <p className="font-mono text-xl font-bold text-foreground mt-1">
                {fmtUsd0(glance?.btcUsd.close ?? null)}
              </p>
              <p className={cn("font-mono text-sm", pctClass(glance?.btcUsd.changePct ?? null))}>
                {fmtPct(glance?.btcUsd.changePct ?? null)}
              </p>
            </>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card/50 px-4 py-3">
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            <Pickaxe size={12} className="text-amber-500/80" aria-hidden />
            需要プロキシ · IBIT
          </div>
          {glanceError ? (
            <p className="text-xs text-rose-400 mt-2">{glanceError}</p>
          ) : (
            <>
              <p className="font-mono text-xl font-bold text-foreground mt-1">
                {fmtUsd2(glance?.ibit.close ?? null)}
              </p>
              <p className={cn("font-mono text-sm", pctClass(glance?.ibit.changePct ?? null))}>
                {fmtPct(glance?.ibit.changePct ?? null)}
              </p>
            </>
          )}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          四層の観測フレーム（指標は順次接続）
        </p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {LAYERS.map((layer) => (
            <li
              key={layer.title}
              className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-[11px] leading-relaxed"
            >
              <span className="font-mono text-amber-500/95 text-[10px] uppercase tracking-wide">
                {layer.title}
              </span>
              <span className="text-muted-foreground"> — {layer.body}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
