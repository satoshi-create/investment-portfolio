"use client";

import React, { useMemo } from "react";

import type { CreditStreamSlice } from "@/src/lib/unicorn-credit-stream";
import { parseCreditStream } from "@/src/lib/unicorn-credit-stream";
import type { ThemeEcosystemWatchItem } from "@/src/types/investment";
import { cn } from "@/src/lib/cn";

type CreditCategory = "big_tech" | "private_credit" | "vc_growth" | "other";

function classifyLabel(label: string): CreditCategory {
  const s = label.trim().toLowerCase();
  if (s.length === 0) return "other";

  // Big Tech / strategic
  if (
    s.includes("amazon") ||
    s.includes("aws") ||
    s.includes("google") ||
    s.includes("alphabet") ||
    s.includes("microsoft") ||
    s.includes("openai") ||
    s.includes("nvidia") ||
    s.includes("oracle")
  ) {
    return "big_tech";
  }

  // Private credit / alt managers
  if (
    s.includes("apollo") ||
    s.includes("blackstone") ||
    s.includes("ares") ||
    s.includes("kkr") ||
    s.includes("carlyle") ||
    s.includes("bain") ||
    s.includes("tpg")
  ) {
    return "private_credit";
  }

  // VC / growth equity (very rough)
  if (s.includes("sequoia") || s.includes("a16z") || s.includes("andreessen") || s.includes("accel")) {
    return "vc_growth";
  }

  return "other";
}

function categoryLabelJa(c: CreditCategory): string {
  if (c === "big_tech") return "Big Tech";
  if (c === "private_credit") return "Private Credit";
  if (c === "vc_growth") return "VC/Growth";
  return "Other";
}

function categoryColor(c: CreditCategory): string {
  if (c === "big_tech") return "bg-sky-500/60";
  if (c === "private_credit") return "bg-amber-500/70";
  if (c === "vc_growth") return "bg-emerald-500/60";
  return "bg-slate-500/40";
}

function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
}

function top1Share(slices: CreditStreamSlice[]): number | null {
  if (slices.length === 0) return null;
  const m = Math.max(...slices.map((x) => (Number.isFinite(x.weightPct) ? x.weightPct : 0)));
  return Number.isFinite(m) && m > 0 ? m : null;
}

export function AiUnicornCreditSeam({ ecosystem }: { ecosystem: ThemeEcosystemWatchItem[] }) {
  const { categoryTotals, concentrationTop } = useMemo(() => {
    const totals: Record<CreditCategory, number> = {
      big_tech: 0,
      private_credit: 0,
      vc_growth: 0,
      other: 0,
    };

    const perCompany: { id: string; name: string; top1: number | null; topLabel: string | null }[] = [];

    const unlisted = ecosystem.filter((e) => e.isUnlisted);
    const n = Math.max(1, unlisted.length);

    for (const e of unlisted) {
      const slices = parseCreditStream(e.privateCreditBacking);
      const sums: Record<CreditCategory, number> = { big_tech: 0, private_credit: 0, vc_growth: 0, other: 0 };
      for (const s of slices) {
        const cat = classifyLabel(s.label);
        sums[cat] += s.weightPct;
      }
      // Equal-weight across companies to avoid one verbose credit string dominating.
      for (const k of Object.keys(totals) as CreditCategory[]) totals[k] += (sums[k] ?? 0) / n;

      const top = slices[0] ?? null;
      perCompany.push({
        id: e.id,
        name: e.companyName,
        top1: top1Share(slices),
        topLabel: top?.label ?? null,
      });
    }

    const concentrationTop = perCompany
      .filter((x) => x.top1 != null)
      .sort((a, b) => (b.top1 ?? 0) - (a.top1 ?? 0))
      .slice(0, 6);

    return { categoryTotals: totals, concentrationTop };
  }, [ecosystem]);

  const total = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const normalized = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  const bars = (Object.keys(categoryTotals) as CreditCategory[])
    .map((k) => ({ key: k, pct: normalized(categoryTotals[k] ?? 0) }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
            Credit seam (Underground)
          </p>
          <div className="text-sm font-bold text-slate-200">
            地下水脈の内訳:{" "}
            <span className="text-slate-400 font-mono">
              {bars
                .map((b) => `${categoryLabelJa(b.key)} ${b.pct.toFixed(0)}%`)
                .join(" / ")}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            太さ（比率）だけでなく、「誰の資本か」と「水源の偏り」を先行指標として読む
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Category mix
          </p>
          <div className="flex h-3 w-full overflow-hidden rounded-full border border-slate-800 bg-slate-950/60">
            {bars.map((b) => (
              <div
                key={b.key}
                className={cn("h-full", categoryColor(b.key))}
                style={{ width: `${Math.max(2, Math.min(100, b.pct))}%` }}
                title={`${categoryLabelJa(b.key)} ${b.pct.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {bars.map((b) => (
              <span key={b.key} className="text-[11px] text-slate-500">
                <span className="font-semibold text-slate-300">{categoryLabelJa(b.key)}</span>{" "}
                <span className="font-mono text-slate-400">{fmtPct(b.pct)}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Concentration risk (Top-1)
          </p>
          {concentrationTop.length === 0 ? (
            <p className="text-xs text-slate-600">`private_credit_backing` が未登録です</p>
          ) : (
            <div className="space-y-2">
              {concentrationTop.map((x) => {
                const top = x.top1 ?? 0;
                const risk =
                  top >= 70 ? "high" : top >= 55 ? "med" : "low";
                return (
                  <div key={x.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-200 truncate">
                        {x.name}
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono truncate">
                        top={x.topLabel ?? "—"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border",
                          risk === "high"
                            ? "border-rose-500/40 text-rose-200 bg-rose-500/10"
                            : risk === "med"
                              ? "border-amber-500/35 text-amber-200 bg-amber-500/10"
                              : "border-slate-500/30 text-slate-300 bg-slate-500/10",
                        )}
                        title="Top-1 share"
                      >
                        {top.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

