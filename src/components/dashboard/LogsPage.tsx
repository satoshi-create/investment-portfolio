"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

import type {
  ClosedTradeDashboardRow,
  HoldingDailySnapshotRow,
  PortfolioDailySnapshotRow,
} from "@/src/types/investment";
import { ClosedTradesTable } from "@/src/components/dashboard/ClosedTradesTable";
import { HoldingDailySnapshotsTable } from "@/src/components/dashboard/HoldingDailySnapshotsTable";
import { PortfolioSnapshotsTable } from "@/src/components/dashboard/PortfolioSnapshotsTable";

const DEFAULT_USER_ID =
  typeof process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID === "string" &&
  process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID.length > 0
    ? process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID
    : "user-satoshi";

type LogsPayload = {
  userId: string;
  portfolioSnapshots: PortfolioDailySnapshotRow[];
  holdingSnapshotsDate: string | null;
  holdingSnapshots: HoldingDailySnapshotRow[];
  closedTrades: ClosedTradeDashboardRow[];
};

export function LogsPage() {
  const [data, setData] = useState<LogsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/logs?userId=${encodeURIComponent(DEFAULT_USER_ID)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as Partial<LogsPayload> & { error?: string; hint?: string };
      if (!res.ok) {
        setData(null);
        setError(json.error ?? `HTTP ${res.status}${json.hint ? ` — ${json.hint}` : ""}`);
        return;
      }
      setData({
        userId: json.userId!,
        portfolioSnapshots: json.portfolioSnapshots ?? [],
        holdingSnapshotsDate: json.holdingSnapshotsDate ?? null,
        holdingSnapshots: json.holdingSnapshots ?? [],
        closedTrades: json.closedTrades ?? [],
      });
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const portfolioSnapshots = data?.portfolioSnapshots ?? [];
  const holdingSnapshotsDate = data?.holdingSnapshotsDate ?? null;
  const holdingSnapshots = data?.holdingSnapshots ?? [];
  const closedTrades = data?.closedTrades ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-cyan-400 transition-colors mb-3"
            >
              <ArrowLeft size={14} />
              ダッシュボードへ
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-white">ログ</h1>
            <p className="text-[10px] text-slate-600 mt-1">
              Portfolio / Holding スナップショットと取引履歴（読み取り専用）。記録はダッシュボードの{" "}
              <span className="font-mono text-slate-500">Record snapshot</span>、売買は{" "}
              <span className="font-mono text-slate-500">取引入力</span> から行えます。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-500 font-mono">{DEFAULT_USER_ID}</span>
            {loading && <span className="text-xs text-slate-500">Loading…</span>}
            {error && <span className="text-xs text-rose-400">{error}</span>}
            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={loading}
              className="text-[10px] font-bold text-slate-300 border border-slate-600 px-3 py-2 rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        <PortfolioSnapshotsTable rows={portfolioSnapshots} />
        <HoldingDailySnapshotsTable snapshotDate={holdingSnapshotsDate} rows={holdingSnapshots} />
        <ClosedTradesTable rows={closedTrades} />
      </div>
    </div>
  );
}
