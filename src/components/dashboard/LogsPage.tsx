"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import type {
  ClosedTradeDashboardRow,
  HoldingDailySnapshotRow,
  PortfolioDailySnapshotRow,
} from "@/src/types/investment";
import { ClosedTradesTable } from "@/src/components/dashboard/ClosedTradesTable";
import { HoldingDailySnapshotsTable } from "@/src/components/dashboard/HoldingDailySnapshotsTable";
import { PortfolioSnapshotsTable } from "@/src/components/dashboard/PortfolioSnapshotsTable";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";

const DEFAULT_USER_ID = defaultProfileUserId();

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

  const holdingsBySnapshotDate = useMemo(() => {
    const m = new Map<string, HoldingDailySnapshotRow[]>();
    for (const h of holdingSnapshots) {
      const d = h.snapshotDate;
      const cur = m.get(d);
      if (cur) cur.push(h);
      else m.set(d, [h]);
    }
    return m;
  }, [holdingSnapshots]);

  return (
    <div className="mx-auto w-full max-w-6xl lg:max-w-7xl 2xl:max-w-[90rem] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">ログ</h1>
            <p className="text-[10px] text-muted-foreground mt-1">
              Portfolio / Holding スナップショットと取引履歴（読み取り専用）。記録はダッシュボードの{" "}
              <span className="font-mono text-muted-foreground/90">Record snapshot</span>、売買は{" "}
              <span className="font-mono text-muted-foreground/90">取引入力</span> から行えます。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground font-mono">{DEFAULT_USER_ID}</span>
            {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
            {error && <span className="text-xs text-rose-400">{error}</span>}
            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={loading}
              className="text-[10px] font-bold text-foreground/80 border border-border px-3 py-2 rounded-lg hover:bg-muted transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

      <PortfolioSnapshotsTable rows={portfolioSnapshots} holdingsBySnapshotDate={holdingsBySnapshotDate} />
      <HoldingDailySnapshotsTable snapshotDate={holdingSnapshotsDate} rows={holdingSnapshots} />
      <ClosedTradesTable rows={closedTrades} />
    </div>
  );
}
