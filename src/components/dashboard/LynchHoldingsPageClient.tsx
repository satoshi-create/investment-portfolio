"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { LynchHoldingsResearchRow } from "@/src/types/lynch-holdings";
import { ecosystemDividendPayoutPercent, formatDividendPayoutPercent } from "@/src/lib/eco-dividend-payout";
import { fetchWithTimeout } from "@/src/lib/fetch-utils";
import {
  calculateLynchScore,
  lynchPegForDisplay,
  lynchScoreBand,
  type LynchSuggestInput,
  suggestLynchCategory,
} from "@/src/lib/lynch-logic";
import { LYNCH_HOLDINGS_SEED } from "@/src/lib/lynch-holdings-seed";
import { cn } from "@/src/lib/cn";
import { LYNCH_CATEGORY_LABEL_JA, type LynchCategory } from "@/src/types/investment";
import type { EquityResearchSnapshot } from "@/src/lib/price-service";

function fmtPct(v: number | null, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

function fmtNum(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

function fmtCompactUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
}

function lynchInputFromResearch(res: EquityResearchSnapshot | null): LynchSuggestInput {
  if (res == null) {
    return {
      forwardPe: null,
      trailingPe: null,
      trailingEps: null,
      forwardEps: null,
      expectedGrowth: null,
      dividendYieldPercent: null,
      revenueGrowthPercent: null,
      marketCapUsd: null,
      sectorLabel: null,
      netCashUsd: null,
      priceToBook: null,
    };
  }
  return {
    forwardPe: res.forwardPe,
    trailingPe: res.trailingPe,
    trailingEps: res.trailingEps,
    forwardEps: res.forwardEps,
    expectedGrowth: res.expectedGrowth,
    dividendYieldPercent: res.dividendYieldPercent,
    revenueGrowthPercent: res.revenueGrowthPercent,
    marketCapUsd: res.marketCap,
    sectorLabel: res.yahooSector,
    netCashUsd: null,
    priceToBook: null,
  };
}

function LynchCoreCell({
  category,
  res,
  lynchScore,
}: {
  category: LynchCategory;
  res: EquityResearchSnapshot | null;
  lynchScore: number | null;
}) {
  const band = lynchScoreBand(lynchScore);
  const goldBg = band === "ELITE";

  const peg = lynchPegForDisplay({
    forwardPe: res?.forwardPe ?? null,
    trailingPe: res?.trailingPe ?? null,
    expectedGrowth: res?.expectedGrowth ?? null,
    dividendYieldPercent: res?.dividendYieldPercent ?? null,
    yahooPegRatio: res?.yahooPegRatio ?? null,
  });

  const payout = res != null ? ecosystemDividendPayoutPercent(res) : null;

  let primary = "—";
  let secondary = "—";
  switch (category) {
    case "FastGrower":
      primary = `売上成長 ${fmtPct(res?.revenueGrowthPercent ?? null)}`;
      secondary = `PEG ${fmtNum(peg)}`;
      break;
    case "Turnaround":
      primary = "ネットC —";
      secondary = "現預金 —";
      break;
    case "Stalwart":
      primary = `利回り ${fmtPct(res?.dividendYieldPercent ?? null)}`;
      secondary = `性向 ${formatDividendPayoutPercent(payout)}`;
      break;
    case "AssetPlay": {
      const mc = res?.marketCap ?? null;
      primary = mc != null ? `時価 ${fmtCompactUsd(mc)}` : "時価 —";
      secondary = "実質時価（時価−現金）—";
      break;
    }
    case "Cyclical":
      primary = "在庫回転率 —";
      secondary = "（Yahoo BS 未連携）";
      break;
    default:
      primary = res?.yahooSector != null ? res.yahooSector : "—";
      secondary = `PEG ${fmtNum(peg)}`;
  }

  return (
    <div
      className={cn(
        "rounded-md border border-border/60 px-2 py-1.5 text-[11px] leading-snug",
        goldBg && "bg-amber-500/25 dark:bg-amber-400/20 border-amber-600/40",
      )}
      title={category === "Cyclical" ? "在庫回転率は BS 詳細が未取得のため MVP では表示しません" : undefined}
    >
      <div className="text-muted-foreground font-medium">Lynch Score {fmtNum(lynchScore)}</div>
      <div className="mt-0.5 text-foreground/90">
        <span className="text-muted-foreground">{primary}</span>
        <span className="mx-1 text-border">/</span>
        <span className="text-muted-foreground">{secondary}</span>
      </div>
    </div>
  );
}

export function LynchHoldingsPageClient() {
  const [rows, setRows] = useState<LynchHoldingsResearchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout("/api/lynch-holdings-research", { cache: "no-store", signal }, { timeoutMs: 90_000 });
      const json = (await res.json()) as { rows?: LynchHoldingsResearchRow[]; error?: string };
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        setRows([]);
        return;
      }
      setRows(Array.isArray(json.rows) ? json.rows : []);
    } catch (e) {
      if (signal.aborted) return;
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
      setRows([]);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const rowCount = LYNCH_HOLDINGS_SEED.length;

  const body = useMemo(() => {
    if (loading && rows == null) {
      return (
        <tr>
          <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
            Yahoo リサーチを取得しています…
          </td>
        </tr>
      );
    }
    const list = rows ?? [];
    return list.map((r) => {
      const input = lynchInputFromResearch(r.research);
      const category = suggestLynchCategory(input);
      const score = calculateLynchScore({
        forwardPe: r.research?.forwardPe ?? null,
        trailingPe: r.research?.trailingPe ?? null,
        expectedGrowth: r.research?.expectedGrowth ?? null,
        dividendYieldPercent: r.research?.dividendYieldPercent ?? null,
      });
      return (
        <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
          <td className="px-3 py-2 text-sm font-medium text-foreground">{r.displayName}</td>
          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.ticker}</td>
          <td className="px-3 py-2 text-xs">
            <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5">
              {LYNCH_CATEGORY_LABEL_JA[category]}
            </span>
          </td>
          <td className="px-3 py-2 text-xs text-muted-foreground max-w-[14rem]">
            {r.research?.yahooSector ?? "—"}
          </td>
          <td className="px-3 py-2 align-top min-w-[11rem]">
            <LynchCoreCell category={category} res={r.research} lynchScore={score} />
          </td>
        </tr>
      );
    });
  }, [loading, rows]);

  return (
    <div className="mx-auto w-full max-w-6xl lg:max-w-7xl 2xl:max-w-[104rem] px-3 py-6 md:px-4">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">構造投資テーマ · MVP</div>
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">リンチの保有銘柄（観測）</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            ピーター・リンチの例示銘柄を Seed として一覧し、ルールベースの 6 分類と Lynch Core（カテゴリ別指標 + Lynch
            Score）を表示します。歴史銘柄は現存ティッカーへのプロキシ表記です。
          </p>
        </div>
        <Link
          href="/themes"
          className="text-sm text-cyan-700 hover:underline dark:text-cyan-300"
        >
          ← テーマ一覧
        </Link>
      </div>

      {error != null && error.length > 0 ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {error}（表は空または部分的に表示されます）
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card/50">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">銘柄</th>
              <th className="px-3 py-2">Ticker</th>
              <th className="px-3 py-2">分類</th>
              <th className="px-3 py-2">Yahoo Sector</th>
              <th className="px-3 py-2">Lynch Core</th>
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Seed {rowCount} 銘柄 · Lynch Score は `computeTotalReturnYieldRatio` と同次元（成長% + 配当%）/ PER。2.0 以上でセルを強調表示。
      </p>
    </div>
  );
}
