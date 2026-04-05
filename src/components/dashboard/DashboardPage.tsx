'use client';

import React, { useCallback, useEffect, useState, useTransition } from "react";

import { recordPortfolioSnapshotAction } from "@/app/actions/snapshot";
import { generateSignalsAction } from "@/app/actions/signals";
import type {
  ClosedTradeDashboardRow,
  CoreSatelliteBreakdown,
  DashboardSummary,
  HoldingDailySnapshotRow,
  PortfolioDailySnapshotRow,
  Signal,
  Stock,
  StructureTagSlice,
} from "@/src/types/investment";
import { ClosedTradesTable } from "@/src/components/dashboard/ClosedTradesTable";
import { DashboardHeader } from "@/src/components/dashboard/DashboardHeader";
import { HoldingDailySnapshotsTable } from "@/src/components/dashboard/HoldingDailySnapshotsTable";
import { HoldingsDetailTable } from "@/src/components/dashboard/HoldingsDetailTable";
import { PortfolioSnapshotsTable } from "@/src/components/dashboard/PortfolioSnapshotsTable";
import { InventoryTable } from "@/src/components/dashboard/InventoryTable";
import { SignalsSection } from "@/src/components/dashboard/SignalsSection";
import { StrategySection } from "@/src/components/dashboard/StrategySection";
import { Camera, RefreshCw } from "lucide-react";

const DEFAULT_USER_ID =
  typeof process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID === "string" &&
  process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID.length > 0
    ? process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID
    : "user-satoshi";

const EMPTY_SUMMARY: DashboardSummary = {
  portfolioAverageAlpha: 0,
  benchmarkLatestPrice: 0,
  totalHoldings: 0,
};

type DashboardPayload = {
  userId: string;
  stocks: Stock[];
  signals: Signal[];
  structureByTag: StructureTagSlice[];
  coreSatellite: CoreSatelliteBreakdown;
  totalMarketValue: number;
  summary: DashboardSummary;
  portfolioSnapshots: PortfolioDailySnapshotRow[];
  holdingSnapshotsDate: string | null;
  holdingSnapshots: HoldingDailySnapshotRow[];
  closedTrades: ClosedTradeDashboardRow[];
};

export function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [snapshotPending, startSnapshotTransition] = useTransition();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?userId=${encodeURIComponent(DEFAULT_USER_ID)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as Partial<DashboardPayload> & { error?: string; hint?: string };
      if (!res.ok) {
        setData(null);
        setError(json.error ?? `HTTP ${res.status}${json.hint ? ` — ${json.hint}` : ""}`);
        return;
      }
      setData({
        userId: json.userId!,
        stocks: json.stocks ?? [],
        signals: json.signals ?? [],
        structureByTag: json.structureByTag ?? [],
        coreSatellite: json.coreSatellite ?? {
          coreWeightPercent: 0,
          satelliteWeightPercent: 0,
          targetCorePercent: 90,
          coreGapVsTarget: 0,
        },
        totalMarketValue: json.totalMarketValue ?? 0,
        summary: json.summary ?? EMPTY_SUMMARY,
        portfolioSnapshots: json.portfolioSnapshots ?? [],
        holdingSnapshotsDate: json.holdingSnapshotsDate ?? null,
        holdingSnapshots: json.holdingSnapshots ?? [],
        closedTrades: json.closedTrades ?? [],
      });
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const onGenerateSignals = () => {
    setActionMessage(null);
    startTransition(async () => {
      const result = await generateSignalsAction(DEFAULT_USER_ID);
      setActionMessage(result.message);
      if (result.ok) {
        await loadDashboard();
      }
    });
  };

  const onRecordSnapshot = () => {
    setActionMessage(null);
    startSnapshotTransition(async () => {
      const result = await recordPortfolioSnapshotAction(DEFAULT_USER_ID);
      setActionMessage(result.message);
      if (result.ok) {
        await loadDashboard();
      }
    });
  };

  const stocks = data?.stocks ?? [];
  const signals = data?.signals ?? [];
  const structureByTag = data?.structureByTag ?? [];
  const coreSatellite = data?.coreSatellite ?? {
    coreWeightPercent: 0,
    satelliteWeightPercent: 0,
    targetCorePercent: 90,
    coreGapVsTarget: 0,
  };
  const totalMarketValue = data?.totalMarketValue ?? 0;
  const summary = data?.summary ?? EMPTY_SUMMARY;
  const portfolioSnapshots = data?.portfolioSnapshots ?? [];
  const holdingSnapshotsDate = data?.holdingSnapshotsDate ?? null;
  const holdingSnapshots = data?.holdingSnapshots ?? [];
  const closedTrades = data?.closedTrades ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <DashboardHeader
          totalAlpha={summary.portfolioAverageAlpha}
          benchmarkPrice={summary.benchmarkLatestPrice}
        />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <div className="text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-slate-500">Profile</span>{" "}
            <span className="text-slate-300 font-mono">{DEFAULT_USER_ID}</span>
            {loading && <span className="ml-2 text-slate-500">Loading…</span>}
            {error && (
              <span className="ml-2 text-rose-400 block sm:inline mt-1 sm:mt-0">{error}</span>
            )}
            {actionMessage && (
              <span
                className={`ml-2 block sm:inline mt-1 sm:mt-0 ${
                  actionMessage.includes("failed") ||
                  actionMessage.includes("not configured") ||
                  actionMessage.includes("missing") ||
                  actionMessage.includes("Table missing")
                    ? "text-rose-400"
                    : "text-emerald-400"
                }`}
              >
                {actionMessage}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="text-[10px] font-bold text-slate-300 border border-slate-600 px-3 py-2 rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={onGenerateSignals}
              disabled={pending || !!error || loading}
              className="text-[10px] font-bold text-amber-400 border border-amber-400/40 px-3 py-2 rounded-lg hover:bg-amber-400/10 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
              Generate signals
            </button>
            <button
              type="button"
              onClick={onRecordSnapshot}
              disabled={snapshotPending || !!error || loading}
              className="text-[10px] font-bold text-cyan-400 border border-cyan-500/35 px-3 py-2 rounded-lg hover:bg-cyan-500/10 transition-all flex items-center gap-2 disabled:opacity-50"
              title="Writes portfolio_daily_snapshots + holding_daily_snapshots (UTC date). Same day overwrites."
            >
              <Camera size={14} className={snapshotPending ? "animate-pulse" : ""} />
              Record snapshot
            </button>
          </div>
        </div>

        <StrategySection
          structureByTag={structureByTag}
          coreSatellite={coreSatellite}
          totalMarketValue={totalMarketValue}
        />
        <SignalsSection signals={signals} userId={DEFAULT_USER_ID} onSignalResolved={() => void loadDashboard()} />
        <InventoryTable
          stocks={stocks}
          totalHoldings={summary.totalHoldings}
          averageAlpha={summary.portfolioAverageAlpha}
        />
        <HoldingsDetailTable stocks={stocks} />
        <PortfolioSnapshotsTable rows={portfolioSnapshots} />
        <HoldingDailySnapshotsTable snapshotDate={holdingSnapshotsDate} rows={holdingSnapshots} />
        <ClosedTradesTable rows={closedTrades} />
      </div>
    </div>
  );
}
