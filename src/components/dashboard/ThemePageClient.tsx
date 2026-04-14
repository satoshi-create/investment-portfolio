"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Crosshair, FileSpreadsheet, Layers, Search, TrendingUp, XCircle } from "lucide-react";

import { Input } from "@/src/components/ui/input";

import type {
  InvestmentThemeRecord,
  ThemeDetailData,
  ThemeEcosystemWatchItem,
} from "@/src/types/investment";
import {
  ADOPTION_STAGE_META,
  adoptionStageRank,
  adoptionStageTooltip,
  isPostChasmStage,
  parseAdoptionStage,
  summarizeThemeAdoptionMaturity,
} from "@/src/lib/adoption-stage";
import { isCumulativeSeriesTrendUpward } from "@/src/lib/alpha-logic";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import {
  THEME_ECOSYSTEM_WATCHLIST_CSV_COLUMNS,
  themeEcosystemWatchlistToCsvRows,
} from "@/src/lib/csv-dashboard-presets";
import { exportToCSV, themeEcosystemWatchlistCsvFileName } from "@/src/lib/csv-export";
import { EcosystemCumulativeSparkline } from "@/src/components/dashboard/EcosystemCumulativeSparkline";
import { InventoryTable } from "@/src/components/dashboard/InventoryTable";
import { TradeEntryForm, type TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";
import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";
import { stickyTdFirst, stickyThFirst } from "@/src/components/dashboard/table-sticky";

const DEFAULT_USER_ID = defaultProfileUserId();

const jpyFmt = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function pctClass(v: number): string {
  if (!Number.isFinite(v)) return "text-slate-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-400";
}

function fmtZsigma(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}σ`;
}

function mapThemeLabelForQuery(raw: string): { query: string; display: string; slug: string } {
  const s = raw.trim();
  if (s === "defensive-stocks") {
    return { query: "ディフェンシブ銘柄", display: "ディフェンシブ銘柄", slug: "defensive-stocks" };
  }
  return { query: s, display: s, slug: s };
}

function fmtDdCol(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function ecoOpportunityRow(e: ThemeEcosystemWatchItem, themeUp: boolean): boolean {
  if (!themeUp) return false;
  const z = e.alphaDeviationZ;
  return z != null && Number.isFinite(z) && z <= -1.5;
}

function ThemeMetaBlock({ theme, themeName }: { theme: InvestmentThemeRecord | null; themeName: string }) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Investment thesis</p>
        {theme?.description ? (
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{theme.description}</p>
        ) : (
          <p className="text-sm text-slate-500">
            テーマ「{themeName}」の解説は未登録です。<span className="font-mono text-slate-600">investment_themes</span>{" "}
            に Notion から移行した <span className="font-mono">description</span> を投入すると表示されます。
          </p>
        )}
      </div>
      {theme?.goal ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Goal & milestones</p>
          <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{theme.goal}</p>
        </div>
      ) : null}
    </div>
  );
}

type ThemeDetailJson = ThemeDetailData & { userId?: string; error?: string };

function normalizeThemeDetailResponse(rest: Omit<ThemeDetailJson, "userId" | "error">): ThemeDetailData {
  return {
    ...rest,
    ecosystem: Array.isArray(rest.ecosystem)
      ? rest.ecosystem.map((item) => ({
          ...item,
          holderTags: Array.isArray(item.holderTags) ? item.holderTags.map((h) => String(h)) : [],
          dividendMonths: Array.isArray(item.dividendMonths)
            ? item.dividendMonths.map((m) => Number(m)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 12)
            : [],
          defensiveStrength:
            item.defensiveStrength != null && String(item.defensiveStrength).trim().length > 0
              ? String(item.defensiveStrength).trim()
              : null,
          observationStartedAt:
            typeof item.observationStartedAt === "string" && item.observationStartedAt.length >= 10
              ? item.observationStartedAt.slice(0, 10)
              : null,
          alphaObservationStartDate:
            typeof item.alphaObservationStartDate === "string" && item.alphaObservationStartDate.length >= 10
              ? item.alphaObservationStartDate.slice(0, 10)
              : null,
          alphaDeviationZ:
            typeof item.alphaDeviationZ === "number" && Number.isFinite(item.alphaDeviationZ)
              ? item.alphaDeviationZ
              : null,
          drawdownFromHigh90dPct:
            typeof item.drawdownFromHigh90dPct === "number" && Number.isFinite(item.drawdownFromHigh90dPct)
              ? item.drawdownFromHigh90dPct
              : null,
          adoptionStage: parseAdoptionStage(
            (item as Record<string, unknown>).adoptionStage ?? (item as Record<string, unknown>).adoption_stage,
          ),
          adoptionStageRationale: (() => {
            const a = (item as Record<string, unknown>).adoptionStageRationale;
            const b = (item as Record<string, unknown>).adoption_stage_rationale;
            const s = typeof a === "string" && a.trim().length > 0 ? a.trim() : typeof b === "string" ? b.trim() : "";
            return s.length > 0 ? s : null;
          })(),
        }))
      : [],
    cumulativeAlphaSeries: Array.isArray(rest.cumulativeAlphaSeries) ? rest.cumulativeAlphaSeries : [],
    structuralAlphaTotalPct:
      typeof rest.structuralAlphaTotalPct === "number" && Number.isFinite(rest.structuralAlphaTotalPct)
        ? rest.structuralAlphaTotalPct
        : null,
    cumulativeAlphaAnchorDate:
      typeof rest.cumulativeAlphaAnchorDate === "string" && rest.cumulativeAlphaAnchorDate.length > 0
        ? rest.cumulativeAlphaAnchorDate
        : null,
  } as ThemeDetailData;
}

function fieldLabelOf(e: ThemeEcosystemWatchItem): string {
  return e.field.trim() || "その他";
}

function ChasmMeterVisual({ stage }: { stage: ThemeEcosystemWatchItem["adoptionStage"] }) {
  const r = adoptionStageRank(stage);
  const active = r ?? 0;
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((step) => (
        <div
          key={step}
          className={`h-2 w-2.5 rounded-sm ${
            step <= active ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.45)]" : "bg-slate-800"
          }`}
        />
      ))}
    </div>
  );
}

function EcosystemAdoptionCell({ e }: { e: ThemeEcosystemWatchItem }) {
  const st = e.adoptionStage;
  const meta = st ? ADOPTION_STAGE_META[st] : null;
  const tip = adoptionStageTooltip(st, e.adoptionStageRationale, e.observationNotes);
  if (!st || !meta) {
    return (
      <span className="text-xs text-slate-600" title={tip}>
        —
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 max-w-[7.5rem] cursor-help" title={tip}>
      <span className="text-xl leading-none" aria-hidden>
        {meta.icon}
      </span>
      <ChasmMeterVisual stage={st} />
      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 leading-tight">{meta.labelJa}</span>
    </div>
  );
}

function extractGeopoliticalPotential(observationNotes: string | null | undefined): string | null {
  if (observationNotes == null) return null;
  const s = observationNotes.trim();
  if (s.length === 0) return null;
  const m = s.match(/地政学(?:ポテンシャル|リスク|要因)[:：]\s*([^\n]+)\s*$/);
  if (m?.[1]) return m[1].trim();
  return null;
}

/** Case-insensitive: ticker, company, role, defensive strength, holders, field（セクター名・製紙など） */
function ecosystemMemberMatchesSearch(e: ThemeEcosystemWatchItem, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const holders = (e.holderTags ?? []).join(" ").toLowerCase();
  const haystack = [
    e.ticker,
    e.companyName,
    e.role,
    e.defensiveStrength ?? "",
    e.field,
    e.observationNotes ?? "",
    holders,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function ThemePageClient({ themeLabel }: { themeLabel: string }) {
  const { query: themeQueryName, display: themeDisplayName } = useMemo(
    () => mapThemeLabelForQuery(themeLabel),
    [themeLabel],
  );
  const isDefensiveTheme = themeQueryName === "ディフェンシブ銘柄";

  const [data, setData] = useState<ThemeDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** fast=1 後、フル API で Alpha/Research 等を埋めている間 */
  const [hydratingFull, setHydratingFull] = useState(false);
  const [tradeFormOpen, setTradeFormOpen] = useState(false);
  const [tradeInitial, setTradeInitial] = useState<TradeEntryInitial | null>(null);
  const [ecoSortKey, setEcoSortKey] = useState<
    "asset" | "research" | "alpha" | "trend" | "last" | "deviation" | "drawdown"
  >("alpha");
  const [ecoSortDir, setEcoSortDir] = useState<"asc" | "desc">("desc");
  const [ecoShowValueCols, setEcoShowValueCols] = useState(false);
  const [patrolOn, setPatrolOn] = useState(false);
  /** アーリーマジョリティ以降のみ（キャズム超え・割安性フィルターと AND） */
  const [postChasmOnly, setPostChasmOnly] = useState(false);
  const [ecoSearchTerm, setEcoSearchTerm] = useState("");

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    setHydratingFull(false);
    const baseUrl = `/api/theme-detail?userId=${encodeURIComponent(DEFAULT_USER_ID)}&theme=${encodeURIComponent(themeQueryName)}`;
    try {
      const resFast = await fetch(`${baseUrl}&fast=1`, { cache: "no-store", signal });
      const jsonFast = (await resFast.json()) as ThemeDetailJson;
      if (!resFast.ok) {
        setData(null);
        setError(jsonFast.error ?? `HTTP ${resFast.status}`);
        return;
      }
      const { userId: _u, error: _e, ...restFast } = jsonFast;
      if (signal.aborted) return;
      setData(normalizeThemeDetailResponse(restFast));
      setLoading(false);

      setHydratingFull(true);
      try {
        const resFull = await fetch(baseUrl, { cache: "no-store", signal });
        const jsonFull = (await resFull.json()) as ThemeDetailJson;
        if (signal.aborted) return;
        if (!resFull.ok) {
          console.warn("[theme-detail] full fetch failed:", jsonFull.error ?? resFull.status);
          return;
        }
        const { userId: __u, error: __e, ...restFull } = jsonFull;
        setData(normalizeThemeDetailResponse(restFull));
      } finally {
        setHydratingFull(false);
      }
    } catch (e) {
      if (signal.aborted || (e instanceof Error && e.name === "AbortError")) return;
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [themeQueryName]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const openTradeForm = useCallback((initial: TradeEntryInitial | null) => {
    setTradeInitial(initial);
    setTradeFormOpen(true);
  }, []);

  const stocks = data?.stocks ?? [];
  const theme = data?.theme ?? null;
  const ecosystem = data?.ecosystem ?? [];
  const cumulativeSeries = data?.cumulativeAlphaSeries ?? [];
  const themeStructuralTrendUp = useMemo(() => isCumulativeSeriesTrendUpward(cumulativeSeries), [cumulativeSeries]);

  useEffect(() => {
    if (patrolOn) setEcoShowValueCols(true);
  }, [patrolOn]);

  const ecosystemFiltered = useMemo(() => {
    let out = ecosystem;
    if (postChasmOnly) {
      out = out.filter((e) => isPostChasmStage(e.adoptionStage));
    }
    if (!patrolOn) return out;
    return out.filter((e) => {
      const z = e.alphaDeviationZ;
      const dd = e.drawdownFromHigh90dPct;
      const coldAlpha = z != null && z <= -1.5;
      const deepDrawdown = dd != null && dd <= -12;
      return coldAlpha || deepDrawdown;
    });
  }, [ecosystem, patrolOn, postChasmOnly]);

  const ecosystemSearchFiltered = useMemo(
    () => ecosystemFiltered.filter((e) => ecosystemMemberMatchesSearch(e, ecoSearchTerm)),
    [ecosystemFiltered, ecoSearchTerm],
  );

  const themeAdoptionMaturity = useMemo(
    () => summarizeThemeAdoptionMaturity(ecosystem.map((e) => e.adoptionStage)),
    [ecosystem],
  );

  const quoripsWatch = useMemo(
    () => ecosystem.find((e) => String(e.ticker).trim() === "4894"),
    [ecosystem],
  );

  const ecosystemSorted = useMemo(() => {
    const dir = ecoSortDir === "asc" ? 1 : -1;
    const cmpStr = (a: string, b: string) => a.localeCompare(b, "ja");
    const cmpNum = (a: number | null, b: number | null) => {
      const ax = a == null || !Number.isFinite(a) ? null : a;
      const by = b == null || !Number.isFinite(b) ? null : b;
      if (ax == null && by == null) return 0;
      if (ax == null) return 1;
      if (by == null) return -1;
      return ax < by ? -1 : ax > by ? 1 : 0;
    };
    const lastAlpha = (e: ThemeEcosystemWatchItem) =>
      e.alphaHistory.length > 0 ? e.alphaHistory[e.alphaHistory.length - 1]! : null;
    const devZ = (e: ThemeEcosystemWatchItem) =>
      e.alphaDeviationZ != null && Number.isFinite(e.alphaDeviationZ) ? e.alphaDeviationZ : null;
    const ddOf = (e: ThemeEcosystemWatchItem) =>
      e.drawdownFromHigh90dPct != null && Number.isFinite(e.drawdownFromHigh90dPct)
        ? e.drawdownFromHigh90dPct
        : null;

    const arr = [...ecosystemSearchFiltered];
    arr.sort((a, b) => {
      if (ecoSortKey === "asset") return dir * cmpStr(a.ticker, b.ticker);
      if (ecoSortKey === "alpha") return dir * cmpNum(a.latestAlpha, b.latestAlpha);
      if (ecoSortKey === "trend") return dir * cmpNum(lastAlpha(a), lastAlpha(b));
      if (ecoSortKey === "last") return dir * cmpNum(a.currentPrice, b.currentPrice);
      if (ecoSortKey === "deviation") return dir * cmpNum(devZ(a), devZ(b));
      if (ecoSortKey === "drawdown") return dir * cmpNum(ddOf(a), ddOf(b));
      // research
      const earnCmp = cmpNum(
        a.daysToEarnings != null && a.daysToEarnings >= 0 ? a.daysToEarnings : null,
        b.daysToEarnings != null && b.daysToEarnings >= 0 ? b.daysToEarnings : null,
      );
      if (earnCmp !== 0) return dir * earnCmp;
      return dir * cmpNum(a.dividendYieldPercent, b.dividendYieldPercent);
    });
    return arr;
  }, [ecosystemSearchFiltered, ecoSortDir, ecoSortKey]);

  function toggleEcoSort(next: typeof ecoSortKey) {
    if (next === ecoSortKey) setEcoSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setEcoSortKey(next);
      setEcoSortDir("desc");
    }
  }

  function ecoSortMark(k: typeof ecoSortKey) {
    if (k !== ecoSortKey) return "";
    return ecoSortDir === "asc" ? " ▲" : " ▼";
  }

  function handleEcosystemCsvDownload() {
    exportToCSV(
      themeEcosystemWatchlistToCsvRows(ecosystemSorted, themeDisplayName),
      themeEcosystemWatchlistCsvFileName(themeDisplayName),
      THEME_ECOSYSTEM_WATCHLIST_CSV_COLUMNS,
    );
  }

  function holderBadgeClass(holder: string): string {
    if (holder === "バークシャー") return "bg-red-100 text-red-800";
    if (holder === "エル" || holder === "ロンリード") return "bg-blue-100 text-blue-800";
    return "bg-slate-100 text-slate-800";
  }

  function dividendCalendar(months: number[]) {
    const now = new Date();
    const m = now.getMonth() + 1; // 1..12
    const set = new Set(months);
    const isPayMonth = set.has(m);
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => {
            const on = set.has(mm);
            const isThis = mm === m;
            return (
              <span
                key={mm}
                title={`${mm}月${on ? " 配当" : ""}${isThis ? "（今月）" : ""}`}
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  on ? "bg-emerald-400" : "bg-slate-800"
                } ${isThis ? "ring-1 ring-slate-500" : ""}`}
              />
            );
          })}
        </div>
        {isPayMonth ? (
          <span className="text-base leading-none" aria-label="Dividend month" title="今月が配当月">
            ✨
          </span>
        ) : null}
      </div>
    );
  }

  function defensiveZClass(z: number | null): string {
    if (z == null || !Number.isFinite(z)) return "text-slate-500";
    const az = Math.abs(z);
    if (az <= 0.75) return "text-emerald-400"; // 平常（0近傍）
    if (az >= 2.0) return "text-rose-400"; // 石垣の揺らぎ
    return "text-amber-300"; // 注意域
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-8">
          <Link
            href="/"
            className="inline-flex text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-cyan-400 mb-4"
          >
            ← ダッシュボード
          </Link>
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                <Crosshair size={14} className="text-cyan-500/90" />
                <span>Structural theme command</span>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">{themeDisplayName}</h1>
              <p className="text-[11px] text-slate-600 mt-2">
                <span className="font-mono text-slate-500">{DEFAULT_USER_ID}</span>
                ・<span className="font-mono">structure_tags[0]</span> がこのテーマ名と一致する保有のみ
              </p>
            </div>
            {data?.benchmarkLatestPrice != null && data.benchmarkLatestPrice > 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-right shrink-0">
                <p className="text-[9px] font-bold uppercase text-slate-500">VOO (ref)</p>
                <p className="font-mono text-lg text-slate-200">
                  {data.benchmarkLatestPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
            ) : null}
          </div>
        </header>

        {loading ? <p className="text-sm text-slate-500">読み込み中…</p> : null}
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        {!loading && !error && data ? (
          <>
            <ThemeMetaBlock theme={theme} themeName={themeLabel} />

            <section aria-labelledby="theme-performance-heading">
              <h2 id="theme-performance-heading" className="sr-only">
                Performance summary
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                    <TrendingUp size={12} className="opacity-70" />
                    テーマ評価額
                  </p>
                  <p className="text-xl font-mono font-bold text-slate-100 mt-1">
                    {data.themeTotalMarketValue > 0 ? jpyFmt.format(data.themeTotalMarketValue) : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-slate-500">銘柄数</p>
                  <p className="text-xl font-mono font-bold text-slate-100 mt-1">{stocks.length}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-slate-500">平均含み損益率</p>
                  <p className={`text-xl font-mono font-bold mt-1 ${pctClass(data.themeAverageUnrealizedPnlPercent)}`}>
                    {fmtPct(data.themeAverageUnrealizedPnlPercent)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-slate-500">平均 Alpha（日次）</p>
                  <p className={`text-xl font-mono font-bold mt-1 ${pctClass(data.themeAverageAlpha)}`}>
                    {fmtPct(data.themeAverageAlpha)}
                  </p>
                </div>
              </div>
            </section>

            {ecosystem.length > 0 ? (
              <section
                aria-label="テーマ普及成熟度"
                className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-5 md:p-6"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/90 mb-2">
                  Technology adoption · テーマ成熟度
                </p>
                <p className="text-lg font-bold text-slate-100 leading-snug">{themeAdoptionMaturity.headline}</p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{themeAdoptionMaturity.detail}</p>
                {quoripsWatch?.adoptionStage === "chasm" ? (
                  <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/95 mb-1">
                      クオリプス（4894）× キャズム
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      再生医療（iPS 心筋等）は臨床・規制・製造の峡谷に位置しやすく、
                      <span className="text-cyan-300/95 font-semibold"> 日次 Alpha（Z・累積トレンドのズレ）</span>
                      がイベントで動きやすい。割安パトロールと併せ、冷え込み＝期待調整のサインとして読むと直感的です。
                    </p>
                    {quoripsWatch.adoptionStageRationale ? (
                      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed border-t border-slate-800/80 pt-2">
                        {quoripsWatch.adoptionStageRationale}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}

            {stocks.length > 0 ? (
              <InventoryTable
                stocks={stocks}
                totalHoldings={stocks.length}
                averageAlpha={data.themeAverageAlpha}
                onTrade={(init) => openTradeForm({ ...init, themeId: theme?.id ?? init.themeId })}
                onTradeNew={() => openTradeForm(null)}
                themeStructuralTrendUp={themeStructuralTrendUp}
              />
            ) : null}

            {ecosystem.length > 0 ? (
              <section aria-labelledby="theme-ecosystem-heading">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="p-5 border-b border-slate-800 bg-slate-900/50 space-y-4">
                    <div className="flex items-start gap-2 min-w-0">
                      <Layers size={16} className="text-amber-500/90 shrink-0 mt-0.5" />
                      <div>
                        <h2
                          id="theme-ecosystem-heading"
                          className="text-xs font-bold text-slate-400 uppercase tracking-widest"
                        >
                          Ecosystem map / Watchlist
                        </h2>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          テーマ設置日起点の累積 Alpha（VOO 比）で観測。ポートフォリオ外の重要銘柄も含む（Notion 連携）
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
                      <div className="relative flex-1 min-w-0 max-w-xl">
                        <Search
                          size={16}
                          className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-slate-500"
                          aria-hidden
                        />
                        <Input
                          type="search"
                          value={ecoSearchTerm}
                          onChange={(ev) => setEcoSearchTerm(ev.target.value)}
                          placeholder="銘柄名、ティッカー、または役割で検索..."
                          className="h-9 pl-9 pr-9"
                          aria-label="エコシステム銘柄を検索"
                          autoComplete="off"
                        />
                        {ecoSearchTerm.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setEcoSearchTerm("")}
                            className="absolute right-2 top-1/2 z-[1] -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                            title="検索をクリア"
                            aria-label="検索をクリア"
                          >
                            <XCircle size={18} />
                          </button>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">
                        <button
                          type="button"
                          onClick={() => setEcoShowValueCols((v) => !v)}
                          className={`text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-colors ${
                            ecoShowValueCols
                              ? "text-amber-400 border-amber-500/50 bg-amber-500/10"
                              : "text-slate-500 border-slate-700 hover:bg-slate-800/60"
                          }`}
                          title="日次 Alpha 乖離（σ）と 90 日高値比"
                        >
                          乖離・落率
                        </button>
                        <button
                          type="button"
                          onClick={() => setPatrolOn((p) => !p)}
                          className={`text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-colors ${
                            patrolOn
                              ? "text-cyan-400 border-cyan-500/50 bg-cyan-500/10"
                              : "text-slate-500 border-slate-700 hover:bg-slate-800/60"
                          }`}
                          title="Alpha 乖離が大きい負け、または高値からの下落が大きい銘柄のみ"
                        >
                          割安パトロール
                        </button>
                        <button
                          type="button"
                          onClick={() => setPostChasmOnly((p) => !p)}
                          className={`text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-colors ${
                            postChasmOnly
                              ? "text-emerald-400 border-emerald-500/50 bg-emerald-500/10"
                              : "text-slate-500 border-slate-700 hover:bg-slate-800/60"
                          }`}
                          title="アーリーマジョリティ・レイトマジョリティのみ（キャズムより先＝普及が進んだ層）"
                        >
                          キャズム超え
                        </button>
                        <button
                          type="button"
                          onClick={handleEcosystemCsvDownload}
                          disabled={ecosystemSorted.length === 0}
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 border border-slate-700 px-3 py-2 rounded-lg hover:bg-slate-800/60 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                          title="表示中の行（フィルター・並び順反映）を UTF-8 BOM 付き CSV でダウンロード"
                        >
                          <FileSpreadsheet size={14} className="shrink-0" />
                          CSVダウンロード
                        </button>
                      </div>
                    </div>

                    <p className="text-[10px] font-mono text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {hydratingFull ? (
                        <span className="text-cyan-400/90 font-sans font-bold normal-case tracking-normal animate-pulse">
                          Alpha・Research 読込中…
                        </span>
                      ) : null}
                      <span>
                        {ecoSearchTerm.trim() || patrolOn || postChasmOnly
                          ? `表示 ${ecosystemSorted.length} / フィルター後 ${ecosystemFiltered.length} / 全 ${ecosystem.length} 銘柄`
                          : `計 ${ecosystem.length} 銘柄`}
                      </span>
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-bold tracking-[0.1em]">
                        <tr>
                          <th
                            className={`px-6 py-4 min-w-[10rem] max-w-[14rem] ${stickyThFirst} cursor-pointer select-none`}
                            onClick={() => toggleEcoSort("asset")}
                            title="Sort"
                          >
                            Asset{ecoSortMark("asset")}
                          </th>
                          {isDefensiveTheme ? (
                            <>
                              <th className="px-6 py-4 text-left whitespace-nowrap">Holder</th>
                              <th className="px-6 py-4 text-left whitespace-nowrap">Dividend</th>
                              <th className="px-6 py-4 text-left whitespace-nowrap">Defensive role</th>
                            </>
                          ) : (
                            <>
                              <th
                                className="px-6 py-4 text-left cursor-pointer select-none"
                                onClick={() => toggleEcoSort("research")}
                                title="Sort"
                              >
                                Research{ecoSortMark("research")}
                              </th>
                              <th className="px-6 py-4 text-left whitespace-nowrap">江戸的役割</th>
                            </>
                          )}
                          <th
                            className="px-6 py-4 text-left whitespace-nowrap"
                            title="ロジャーズの普及曲線（5 段階）。ホバーで根拠"
                          >
                            キャズム
                          </th>
                          {ecoShowValueCols ? (
                            <>
                              <th
                                className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                                onClick={() => toggleEcoSort("deviation")}
                                title="日次 Alpha 乖離（σ）"
                              >
                                乖離{ecoSortMark("deviation")}
                              </th>
                              <th
                                className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                                onClick={() => toggleEcoSort("drawdown")}
                                title="90 日高値比"
                              >
                                落率{ecoSortMark("drawdown")}
                              </th>
                            </>
                          ) : null}
                          <th
                            className="px-6 py-4 text-right cursor-pointer select-none"
                            onClick={() => toggleEcoSort("alpha")}
                            title="Sort"
                          >
                            Cum. α{ecoSortMark("alpha")}
                          </th>
                          <th
                            className="px-6 py-4 text-center cursor-pointer select-none"
                            onClick={() => toggleEcoSort("trend")}
                            title="Sort"
                          >
                            Cumulative trend{ecoSortMark("trend")}
                          </th>
                          <th
                            className="px-6 py-4 text-right cursor-pointer select-none"
                            onClick={() => toggleEcoSort("last")}
                            title="Sort"
                          >
                            Last{ecoSortMark("last")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {ecosystemSorted.length === 0 &&
                        ecosystemFiltered.length === 0 &&
                        (patrolOn || postChasmOnly) ? (
                          <tr>
                            <td
                              colSpan={ecoShowValueCols ? 9 : 7}
                              className="px-6 py-8 text-center text-sm text-slate-500"
                            >
                              {postChasmOnly && !patrolOn
                                ? "キャズム超え（アーリー／レイトマジョリティ）に該当する銘柄がありません。DB の adoption_stage を設定してください。"
                                : patrolOn && !postChasmOnly
                                  ? "割安パトロールの条件に合う銘柄がありません（乖離 Z≤−1.5 または 高値比 ≤−12%）。"
                                  : "フィルター条件に合う銘柄がありません（割安パトロール ＋ キャズム超え）。"}
                            </td>
                          </tr>
                        ) : null}
                        {ecosystemSorted.length === 0 && ecoSearchTerm.trim() && ecosystemFiltered.length > 0 ? (
                          <tr>
                            <td
                              colSpan={ecoShowValueCols ? 9 : 7}
                              className="px-6 py-8 text-center text-sm text-slate-500"
                            >
                              該当する仲間（銘柄）は見つかりませんでした
                            </td>
                          </tr>
                        ) : null}
                        {ecosystemSorted.map((e, idx) => {
                          const prev = idx > 0 ? ecosystemSorted[idx - 1] : null;
                          const field = fieldLabelOf(e);
                          const prevField = prev ? fieldLabelOf(prev) : null;
                          const showFieldHeader = idx === 0 || field !== prevField;
                          const ecoOpp = ecoOpportunityRow(e, themeStructuralTrendUp);
                          const zEco =
                            e.alphaDeviationZ != null && Number.isFinite(e.alphaDeviationZ) ? e.alphaDeviationZ : null;
                          const ddEco =
                            e.drawdownFromHigh90dPct != null && Number.isFinite(e.drawdownFromHigh90dPct)
                              ? e.drawdownFromHigh90dPct
                              : null;
                          return (
                            <React.Fragment key={e.id}>
                              {showFieldHeader ? (
                                <tr className="bg-slate-950/90">
                                  <td
                                    className={`px-6 py-2 min-w-[10rem] max-w-[14rem] sticky left-0 z-[19] bg-slate-950/90 border-r border-slate-800/90 border-b border-slate-800 shadow-[2px_0_10px_rgba(0,0,0,0.35)] text-[10px] font-bold uppercase tracking-wider text-cyan-500/90`}
                                  >
                                    {field}
                                  </td>
                                  <td
                                    colSpan={ecoShowValueCols ? 8 : 6}
                                    className="border-b border-slate-800 bg-slate-950/90 px-6 py-2"
                                    aria-hidden
                                  />
                                </tr>
                              ) : null}
                              <tr className="group hover:bg-slate-800/40 transition-all">
                              <td className={`px-6 py-4 min-w-[10rem] max-w-[14rem] ${stickyTdFirst}`}>
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <span className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors font-mono inline-flex items-center gap-1">
                                        {ecoOpp ? (
                                          <span
                                            className="shrink-0 text-base leading-none"
                                            title="テーマの加重累積 Alpha は上向きだが、日次 Alpha は統計的に冷え込み（割安候補）"
                                            aria-label="Opportunity"
                                          >
                                            ✨
                                          </span>
                                        ) : null}
                                        <span className="break-all">{e.ticker}</span>
                                      </span>
                                      {e.isUnlisted ? (
                                        <div className="mt-1 flex flex-wrap items-center gap-1">
                                          {e.estimatedIpoDate ? (
                                            <span className="text-[8px] font-bold uppercase tracking-wide text-fuchsia-300/95 border border-fuchsia-500/30 px-1.5 py-0.5 rounded">
                                              IPO {e.estimatedIpoDate}
                                            </span>
                                          ) : null}
                                          {e.estimatedValuation ? (
                                            <span className="text-[8px] font-bold uppercase tracking-wide text-slate-300/95 border border-slate-500/30 px-1.5 py-0.5 rounded">
                                              {e.estimatedValuation}
                                            </span>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap gap-1 justify-end shrink-0">
                                      {e.isMajorPlayer ? (
                                        <span className="text-[8px] font-bold uppercase tracking-wide text-amber-400/95 border border-amber-500/35 px-1.5 py-0.5 rounded">
                                          Major
                                        </span>
                                      ) : null}
                                      {e.inPortfolio ? (
                                        <span className="text-[8px] font-bold uppercase tracking-wide text-emerald-400/95 border border-emerald-500/35 px-1.5 py-0.5 rounded">
                                          In portfolio
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  {e.companyName ? (
                                    <span className="text-[10px] text-slate-400 leading-snug line-clamp-2" title={e.companyName}>
                                      {e.companyName}
                                    </span>
                                  ) : null}
                                  {e.observationNotes ? (() => {
                                    const geo = extractGeopoliticalPotential(e.observationNotes);
                                    return (
                                      <span className="text-[10px] text-slate-500 leading-snug line-clamp-2" title={e.observationNotes}>
                                        {e.observationNotes}
                                        {geo ? (
                                          <span
                                            className="ml-2 inline-flex items-center rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-300/90"
                                            title={`地政学ポテンシャル: ${geo}`}
                                          >
                                            Geo
                                          </span>
                                        ) : null}
                                      </span>
                                    );
                                  })() : null}
                                  {e.observationStartedAt ? (
                                    <span className="text-[10px] font-mono text-slate-600 pt-0.5">
                                      観測開始（投入）{" "}
                                      <span className="text-slate-500">{e.observationStartedAt}</span>
                                      {e.alphaObservationStartDate &&
                                      e.alphaObservationStartDate !== e.observationStartedAt ? (
                                        <span className="block text-[9px] text-slate-600 mt-0.5 font-normal">
                                          系列起点 {e.alphaObservationStartDate}
                                        </span>
                                      ) : null}
                                    </span>
                                  ) : e.alphaObservationStartDate ? (
                                    <span className="text-[10px] font-mono text-slate-600 pt-0.5">
                                      観測起点 <span className="text-slate-500">{e.alphaObservationStartDate}</span>
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              {isDefensiveTheme ? (
                                <>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1.5">
                                      {e.holderTags.length > 0 ? (
                                        e.holderTags.map((h) => (
                                          <span
                                            key={h}
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${holderBadgeClass(h)}`}
                                            title={h}
                                          >
                                            {h}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-xs text-slate-600">—</span>
                                      )}
                                    </div>
                                    <div className="mt-2 md:hidden text-[10px] text-slate-500">
                                      {e.countryName}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    {dividendCalendar(e.dividendMonths)}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="hidden md:block">
                                      {e.defensiveStrength ? (
                                        <p className="text-sm font-bold text-slate-100 leading-snug">
                                          {e.defensiveStrength}
                                        </p>
                                      ) : null}
                                      {e.role ? (
                                        <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-3" title={e.role}>
                                          {e.role}
                                        </p>
                                      ) : (
                                        <span className="text-xs text-slate-600">—</span>
                                      )}
                                    </div>
                                    <div className="md:hidden">
                                      <p className="text-xs font-semibold text-slate-200 leading-snug line-clamp-2" title={e.defensiveStrength ?? e.role}>
                                        {e.defensiveStrength ?? e.role ?? "—"}
                                      </p>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-bold text-slate-400 border border-slate-700 bg-slate-950/40 px-2 py-0.5 rounded-md">
                                          {e.countryName}
                                        </span>
                                        {e.nextEarningsDate ? (
                                          <span
                                            className="text-[10px] font-bold text-slate-200 border border-slate-700 bg-slate-900/60 px-2 py-0.5 rounded-md"
                                            title={`次期決算予定日: ${e.nextEarningsDate}`}
                                          >
                                            E:{e.daysToEarnings != null ? `D${e.daysToEarnings}` : e.nextEarningsDate}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-500">E:—</span>
                                        )}
                                        {e.dividendYieldPercent != null ? (
                                          <span
                                            className="text-[10px] font-bold text-slate-200 border border-slate-700 bg-slate-900/60 px-2 py-0.5 rounded-md"
                                            title={e.annualDividendRate != null ? `年間配当: ${e.annualDividendRate}` : "年間配当: —"}
                                          >
                                            Div:{e.dividendYieldPercent.toFixed(2)}%
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-500">Div:—</span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    {e.role ? (
                                      <div className="text-xs text-slate-300 leading-relaxed line-clamp-4" title={e.role}>
                                        {e.role}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-600">—</span>
                                    )}
                                  </td>
                                </>
                              )}
                              <td className="px-6 py-4 align-top">
                                <EcosystemAdoptionCell e={e} />
                              </td>
                              {ecoShowValueCols ? (
                                <>
                                  <td
                                    className={`px-6 py-4 text-right font-mono text-xs font-bold ${
                                      isDefensiveTheme ? defensiveZClass(zEco) : zEco == null
                                        ? "text-slate-500"
                                        : zEco < -1
                                          ? "text-amber-400"
                                          : zEco > 1
                                            ? "text-emerald-400"
                                            : "text-slate-200"
                                    }`}
                                  >
                                    {fmtZsigma(zEco)}
                                  </td>
                                  <td
                                    className={`px-6 py-4 text-right font-mono text-xs font-bold ${
                                      ddEco == null
                                        ? "text-slate-500"
                                        : ddEco < -10
                                          ? "text-rose-400"
                                          : "text-slate-200"
                                    }`}
                                  >
                                    {fmtDdCol(ddEco)}
                                  </td>
                                </>
                              ) : null}
                              <td
                                className={`px-6 py-4 text-right font-mono font-bold ${
                                  e.latestAlpha != null && Number.isFinite(e.latestAlpha)
                                    ? pctClass(e.latestAlpha)
                                    : "text-slate-500"
                                }`}
                              >
                                {e.latestAlpha != null && Number.isFinite(e.latestAlpha) ? (
                                  <>
                                    {e.latestAlpha > 0 ? "+" : ""}
                                    {e.latestAlpha.toFixed(2)}%
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col items-center gap-1">
                                  {e.isUnlisted ? (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                      Proxy Momentum{e.proxyTicker ? ` (${e.proxyTicker})` : ""}
                                    </span>
                                  ) : null}
                                  <EcosystemCumulativeSparkline history={e.alphaHistory} />
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="font-mono text-slate-300 text-xs">
                                    {e.currentPrice != null && e.currentPrice > 0
                                      ? e.currentPrice < 500
                                        ? `$${e.currentPrice.toFixed(2)}`
                                        : `$${e.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                                      : "—"}
                                  </span>
                                  {!e.inPortfolio ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openTradeForm({
                                          ticker: e.isUnlisted && e.proxyTicker ? e.proxyTicker : e.ticker,
                                          name: e.companyName || undefined,
                                          theme: themeLabel,
                                          themeId: theme?.id,
                                          quantityDefault: 1,
                                          ...(e.currentPrice != null &&
                                          Number.isFinite(e.currentPrice) &&
                                          e.currentPrice > 0
                                            ? { unitPrice: e.currentPrice }
                                            : {}),
                                        })
                                      }
                                      className="text-[9px] font-bold uppercase tracking-wide text-cyan-400 border border-cyan-500/40 px-2 py-0.5 rounded-md hover:bg-cyan-500/10"
                                    >
                                      Trade
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}

            {/* Structural Progress (Cumulative Alpha) — 一時非表示
            {stocks.length > 0 && (data.cumulativeAlphaSeries?.length ?? 0) > 0 ? (
              <StructuralProgressChart
                series={data.cumulativeAlphaSeries}
                anchorDateLabel={data.cumulativeAlphaAnchorDate}
                totalPct={data.structuralAlphaTotalPct}
              />
            ) : null}
            */}

            {stocks.length > 0 ? (
              <section aria-labelledby="theme-charts-heading">
                <h2
                  id="theme-charts-heading"
                  className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3"
                >
                  Momentum cluster（保有銘柄 Alpha）
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {stocks.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 flex flex-col gap-2 min-h-[7.5rem]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-slate-100 text-sm">{s.ticker}</p>
                          {s.name ? (
                            <p className="text-[9px] text-slate-500 truncate" title={s.name}>
                              {s.name}
                            </p>
                          ) : null}
                        </div>
                        {s.alphaHistory.length > 0 ? (
                          <span
                            className={`text-[10px] font-mono font-bold shrink-0 ${
                              s.alphaHistory[s.alphaHistory.length - 1]! > 0
                                ? "text-emerald-400"
                                : s.alphaHistory[s.alphaHistory.length - 1]! < 0
                                  ? "text-rose-400"
                                  : "text-slate-400"
                            }`}
                          >
                            {s.alphaHistory[s.alphaHistory.length - 1]! > 0 ? "+" : ""}
                            {s.alphaHistory[s.alphaHistory.length - 1]}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-600">—</span>
                        )}
                      </div>
                      <div className="flex-1 flex items-center justify-center min-h-[3rem]">
                        {s.alphaHistory.length === 0 ? (
                          <span className="text-[10px] text-slate-600">No series</span>
                        ) : (
                          <TrendMiniChart history={s.alphaHistory} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <p className="text-sm text-slate-500">このテーマに該当する保有がありません。</p>
            )}
          </>
        ) : null}

        <TradeEntryForm
          userId={DEFAULT_USER_ID}
          open={tradeFormOpen}
          initial={tradeInitial}
          onClose={() => {
            setTradeFormOpen(false);
            setTradeInitial(null);
          }}
          onSuccess={() => {
            const ac = new AbortController();
            void load(ac.signal);
          }}
          holdingOptions={stocks.map((s) => ({ ticker: s.ticker, name: s.name }))}
        />
      </div>
    </div>
  );
}
