"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

import { DashboardHeader } from "@/src/components/dashboard/DashboardHeader";
import { PeriodicTableBoard } from "@/src/components/dashboard/PeriodicTableBoard";
import type { PeriodicTableCellData } from "@/src/lib/dashboard-data";

type PeriodicTablePayload = { cells: PeriodicTableCellData[]; error?: string };

export function PeriodicTablePageClient() {
  const [data, setData] = useState<PeriodicTablePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetch("/api/periodic-table?live=1", { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as PeriodicTablePayload;
        if (!mounted) return;
        if (!res.ok) {
          setData(null);
          setError(json?.error ?? `HTTP ${res.status}`);
          return;
        }
        setData(json);
      })
      .catch((e) => {
        if (!mounted) return;
        setData(null);
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <DashboardHeader
          totalAlpha={0}
          benchmarkPrice={0}
          benchmarkChangePct={null}
          benchmarkPriceSource="close"
          benchmarkAsOf={null}
          portfolioAvgDayChangePct={null}
          marketIndicators={[]}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card/60 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              <span className="font-bold uppercase tracking-wider text-muted-foreground/90">Dashboard</span>{" "}
              <span className="text-foreground/90">Periodic Table Market</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Critical metalsを元素周期表レイアウトで可視化（上昇=Emerald / 下落=Rose）
            </p>
            {data?.error ? (
              <p className="text-[11px] text-amber-300 mt-1">
                {data.error}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/"
              className="text-[10px] font-bold text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-muted transition-all"
            >
              ← ダッシュボード
            </Link>
          </div>
        </div>

        {loading ? <p className="text-sm text-slate-500">読み込み中…</p> : null}
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        {!loading && !error ? (
          <PeriodicTableBoard cells={data?.cells ?? []} />
        ) : null}
      </div>
    </div>
  );
}

