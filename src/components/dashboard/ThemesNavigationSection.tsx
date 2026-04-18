import React from "react";
import Link from "next/link";
import { Layout, Radar } from "lucide-react";

import { EcosystemCumulativeSparkline } from "@/src/components/dashboard/EcosystemCumulativeSparkline";
import type { InvestmentThemeRecord } from "@/src/types/investment";

const AI_UNICORNS_THEME_NAME = "AIユニコーン";

function excerpt(text: string | null, max = 96): string {
  if (text == null) return "";
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export function ThemesNavigationSection(props: {
  themes: InvestmentThemeRecord[];
  inPortfolioThemeNames: Set<string>;
  /** `theme_id` → 直近 ~90 日の加重累積 Alpha（構造トレンドと同系列の要約） */
  structuralSparklineByThemeId?: Record<string, number[]>;
}) {
  const { themes, inPortfolioThemeNames, structuralSparklineByThemeId } = props;

  if (themes.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl border border-border bg-muted/40 flex items-center justify-center">
            <Layout size={16} className="text-cyan-300" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              構造投資テーマ
            </div>
            <div className="text-sm text-foreground/90">
              各カードの「年輪」で累積 Alpha の方向を俯瞰し、詳細へジャンプできます
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Link
            href={`/themes/${encodeURIComponent(AI_UNICORNS_THEME_NAME)}`}
            className="text-[10px] font-bold uppercase tracking-wide text-violet-300 border border-violet-500/35 bg-violet-500/5 px-3 py-2 rounded-lg hover:bg-violet-500/10 transition-all inline-flex items-center gap-2"
            title="AIユニコーン（未上場×資本の源流）へ"
          >
            <span className="text-[12px] leading-none">AI</span>
            AIユニコーン
          </Link>
          <Link
            href="/etf-collection"
            className="text-[10px] font-bold uppercase tracking-wide text-cyan-300 border border-cyan-500/35 bg-cyan-500/5 px-3 py-2 rounded-lg hover:bg-cyan-500/10 transition-all inline-flex items-center gap-2"
            title="Global Strata（ETF Collection）へ"
          >
            <Radar size={14} />
            Global Strata
          </Link>
          <div className="text-[10px] text-muted-foreground font-mono">{themes.length} themes</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {themes.map((t) => {
          const name = (t.name ?? "").trim();
          const href = `/themes/${encodeURIComponent(name)}`;
          const inPortfolio = inPortfolioThemeNames.has(name);
          const badgeLabel = inPortfolio ? "In Portfolio" : "Researching";
          const badgeClass = inPortfolio
            ? "border-emerald-400/40 text-emerald-300 bg-emerald-500/10"
            : "border-slate-400/25 text-slate-300 bg-slate-500/10";
          const desc = excerpt(t.description, 110);

          return (
            <Link
              key={t.id}
              href={href}
              className="group rounded-2xl border border-border bg-background/10 hover:bg-muted/30 transition-colors p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-foreground/95 truncate group-hover:text-foreground">
                    {name}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {desc.length > 0 ? desc : "（説明は未登録です）"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${badgeClass}`}>
                    {badgeLabel}
                  </span>
                  <div
                    className="opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none"
                    title="直近の構造トレンド（加重累積 Alpha）"
                  >
                    <EcosystemCumulativeSparkline
                      history={structuralSparklineByThemeId?.[t.id] ?? []}
                      variant="compact"
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

