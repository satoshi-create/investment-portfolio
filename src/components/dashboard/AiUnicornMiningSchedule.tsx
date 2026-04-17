"use client";

import React, { useMemo, useState } from "react";

import type { ThemeEcosystemWatchItem } from "@/src/types/investment";
import { cn } from "@/src/lib/cn";
import { daysUntil, parseExpectedIpoDate } from "@/src/lib/unicorn-ipo";

type MiningRow = {
  id: string;
  companyName: string;
  role: string;
  proxyTicker: string | null;
  ipoLabel: string;
  daysToIpo: number | null;
};

function fmtTminus(d: number | null): string {
  if (d == null || !Number.isFinite(d)) return "—";
  if (d >= 0) return `T-${d}d`;
  return `+${Math.abs(d)}d`;
}

function bucketLabel(bucket: "next90" | "next180" | "next365" | "all" | "unknown"): string {
  if (bucket === "next90") return "T-90";
  if (bucket === "next180") return "T-180";
  if (bucket === "next365") return "T-365";
  if (bucket === "unknown") return "Unknown";
  return "All";
}

export function AiUnicornMiningSchedule({ ecosystem }: { ecosystem: ThemeEcosystemWatchItem[] }) {
  const [bucket, setBucket] = useState<"next90" | "next180" | "next365" | "all" | "unknown">("next180");

  const rows = useMemo(() => {
    const out: MiningRow[] = [];
    for (const e of ecosystem) {
      if (!e.isUnlisted) continue;
      const { label, date } = parseExpectedIpoDate(e.estimatedIpoDate);
      const d = daysUntil(date);
      out.push({
        id: e.id,
        companyName: e.companyName,
        role: e.role,
        proxyTicker: e.proxyTicker,
        ipoLabel: label,
        daysToIpo: d,
      });
    }
    out.sort((a, b) => {
      const ad = a.daysToIpo;
      const bd = b.daysToIpo;
      if (ad == null && bd == null) return a.companyName.localeCompare(b.companyName);
      if (ad == null) return 1;
      if (bd == null) return -1;
      return ad - bd;
    });
    return out;
  }, [ecosystem]);

  const counts = useMemo(() => {
    const next90 = rows.filter((r) => r.daysToIpo != null && r.daysToIpo >= 0 && r.daysToIpo <= 90).length;
    const next180 = rows.filter((r) => r.daysToIpo != null && r.daysToIpo >= 0 && r.daysToIpo <= 180).length;
    const next365 = rows.filter((r) => r.daysToIpo != null && r.daysToIpo >= 0 && r.daysToIpo <= 365).length;
    const unknown = rows.filter((r) => r.daysToIpo == null).length;
    return { next90, next180, next365, unknown, total: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    if (bucket === "all") return rows;
    if (bucket === "unknown") return rows.filter((r) => r.daysToIpo == null);
    const max = bucket === "next90" ? 90 : bucket === "next180" ? 180 : 365;
    return rows.filter((r) => r.daysToIpo != null && r.daysToIpo >= 0 && r.daysToIpo <= max);
  }, [rows, bucket]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
            Mining schedule (IPO)
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="text-sm font-bold text-slate-200">
              近接イベント密度:{" "}
              <span className="font-mono text-slate-300">
                {counts.next90}/{counts.next180}/{counts.next365}
              </span>
              <span className="text-xs text-slate-500 ml-2">（T-90 / 180 / 365）</span>
            </div>
            <div className="text-xs text-slate-500">
              Unknown: <span className="font-mono text-slate-400">{counts.unknown}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            「次に来る順」に並べて、イベントの密度で“読む順番”を決める
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
            Filter
          </p>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/40 p-1">
            {(
              [
                ["next90", counts.next90],
                ["next180", counts.next180],
                ["next365", counts.next365],
                ["unknown", counts.unknown],
                ["all", counts.total],
              ] as const
            ).map(([k, n]) => (
              <button
                key={k}
                type="button"
                onClick={() => setBucket(k)}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-md border transition-colors",
                  bucket === k
                    ? "text-violet-200 border-violet-500/45 bg-violet-500/10"
                    : "text-slate-500 border-transparent hover:bg-slate-800/60",
                )}
                title={bucketLabel(k)}
              >
                {bucketLabel(k)}{" "}
                <span className={cn("font-mono", bucket === k ? "text-violet-200" : "text-slate-600")}>
                  {n}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-slate-600">この条件に該当する銘柄はありません</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.slice(0, 9).map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-200 truncate">{r.companyName}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">{r.role || "—"}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-slate-500">
                    IPO{" "}
                    <span className="font-mono text-slate-300">
                      {r.ipoLabel}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    <span className="font-mono text-slate-400">{fmtTminus(r.daysToIpo)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-slate-600 font-mono">
                <span>proxy={r.proxyTicker ?? "—"}</span>
                <span>{r.daysToIpo != null && r.daysToIpo < 0 ? "passed" : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

