"use client";

import React, { useMemo } from "react";
import type { ThemeEcosystemWatchItem } from "@/src/types/investment";
import { cn } from "@/src/lib/cn";
import {
  jtcRefactoringPhaseIndex,
  jtcRefactoringPhaseLabelJa,
  parseJtcRefactoringNotes,
  type JtcRefactoringPhase,
  JTC_REFACTORING_PHASE_ORDER,
} from "@/src/lib/jtc-refactoring-theme";

const ACCENT_EDO = "#7058a3";
const ACCENT_WARN = "#eb6ea5";
const ACCENT_TERM = "#34d399";

function MeterBar({
  label,
  value,
  hint,
  accentClass,
}: {
  label: string;
  value: number | null;
  hint?: string;
  accentClass: string;
}) {
  const v = value != null && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground/90">
        <span>{label}</span>
        <span className="font-mono text-foreground/90">{v != null ? `${v}` : "—"}</span>
      </div>
      <div
        className="h-1.5 w-full rounded-full bg-black/40 border border-white/10 overflow-hidden"
        title={hint}
      >
        <div
          className={cn("h-full rounded-full transition-all", accentClass)}
          style={{ width: v != null ? `${v}%` : "0%" }}
        />
      </div>
    </div>
  );
}

function PhaseRail({ phase }: { phase: JtcRefactoringPhase }) {
  const idx = jtcRefactoringPhaseIndex(phase);
  return (
    <div className="flex items-center gap-1.5 flex-wrap" aria-label={`介入フェーズ: ${jtcRefactoringPhaseLabelJa(phase)}`}>
      {JTC_REFACTORING_PHASE_ORDER.map((p, i) => {
        const active = i <= idx;
        const current = i === idx;
        return (
          <span key={p} className="flex items-center gap-1.5">
            {i > 0 ? (
              <span className="text-[9px] text-muted-foreground/50" aria-hidden>
                →
              </span>
            ) : null}
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-bold border",
                current
                  ? "border-[#eb6ea5] text-[#eb6ea5] bg-[#eb6ea5]/10"
                  : active
                    ? "border-emerald-500/50 text-emerald-300/90 bg-emerald-500/10"
                    : "border-white/10 text-muted-foreground/70 bg-black/20",
              )}
            >
              {jtcRefactoringPhaseLabelJa(p)}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function RefactoringMetricsCard({ item }: { item: ThemeEcosystemWatchItem }) {
  const parsed = useMemo(
    () => parseJtcRefactoringNotes(item.observationNotes),
    [item.observationNotes],
  );

  return (
    <article
      className={cn(
        "rounded-xl border p-3 space-y-3 min-w-0",
        "bg-[#12141a]/90 border-[#7058a3]/35 shadow-[inset_0_1px_0_0_rgba(112,88,163,0.12)]",
      )}
      style={{ borderColor: `${ACCENT_EDO}55` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-mono font-bold text-emerald-300/95">{item.ticker}</p>
          <p className="text-xs font-semibold text-foreground truncate" title={item.companyName}>
            {item.companyName}
          </p>
          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5" title={item.field}>
            {item.field}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[#7058a3]">Refactoring status</p>
        <PhaseRail phase={parsed.phase} />
      </div>

      <MeterBar
        label="Technical debt（仮想）"
        value={parsed.techDebtScore}
        hint="PBR・現金比率の代理。高いほど「焼き直し余地」寄りのシナリオ表示"
        accentClass="bg-gradient-to-r from-[#7058a3] to-[#eb6ea5]"
      />
      <MeterBar
        label="Physical bottleneck（仮想）"
        value={parsed.bottleneckVirtual}
        hint="在庫・物流・素材の目詰まり指す仮想ゲージ"
        accentClass="bg-gradient-to-r from-amber-500/80 to-rose-500/80"
      />

      {parsed.activistLine ? (
        <div className="rounded-md border border-[#eb6ea5]/25 bg-[#eb6ea5]/5 px-2 py-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wide text-[#eb6ea5] mb-0.5">
            Activist / 再編
          </p>
          <p className="text-[10px] text-foreground/85 leading-snug">{parsed.activistLine}</p>
        </div>
      ) : null}
      {parsed.structuralLine ? (
        <p className="text-[10px] text-muted-foreground border-t border-white/5 pt-2">
          <span className="font-mono text-emerald-400/90">$ </span>
          {parsed.structuralLine}
        </p>
      ) : null}
    </article>
  );
}

export function JtcRefactoringCockpitPanel({
  ecosystem,
}: {
  ecosystem: ThemeEcosystemWatchItem[];
}) {
  const summary = useMemo(() => {
    let tech = 0;
    let techN = 0;
    let bottle = 0;
    let bottleN = 0;
    const phaseCount: Record<JtcRefactoringPhase, number> = {
      Legacy: 0,
      Patched: 0,
      Compiling: 0,
      Deployed: 0,
    };
    for (const e of ecosystem) {
      const p = parseJtcRefactoringNotes(e.observationNotes);
      phaseCount[p.phase] += 1;
      if (p.techDebtScore != null) {
        tech += p.techDebtScore;
        techN += 1;
      }
      if (p.bottleneckVirtual != null) {
        bottle += p.bottleneckVirtual;
        bottleN += 1;
      }
    }
    return {
      avgTech: techN > 0 ? Math.round(tech / techN) : null,
      avgBottleneck: bottleN > 0 ? Math.round(bottle / bottleN) : null,
      phaseCount,
    };
  }, [ecosystem]);

  return (
    <section
      aria-labelledby="jtc-refactoring-cockpit-heading"
      className={cn(
        "rounded-2xl border p-5 md:p-6 space-y-5",
        "bg-gradient-to-b from-[#151822] to-[#0d0f14]",
      )}
      style={{ borderColor: `${ACCENT_EDO}44` }}
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p
              id="jtc-refactoring-cockpit-heading"
              className="text-xs font-bold uppercase tracking-[0.2em] text-[#7058a3]"
            >
              JTC · Refactoring cockpit
            </p>
            <h2 className="text-lg font-bold text-foreground mt-1">
              レガシーOSのデバッグとマージ
            </h2>
            <p className="text-[11px] text-muted-foreground max-w-2xl mt-1 leading-relaxed">
              江戸紫基調のサーバー室UI。朱（
              <span style={{ color: ACCENT_WARN }}>介入・パッチ</span>
              ）とターミナル緑（
              <span style={{ color: ACCENT_TERM }}>デプロイ完了</span>
              ）でフェーズを読む。数値の一部は仮想メーター（シード/メモ）です。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            className="rounded-lg border border-white/10 bg-black/25 px-3 py-2"
            style={{ boxShadow: `inset 0 0 0 1px ${ACCENT_EDO}22` }}
          >
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              Avg · Tech debt
            </p>
            <p className="text-xl font-mono font-bold text-foreground/95">
              {summary.avgTech != null ? summary.avgTech : "—"}
            </p>
          </div>
          <div
            className="rounded-lg border border-white/10 bg-black/25 px-3 py-2"
            style={{ boxShadow: `inset 0 0 0 1px ${ACCENT_EDO}22` }}
          >
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              Avg · Bottleneck
            </p>
            <p className="text-xl font-mono font-bold text-foreground/95">
              {summary.avgBottleneck != null ? summary.avgBottleneck : "—"}
            </p>
          </div>
          <div
            className="rounded-lg border border-white/10 bg-black/25 px-3 py-2"
            style={{ boxShadow: `inset 0 0 0 1px ${ACCENT_EDO}22` }}
          >
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              Phase mix
            </p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              レガシー {summary.phaseCount.Legacy} · パッチ {summary.phaseCount.Patched} · ビルド{" "}
              {summary.phaseCount.Compiling} · 本番 {summary.phaseCount.Deployed}
            </p>
          </div>
        </div>
      </header>

      {ecosystem.length === 0 ? (
        <p className="text-sm text-muted-foreground">テーマのウォッチ銘柄がまだありません。</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {ecosystem.map((e) => (
            <RefactoringMetricsCard key={e.id} item={e} />
          ))}
        </div>
      )}
    </section>
  );
}
