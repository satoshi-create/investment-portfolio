"use client";

import React from "react";

import { OilThemeMacroChart } from "@/src/components/dashboard/OilThemeMacroChart";
import type { OilThemeMacroContext } from "@/src/types/investment";

function pctTone(changePct: number): string {
  if (!Number.isFinite(changePct)) return "text-muted-foreground";
  if (changePct > 0) return "text-emerald-400";
  if (changePct < 0) return "text-rose-400";
  return "text-muted-foreground";
}

export function OilThemeMacroPanel({ context }: { context: OilThemeMacroContext }) {
  return (
    <section
      aria-labelledby="oil-macro-panel-heading"
      className="rounded-2xl border border-amber-500/20 bg-card/40 p-4 md:p-5 space-y-4 shadow-lg"
    >
      <div className="space-y-1">
        <h2
          id="oil-macro-panel-heading"
          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
        >
          原油マクロ（テーマ対照）
        </h2>
        <p className="text-[10px] text-muted-foreground leading-relaxed max-w-3xl">
          WTI / Brent / USO（Yahoo Finance）。スポットはグローバル Market glance の USO と同一シンボル・ラベルです。下段チャートと相関の定義は{" "}
          <span className="font-mono text-[9px]">docs/oil-theme-macro-context.md</span> を参照。
        </p>
        {context.asOf != null ? (
          <p className="text-[9px] font-mono text-muted-foreground/90">CL=F as of {context.asOf}</p>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {context.indicators.map((m) => {
          const ok = m.value > 0 && Number.isFinite(m.value);
          return (
            <div
              key={m.label}
              className="rounded-xl border border-border bg-background/40 px-3 py-2.5"
            >
              <p className="text-[10px] font-bold text-muted-foreground">{m.label}</p>
              <p className="mt-1 font-mono text-sm font-bold text-foreground tabular-nums">
                {ok ? m.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
              </p>
              <p className={`mt-0.5 text-[10px] font-mono ${pctTone(m.changePct)}`}>
                {Number.isFinite(m.changePct) ? (
                  <>
                    {m.changePct > 0 ? "+" : ""}
                    {m.changePct.toFixed(2)}% 1D
                  </>
                ) : (
                  "前日比 —"
                )}
              </p>
            </div>
          );
        })}
      </div>

      {context.chart != null && context.chart.points.length > 1 ? (
        <OilThemeMacroChart data={context.chart} />
      ) : (
        <p className="text-[10px] text-muted-foreground">
          構造トレンド系列が短いか、WTI 日足と重なる日付が不足しているため、対照チャートは省略されました。
        </p>
      )}
    </section>
  );
}
