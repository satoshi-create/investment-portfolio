"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Crosshair,
  FileSpreadsheet,
  Layers,
  Search,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import type {
  InvestmentThemeRecord,
  ThemeDetailData,
  ThemeEcosystemWatchItem,
  TickerInstrumentKind,
} from "@/src/types/investment";
import { fetchWithTimeout } from "@/src/lib/fetch-utils";
import {
  ADOPTION_STAGE_META,
  adoptionStageRank,
  adoptionStageTooltip,
  isPostChasmStage,
  parseAdoptionStage,
  summarizeThemeAdoptionMaturity,
} from "@/src/lib/adoption-stage";
import {
  classifyTickerInstrument,
  isThemeStructuralTrendPositiveUp,
  THEME_STRUCTURAL_TREND_LOOKBACK_DAYS,
} from "@/src/lib/alpha-logic";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { cn } from "@/src/lib/cn";
import {
  THEME_ECOSYSTEM_WATCHLIST_CSV_COLUMNS,
  themeEcosystemWatchlistToCsvRows,
} from "@/src/lib/csv-dashboard-presets";
import {
  exportToCSV,
  themeEcosystemWatchlistCsvFileName,
} from "@/src/lib/csv-export";
import { EcosystemCumulativeSparkline } from "@/src/components/dashboard/EcosystemCumulativeSparkline";
import { SemiconductorSupplyChainObservationPanel } from "@/src/components/dashboard/SemiconductorSupplyChainObservationPanel";
import { SaaSApocalypseLensPanel } from "@/src/components/dashboard/SaaSApocalypseLensPanel";
import { ThemeStructuralTrendChart } from "@/src/components/dashboard/ThemeStructuralTrendChart";
import { InventoryTable } from "@/src/components/dashboard/InventoryTable";
import { UnicornCard } from "@/src/components/dashboard/UnicornCard";
import {
  TradeEntryForm,
  type TradeEntryInitial,
} from "@/src/components/dashboard/TradeEntryForm";
import { TrendMiniChart } from "@/src/components/dashboard/TrendMiniChart";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  stickyTdFirst,
  stickyThFirst,
} from "@/src/components/dashboard/table-sticky";
import {
  SEMICONDUCTOR_SUPPLY_CHAIN_THEME_NAME,
  type SemiconductorSupplyChainCatalogRow,
} from "@/src/lib/semiconductor-supply-chain-catalog";

const DEFAULT_USER_ID = defaultProfileUserId();

const jpyFmt = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function ecosystemInstrumentKind(item: ThemeEcosystemWatchItem): TickerInstrumentKind {
  const k = item.instrumentKind;
  if (k === "US_EQUITY" || k === "JP_INVESTMENT_TRUST" || k === "JP_LISTED_EQUITY") return k;
  const proxy = item.proxyTicker != null ? String(item.proxyTicker).trim() : "";
  const eff = item.isUnlisted && proxy.length > 0 ? proxy : String(item.ticker).trim();
  return classifyTickerInstrument(eff.length > 0 ? eff : String(item.ticker).trim());
}

/** 現在値: 米株は USD、日本（上場・投信）は円。 */
function formatEcosystemCurrentPrice(e: ThemeEcosystemWatchItem): string {
  if (e.currentPrice == null || !Number.isFinite(e.currentPrice) || e.currentPrice <= 0) return "—";
  const kind = ecosystemInstrumentKind(e);
  if (kind === "US_EQUITY") {
    const p = e.currentPrice;
    return p < 500
      ? `$${p.toFixed(2)}`
      : `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return jpyFmt.format(Math.round(e.currentPrice));
}

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

function ecoPeOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.trailingPe ?? e.forwardPe ?? null;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function ecoEpsOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.trailingEps ?? e.forwardEps ?? null;
  return v != null && Number.isFinite(v) ? v : null;
}

function fmtPe(v: number | null): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—";
  return v >= 100 ? v.toFixed(0) : v.toFixed(1);
}

function fmtEps(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(2);
  return v.toFixed(3);
}

function mapThemeLabelForQuery(raw: string): {
  query: string;
  display: string;
  slug: string;
} {
  const s = raw.trim();
  if (s === "defensive-stocks") {
    return {
      query: "ディフェンシブ銘柄",
      display: "ディフェンシブ銘柄",
      slug: "defensive-stocks",
    };
  }
  if (s === "半導体製造装置") {
    return {
      query: "半導体サプライチェーン",
      display: "半導体サプライチェーン",
      slug: "半導体製造装置",
    };
  }
  return { query: s, display: s, slug: s };
}

function fmtDdCol(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

/** ローカル日付の YYYY-MM-DD（追加日入力の既定値用） */
function localCalendarIsoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ecosystemMatchesMarketFilter(
  e: ThemeEcosystemWatchItem,
  filter: "all" | "jp" | "us",
): boolean {
  if (filter === "all") return true;
  if (filter === "jp") return e.countryName === "日本";
  return e.countryName === "米国";
}

function ecoOpportunityRow(
  e: ThemeEcosystemWatchItem,
  themeUp: boolean,
): boolean {
  if (!themeUp) return false;
  const z = e.alphaDeviationZ;
  return z != null && Number.isFinite(z) && z <= -1.5;
}

function ecosystemMatchesSearchQuery(
  e: ThemeEcosystemWatchItem,
  raw: string,
): boolean {
  const n = raw.trim().toLowerCase();
  if (n.length === 0) return true;
  const hay = [e.companyName, e.ticker, e.role, e.observationNotes ?? ""];
  return hay.some((s) => s.toLowerCase().includes(n));
}

function ThemeMetaBlock({
  theme,
  themeName,
}: {
  theme: InvestmentThemeRecord | null;
  themeName: string;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
          Investment thesis
        </p>
        {theme?.description ? (
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {theme.description}
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            テーマ「{themeName}」の解説は未登録です。
            <span className="font-mono text-slate-600">investment_themes</span>{" "}
            に Notion から移行した{" "}
            <span className="font-mono">description</span>{" "}
            を投入すると表示されます。
          </p>
        )}
      </div>
      {theme?.goal ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
            Goal & milestones
          </p>
          <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
            {theme.goal}
          </p>
        </div>
      ) : null}
    </div>
  );
}

type ThemeDetailJson = ThemeDetailData & { userId?: string; error?: string };

function normalizeThemeDetailResponse(
  rest: Omit<ThemeDetailJson, "userId" | "error">,
): ThemeDetailData {
  return {
    ...rest,
    ecosystem: Array.isArray(rest.ecosystem)
      ? rest.ecosystem.map((item) => {
          const proxy = typeof item.proxyTicker === "string" ? item.proxyTicker.trim() : "";
          const tk = String(item.ticker ?? "").trim();
          const isUnlisted = Boolean(item.isUnlisted);
          const effective = isUnlisted && proxy.length > 0 ? proxy : tk;
          const inferredKind = classifyTickerInstrument(effective.length > 0 ? effective : tk);
          const rawKind = (item as Record<string, unknown>).instrumentKind;
          const instrumentKind: TickerInstrumentKind =
            rawKind === "US_EQUITY" || rawKind === "JP_INVESTMENT_TRUST" || rawKind === "JP_LISTED_EQUITY"
              ? rawKind
              : inferredKind;
          return {
          ...item,
          instrumentKind,
          countryName: instrumentKind === "US_EQUITY" ? "米国" : "日本",
          lastRoundValuation: (() => {
            const v =
              (item as Record<string, unknown>).lastRoundValuation ??
              (item as Record<string, unknown>).last_round_valuation;
            return v != null && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
          })(),
          privateCreditBacking: (() => {
            const a =
              (item as Record<string, unknown>).privateCreditBacking ??
              (item as Record<string, unknown>).private_credit_backing;
            const s = typeof a === "string" ? a.trim() : "";
            return s.length > 0 ? s : null;
          })(),
          observationStartedAt:
            typeof item.observationStartedAt === "string" &&
            item.observationStartedAt.length >= 10
              ? item.observationStartedAt.slice(0, 10)
              : null,
          alphaObservationStartDate:
            typeof item.alphaObservationStartDate === "string" &&
            item.alphaObservationStartDate.length >= 10
              ? item.alphaObservationStartDate.slice(0, 10)
              : null,
          alphaDeviationZ:
            typeof item.alphaDeviationZ === "number" &&
            Number.isFinite(item.alphaDeviationZ)
              ? item.alphaDeviationZ
              : null,
          drawdownFromHigh90dPct:
            typeof item.drawdownFromHigh90dPct === "number" &&
            Number.isFinite(item.drawdownFromHigh90dPct)
              ? item.drawdownFromHigh90dPct
              : null,
          adoptionStage: parseAdoptionStage(
            (item as Record<string, unknown>).adoptionStage ??
              (item as Record<string, unknown>).adoption_stage,
          ),
          adoptionStageRationale: (() => {
            const a = (item as Record<string, unknown>).adoptionStageRationale;
            const b = (item as Record<string, unknown>)
              .adoption_stage_rationale;
            const s =
              typeof a === "string" && a.trim().length > 0
                ? a.trim()
                : typeof b === "string"
                  ? b.trim()
                  : "";
            return s.length > 0 ? s : null;
          })(),
          };
        })
      : [],
    cumulativeAlphaSeries: Array.isArray(rest.cumulativeAlphaSeries)
      ? rest.cumulativeAlphaSeries
      : [],
    structuralAlphaTotalPct:
      typeof rest.structuralAlphaTotalPct === "number" &&
      Number.isFinite(rest.structuralAlphaTotalPct)
        ? rest.structuralAlphaTotalPct
        : null,
    cumulativeAlphaAnchorDate:
      typeof rest.cumulativeAlphaAnchorDate === "string" &&
      rest.cumulativeAlphaAnchorDate.length > 0
        ? rest.cumulativeAlphaAnchorDate
        : null,
    themeStructuralTrendSeries: Array.isArray(rest.themeStructuralTrendSeries)
      ? rest.themeStructuralTrendSeries
      : [],
    themeStructuralTrendTotalPct:
      typeof rest.themeStructuralTrendTotalPct === "number" &&
      Number.isFinite(rest.themeStructuralTrendTotalPct)
        ? rest.themeStructuralTrendTotalPct
        : null,
    themeStructuralTrendStartDate:
      typeof rest.themeStructuralTrendStartDate === "string" &&
      rest.themeStructuralTrendStartDate.length > 0
        ? rest.themeStructuralTrendStartDate.slice(0, 10)
        : null,
  } as ThemeDetailData;
}

function fieldLabelOf(e: ThemeEcosystemWatchItem): string {
  return e.field.trim() || "その他";
}

function ChasmMeterVisual({
  stage,
}: {
  stage: ThemeEcosystemWatchItem["adoptionStage"];
}) {
  const r = adoptionStageRank(stage);
  const active = r ?? 0;
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((step) => (
        <div
          key={step}
          className={`h-2 w-2.5 rounded-sm ${
            step <= active
              ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.45)]"
              : "bg-slate-800"
          }`}
        />
      ))}
    </div>
  );
}

function EcosystemAdoptionCell({ e }: { e: ThemeEcosystemWatchItem }) {
  const st = e.adoptionStage;
  const meta = st ? ADOPTION_STAGE_META[st] : null;
  const tip = adoptionStageTooltip(
    st,
    e.adoptionStageRationale,
    e.observationNotes,
  );
  if (!st || !meta) {
    return (
      <span className="text-xs text-slate-600" title={tip}>
        —
      </span>
    );
  }
  return (
    <div
      className="flex flex-col gap-1.5 max-w-[7.5rem] cursor-help"
      title={tip}
    >
      <span className="text-xl leading-none" aria-hidden>
        {meta.icon}
      </span>
      <ChasmMeterVisual stage={st} />
      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 leading-tight">
        {meta.labelJa}
      </span>
    </div>
  );
}

function extractGeopoliticalPotential(
  observationNotes: string | null | undefined,
): string | null {
  if (observationNotes == null) return null;
  const s = observationNotes.trim();
  if (s.length === 0) return null;
  const m = s.match(/地政学(?:ポテンシャル|リスク|要因)[:：]\s*([^\n]+)\s*$/);
  if (m?.[1]) return m[1].trim();
  return null;
}

export function ThemePageClient({
  themeLabel,
  supplyChainCatalogRows = null,
}: {
  themeLabel: string;
  /** 半導体サプライチェーン: サーバーで CSV を読み込んだカタログ（任意） */
  supplyChainCatalogRows?: SemiconductorSupplyChainCatalogRow[] | null;
}) {
  const { query: themeQueryName, display: themeDisplayName } = useMemo(
    () => mapThemeLabelForQuery(themeLabel),
    [themeLabel],
  );
  const isDefensiveTheme = themeQueryName === "ディフェンシブ銘柄";
  const isSemiconductorSupplyChainTheme =
    themeQueryName === SEMICONDUCTOR_SUPPLY_CHAIN_THEME_NAME;
  const isAiUnicornTheme = themeQueryName === "AIユニコーン";
  const [holderFilter, setHolderFilter] = useState<string[]>([]);

  const [data, setData] = useState<ThemeDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slowLoading, setSlowLoading] = useState(false);
  /** fast=1 後、フル API で Alpha/Research 等を埋めている間 */
  const [hydratingFull, setHydratingFull] = useState(false);
  const [tradeFormOpen, setTradeFormOpen] = useState(false);
  const [tradeInitial, setTradeInitial] = useState<TradeEntryInitial | null>(
    null,
  );
  const [ecoSortKey, setEcoSortKey] = useState<
    | "asset"
    | "research"
    | "pe"
    | "eps"
    | "alpha"
    | "trend"
    | "last"
    | "deviation"
    | "drawdown"
  >("alpha");
  const [ecoSortDir, setEcoSortDir] = useState<"asc" | "desc">("desc");
  const [ecoSortMode, setEcoSortMode] = useState<
    "column" | "dip_rank" | "deep_value_rank"
  >("column");
  const [ecoSortModeOpen, setEcoSortModeOpen] = useState(false);
  const [ecoSortModeHover, setEcoSortModeHover] = useState<
    "column" | "dip_rank" | "deep_value_rank" | null
  >(null);
  const [ecoShowValueCols, setEcoShowValueCols] = useState(false);
  const [patrolOn, setPatrolOn] = useState(false);
  /** アーリーマジョリティ以降のみ（キャズム超え・割安性フィルターと AND） */
  const [postChasmOnly, setPostChasmOnly] = useState(false);
  const [ecosystemSearchQuery, setEcosystemSearchQuery] = useState("");
  const [ecoMarketFilter, setEcoMarketFilter] = useState<"all" | "jp" | "us">(
    "all",
  );
  const [ecoPeMin, setEcoPeMin] = useState("");
  const [ecoPeMax, setEcoPeMax] = useState("");
  const [ecoEpsPositiveOnly, setEcoEpsPositiveOnly] = useState(false);
  const [addTicker, setAddTicker] = useState("");
  const [addImportance, setAddImportance] = useState<"standard" | "major">(
    "standard",
  );
  const [addObservationStartedAt, setAddObservationStartedAt] = useState(
    () => localCalendarIsoDate(),
  );
  const [addRole, setAddRole] = useState("");
  const [addCompanyName, setAddCompanyName] = useState<string | null>(null);
  const [addCompanyNameLoading, setAddCompanyNameLoading] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [ecoEditingId, setEcoEditingId] = useState<string | null>(null);
  const [ecoEditCompanyName, setEcoEditCompanyName] = useState("");
  const [ecoEditRole, setEcoEditRole] = useState("");
  const [ecoEditMajor, setEcoEditMajor] = useState(false);
  const [ecoEditSaving, setEcoEditSaving] = useState(false);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setSlowLoading(false);
      setError(null);
      setHydratingFull(false);
      const slowTimer = setTimeout(() => setSlowLoading(true), 3000);
      const baseUrl = `/api/theme-detail?userId=${encodeURIComponent(DEFAULT_USER_ID)}&theme=${encodeURIComponent(themeQueryName)}`;
      try {
        const resFast = await fetchWithTimeout(`${baseUrl}&fast=1`, {
          cache: "no-store",
          signal,
        }, { timeoutMs: 20_000 });
        const jsonFast = (await resFast.json()) as ThemeDetailJson;
        if (!resFast.ok) {
          // Keep previous snapshot if any; don't blank the screen.
          setError(jsonFast.error ?? `HTTP ${resFast.status}`);
          return;
        }
        const { userId: _u, error: _e, ...restFast } = jsonFast;
        if (signal.aborted) return;
        setData(normalizeThemeDetailResponse(restFast));
        setLoading(false);

        setHydratingFull(true);
        try {
          const resFull = await fetchWithTimeout(baseUrl, { cache: "no-store", signal }, { timeoutMs: 55_000 });
          const jsonFull = (await resFull.json()) as ThemeDetailJson;
          if (signal.aborted) return;
          if (!resFull.ok) {
            console.warn(
              "[theme-detail] full fetch failed:",
              jsonFull.error ?? resFull.status,
            );
            return;
          }
          const { userId: __u, error: __e, ...restFull } = jsonFull;
          setData(normalizeThemeDetailResponse(restFull));
        } catch (fullErr) {
          if (signal.aborted) return;
          if (fullErr instanceof Error && fullErr.name === "AbortError") {
            // Keep fast snapshot; show a gentle hint only if there's no other error.
            setError((cur) => cur ?? "接続タイムアウト：通信環境を確認してください");
            return;
          }
          console.warn(
            "[theme-detail] full fetch error (keeping fast snapshot):",
            fullErr instanceof Error ? fullErr.message : fullErr,
          );
        } finally {
          setHydratingFull(false);
        }
      } catch (e) {
        if (signal.aborted) return;
        if (e instanceof Error && e.name === "AbortError") {
          setError("接続タイムアウト：通信環境を確認してください");
        } else {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        clearTimeout(slowTimer);
        setSlowLoading(false);
        if (!signal.aborted) setLoading(false);
      }
    },
    [themeQueryName],
  );

  const refetchThemeDetailQuiet = useCallback(
    async (signal: AbortSignal) => {
      const baseUrl = `/api/theme-detail?userId=${encodeURIComponent(DEFAULT_USER_ID)}&theme=${encodeURIComponent(themeQueryName)}`;
      setHydratingFull(true);
      try {
        const resFull = await fetchWithTimeout(baseUrl, { cache: "no-store", signal }, { timeoutMs: 55_000 });
        const jsonFull = (await resFull.json()) as ThemeDetailJson;
        if (signal.aborted) return;
        if (!resFull.ok) {
          toast.error(
            jsonFull.error ?? `再読み込みに失敗しました（${resFull.status}）`,
          );
          return;
        }
        const { userId: __u, error: __e, ...restFull } = jsonFull;
        setData(normalizeThemeDetailResponse(restFull));
      } catch (e) {
        if (signal.aborted || (e instanceof Error && e.name === "AbortError"))
          return;
        toast.error(
          e instanceof Error && e.name === "AbortError"
            ? "接続タイムアウト：通信環境を確認してください"
            : e instanceof Error
              ? e.message
              : "再読み込みに失敗しました",
        );
      } finally {
        if (!signal.aborted) setHydratingFull(false);
      }
    },
    [themeQueryName],
  );

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
  const themeStructuralTrendSeries = data?.themeStructuralTrendSeries ?? [];
  const themeStructuralTrendUp = useMemo(
    () => isThemeStructuralTrendPositiveUp(themeStructuralTrendSeries),
    [themeStructuralTrendSeries],
  );

  const defensiveHolders = useMemo(() => {
    if (!isDefensiveTheme) return [];
    const set = new Set<string>();
    for (const e of ecosystem) {
      for (const h of e.holderTags ?? []) {
        const s = String(h).trim();
        if (s) set.add(s);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ja"));
  }, [ecosystem, isDefensiveTheme]);

  const holderFilterSet = useMemo(
    () => new Set(holderFilter.map((h) => h.trim()).filter(Boolean)),
    [holderFilter],
  );

  const ecosystemMatchesHolderFilter = useCallback(
    (e: ThemeEcosystemWatchItem): boolean => {
      if (!isDefensiveTheme) return true;
      if (holderFilterSet.size === 0) return true;
      const tags = new Set((e.holderTags ?? []).map((h) => String(h).trim()).filter(Boolean));
      for (const need of holderFilterSet) {
        if (!tags.has(need)) return false;
      }
      return true;
    },
    [holderFilterSet, isDefensiveTheme],
  );

  const defensiveHolderStats = useMemo(() => {
    if (!isDefensiveTheme) return null;
    const base = ecosystem.filter((e) => {
      return ecosystemMatchesHolderFilter(e);
    });
    const alphas = base
      .map((e) =>
        e.latestAlpha != null && Number.isFinite(e.latestAlpha) ? e.latestAlpha : null,
      )
      .filter((x): x is number => x != null);
    const zs = base
      .map((e) =>
        e.alphaDeviationZ != null && Number.isFinite(e.alphaDeviationZ) ? e.alphaDeviationZ : null,
      )
      .filter((x): x is number => x != null);
    const yields = base
      .map((e) =>
        e.dividendYieldPercent != null && Number.isFinite(e.dividendYieldPercent) ? e.dividendYieldPercent : null,
      )
      .filter((x): x is number => x != null);

    const avg = (arr: number[]) =>
      arr.length === 0
        ? null
        : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;

    return {
      count: base.length,
      inPortfolio: base.filter((e) => e.inPortfolio).length,
      avgLatestAlpha: avg(alphas),
      avgDeviationZ: avg(zs),
      avgDividendYield: avg(yields),
    };
  }, [ecosystem, ecosystemMatchesHolderFilter, isDefensiveTheme]);

  const ecosystemTickersUpper = useMemo(
    () => new Set(ecosystem.map((e) => e.ticker.trim().toUpperCase())),
    [ecosystem],
  );
  const addTickerDuplicate =
    addTicker.trim().length > 0 &&
    ecosystemTickersUpper.has(addTicker.trim().toUpperCase());

  useEffect(() => {
    const raw = addTicker.trim();
    if (!raw || addTickerDuplicate) {
      setAddCompanyName(null);
      setAddCompanyNameLoading(false);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(() => {
      setAddCompanyNameLoading(true);
      void fetch(`/api/ticker-name?ticker=${encodeURIComponent(raw)}`, {
        cache: "no-store",
        signal: ac.signal,
      })
        .then(async (res) => {
          const json = (await res.json()) as { companyName?: string | null };
          if (!res.ok) {
            setAddCompanyName(null);
            return;
          }
          const name =
            typeof json.companyName === "string" ? json.companyName.trim() : "";
          setAddCompanyName(name.length > 0 ? name : null);
        })
        .catch((e) => {
          if (e instanceof Error && e.name === "AbortError") return;
          setAddCompanyName(null);
        })
        .finally(() => setAddCompanyNameLoading(false));
    }, 350);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [addTicker, addTickerDuplicate]);

  const handleAddEcosystemMember = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      if (!theme?.id || addSubmitting) return;
      const t = addTicker.trim();
      if (!t || addTickerDuplicate) return;
      setAddSubmitting(true);
      const ac = new AbortController();
      try {
        const res = await fetch("/api/theme-ecosystem/member", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: DEFAULT_USER_ID,
            themeId: theme.id,
            ticker: t,
            isMajorPlayer: addImportance === "major",
            role: addRole.trim() || null,
            companyName: addCompanyName,
            observationStartedAt:
              addObservationStartedAt.trim().length >= 10
                ? addObservationStartedAt.trim().slice(0, 10)
                : null,
          }),
        });
        let json: { error?: string; code?: string } = {};
        try {
          json = (await res.json()) as { error?: string; code?: string };
        } catch {
          /* ignore */
        }
        if (!res.ok) {
          if (res.status === 409 || json.code === "DUPLICATE_TICKER") {
            toast.error("この銘柄は既にこのテーマに登録されています");
          } else {
            toast.error(json.error ?? "追加に失敗しました");
          }
          return;
        }
        toast.success("エコシステムに追加しました");
        setAddTicker("");
        setAddRole("");
        setAddImportance("standard");
        setAddObservationStartedAt(localCalendarIsoDate());
        setAddCompanyName(null);
        await refetchThemeDetailQuiet(ac.signal);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        toast.error(e instanceof Error ? e.message : "追加に失敗しました");
      } finally {
        setAddSubmitting(false);
      }
    },
    [
      theme?.id,
      addTicker,
      addRole,
      addImportance,
      addObservationStartedAt,
      addCompanyName,
      addTickerDuplicate,
      addSubmitting,
      refetchThemeDetailQuiet,
    ],
  );

  const beginEditEcosystem = useCallback((e: ThemeEcosystemWatchItem) => {
    setEcoEditingId(e.id);
    setEcoEditCompanyName((e.companyName ?? "").trim());
    setEcoEditRole((e.role ?? "").trim());
    setEcoEditMajor(e.isMajorPlayer === true);
  }, []);

  const cancelEditEcosystem = useCallback(() => {
    setEcoEditingId(null);
    setEcoEditCompanyName("");
    setEcoEditRole("");
    setEcoEditMajor(false);
    setEcoEditSaving(false);
  }, []);

  const saveEditEcosystem = useCallback(
    async (memberId: string) => {
      if (!theme?.id || ecoEditSaving) return;
      setEcoEditSaving(true);
      const ac = new AbortController();
      try {
        const res = await fetch("/api/theme-ecosystem/member", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: DEFAULT_USER_ID,
            themeId: theme.id,
            memberId,
            companyName: ecoEditCompanyName.trim() || null,
            role: ecoEditRole.trim() || null,
            isMajorPlayer: ecoEditMajor,
          }),
        });
        let json: { error?: string } = {};
        try {
          json = (await res.json()) as { error?: string };
        } catch {
          /* ignore */
        }
        if (!res.ok) {
          toast.error(json.error ?? "更新に失敗しました");
          return;
        }
        toast.success("更新しました");
        cancelEditEcosystem();
        await refetchThemeDetailQuiet(ac.signal);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        toast.error(e instanceof Error ? e.message : "更新に失敗しました");
      } finally {
        setEcoEditSaving(false);
      }
    },
    [
      cancelEditEcosystem,
      ecoEditCompanyName,
      ecoEditMajor,
      ecoEditRole,
      ecoEditSaving,
      refetchThemeDetailQuiet,
      theme?.id,
    ],
  );

  const deleteEcoMember = useCallback(
    async (memberId: string, ticker: string) => {
      if (!theme?.id) return;
      if (!confirm(`"${ticker}" をエコシステムから削除しますか？`)) return;
      const ac = new AbortController();
      try {
        const res = await fetch("/api/theme-ecosystem/member", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: DEFAULT_USER_ID,
            themeId: theme.id,
            memberId,
          }),
        });
        let json: { error?: string } = {};
        try {
          json = (await res.json()) as { error?: string };
        } catch {
          /* ignore */
        }
        if (!res.ok) {
          toast.error(json.error ?? "削除に失敗しました");
          return;
        }
        toast.success("削除しました");
        if (ecoEditingId === memberId) cancelEditEcosystem();
        await refetchThemeDetailQuiet(ac.signal);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        toast.error(e instanceof Error ? e.message : "削除に失敗しました");
      }
    },
    [cancelEditEcosystem, ecoEditingId, refetchThemeDetailQuiet, theme?.id],
  );

  useEffect(() => {
    if (patrolOn) setEcoShowValueCols(true);
  }, [patrolOn]);

  const ecosystemFiltered = useMemo(() => {
    let out = ecosystem;
    if (postChasmOnly) {
      out = out.filter((e) => isPostChasmStage(e.adoptionStage));
    }
    if (patrolOn) {
      out = out.filter((e) => {
        const z = e.alphaDeviationZ;
        const dd = e.drawdownFromHigh90dPct;
        const coldAlpha = z != null && z <= -1.5;
        const deepDrawdown = dd != null && dd <= -12;
        return coldAlpha || deepDrawdown;
      });
    }
    if (ecosystemSearchQuery.trim().length > 0) {
      out = out.filter((e) =>
        ecosystemMatchesSearchQuery(e, ecosystemSearchQuery),
      );
    }
    if (ecoMarketFilter !== "all") {
      out = out.filter((e) => ecosystemMatchesMarketFilter(e, ecoMarketFilter));
    }
    if (isDefensiveTheme && holderFilterSet.size > 0) {
      out = out.filter((e) => ecosystemMatchesHolderFilter(e));
    }
    const peMin = ecoPeMin.trim().length > 0 ? Number(ecoPeMin) : null;
    const peMax = ecoPeMax.trim().length > 0 ? Number(ecoPeMax) : null;
    const hasPeMin = peMin != null && Number.isFinite(peMin);
    const hasPeMax = peMax != null && Number.isFinite(peMax);
    if (hasPeMin || hasPeMax || ecoEpsPositiveOnly) {
      out = out.filter((e) => {
        const pe = ecoPeOf(e);
        const eps = ecoEpsOf(e);
        if (ecoEpsPositiveOnly) {
          if (eps == null) return false;
          if (!(eps > 0)) return false;
        }
        if (hasPeMin) {
          if (pe == null) return false;
          if (pe < (peMin as number)) return false;
        }
        if (hasPeMax) {
          if (pe == null) return false;
          if (pe > (peMax as number)) return false;
        }
        return true;
      });
    }
    return out;
  }, [
    ecosystem,
    patrolOn,
    postChasmOnly,
    ecosystemSearchQuery,
    ecoMarketFilter,
    holderFilterSet,
    isDefensiveTheme,
    ecosystemMatchesHolderFilter,
    ecoPeMin,
    ecoPeMax,
    ecoEpsPositiveOnly,
  ]);

  const themeAdoptionMaturity = useMemo(
    () => summarizeThemeAdoptionMaturity(ecosystem.map((e) => e.adoptionStage)),
    [ecosystem],
  );

  const quoripsWatch = useMemo(
    () => ecosystem.find((e) => String(e.ticker).trim() === "4894"),
    [ecosystem],
  );

  const ecosystemSorted = useMemo(() => {
    const cmpStr = (a: string, b: string) => a.localeCompare(b, "ja");
    const cmpNum = (a: number | null, b: number | null) => {
      const ax = a == null || !Number.isFinite(a) ? null : a;
      const by = b == null || !Number.isFinite(b) ? null : b;
      if (ax == null && by == null) return 0;
      if (ax == null) return 1;
      if (by == null) return -1;
      return ax < by ? -1 : ax > by ? 1 : 0;
    };
    const dir = ecoSortDir === "asc" ? 1 : -1;
    const lastAlpha = (e: ThemeEcosystemWatchItem) =>
      e.alphaHistory.length > 0
        ? e.alphaHistory[e.alphaHistory.length - 1]!
        : null;
    const devZ = (e: ThemeEcosystemWatchItem) =>
      e.alphaDeviationZ != null && Number.isFinite(e.alphaDeviationZ)
        ? e.alphaDeviationZ
        : null;
    const ddOf = (e: ThemeEcosystemWatchItem) =>
      e.drawdownFromHigh90dPct != null &&
      Number.isFinite(e.drawdownFromHigh90dPct)
        ? e.drawdownFromHigh90dPct
        : null;
    const absZ = (e: ThemeEcosystemWatchItem) => {
      const z = devZ(e);
      return z == null ? null : Math.abs(z);
    };

    function cmpNumDir(a: number | null, b: number | null, d: 1 | -1) {
      return d * cmpNum(a, b);
    }

    const arr = [...ecosystemFiltered];
    arr.sort((a, b) => {
      if (ecoSortMode === "dip_rank") {
        // Structural Dip priority:
        // - drawdown deeper first (more negative)
        // - Z closer to 0 first (trend not statistically broken)
        // - Cumα higher first (structure quality)
        const c1 = cmpNumDir(ddOf(a), ddOf(b), 1); // asc: -40 before -10
        if (c1 !== 0) return c1;
        const c2 = cmpNumDir(absZ(a), absZ(b), 1);
        if (c2 !== 0) return c2;
        const c3 = cmpNumDir(a.latestAlpha, b.latestAlpha, -1);
        if (c3 !== 0) return c3;
        return cmpStr(a.ticker, b.ticker);
      }
      if (ecoSortMode === "deep_value_rank") {
        // Deep Value priority:
        // - Z more negative first
        // - drawdown deeper first
        // - Cumα higher first (if structure still holds)
        const c1 = cmpNumDir(devZ(a), devZ(b), 1);
        if (c1 !== 0) return c1;
        const c2 = cmpNumDir(ddOf(a), ddOf(b), 1);
        if (c2 !== 0) return c2;
        const c3 = cmpNumDir(a.latestAlpha, b.latestAlpha, -1);
        if (c3 !== 0) return c3;
        return cmpStr(a.ticker, b.ticker);
      }

      if (ecoSortKey === "asset") return dir * cmpStr(a.ticker, b.ticker);
      if (ecoSortKey === "pe") return dir * cmpNum(ecoPeOf(a), ecoPeOf(b));
      if (ecoSortKey === "eps") return dir * cmpNum(ecoEpsOf(a), ecoEpsOf(b));
      if (ecoSortKey === "alpha")
        return dir * cmpNum(a.latestAlpha, b.latestAlpha);
      if (ecoSortKey === "trend")
        return dir * cmpNum(lastAlpha(a), lastAlpha(b));
      if (ecoSortKey === "last")
        return dir * cmpNum(a.currentPrice, b.currentPrice);
      if (ecoSortKey === "deviation") return dir * cmpNum(devZ(a), devZ(b));
      if (ecoSortKey === "drawdown") return dir * cmpNum(ddOf(a), ddOf(b));
      // research
      const earnCmp = cmpNum(
        a.daysToEarnings != null && a.daysToEarnings >= 0
          ? a.daysToEarnings
          : null,
        b.daysToEarnings != null && b.daysToEarnings >= 0
          ? b.daysToEarnings
          : null,
      );
      if (earnCmp !== 0) return dir * earnCmp;
      return dir * cmpNum(a.dividendYieldPercent, b.dividendYieldPercent);
    });
    return arr;
  }, [ecosystemFiltered, ecoSortDir, ecoSortKey, ecoSortMode]);

  const ecosystemColSpan = useMemo(() => {
    const base = 1 /* Asset */ + 1 /* キャズム */ + 2 /* PE + EPS */ + 3 /* Cumα + Trend + Last */;
    const mid = isDefensiveTheme ? 3 : 2; // defensive: Holder/Dividend/Def role, else: Research/役割
    const value = ecoShowValueCols ? 2 : 0;
    return base + mid + value;
  }, [ecoShowValueCols, isDefensiveTheme]);

  function ecoSortModeLabel(mode: "column" | "dip_rank" | "deep_value_rank"): string {
    if (mode === "column") return "通常: 列で並べ替え";
    if (mode === "dip_rank") return "押し目優先: 落率→乖離→CUM・A";
    return "深掘り優先: 乖離→落率→CUM・A";
  }

  function ecoSortModeHelp(mode: "column" | "dip_rank" | "deep_value_rank"): string {
    if (mode === "column") {
      return "テーブル見出しクリックで 1 軸ソート。人間の直感で追うモード。";
    }
    if (mode === "dip_rank") {
      return "押し目（Dip）探索。Z=日次Alpha乖離のZ-Score（短期の温度差。ニュース/需給ノイズも含む）は 0σ 付近＝「短期的には平常」を優先しつつ、落率が深い銘柄を上位へ。構造の強さは CUM・A（累積Alpha）で見ます。";
    }
    return "深掘り（Deep）探索。Z（短期の温度差）が強くマイナス＝直近だけ相対的に冷えた銘柄を上位へ（構造毀損の断定ではない）。落率と CUM・A（構造の年輪）を併読して、調査優先度を作ります。";
  }

  function toggleEcoSort(next: typeof ecoSortKey) {
    if (next === ecoSortKey)
      setEcoSortDir((d) => (d === "asc" ? "desc" : "asc"));
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
    if (holder === "エル" || holder === "ロンリード")
      return "bg-blue-100 text-blue-800";
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
          <span
            className="text-base leading-none"
            aria-label="Dividend month"
            title="今月が配当月"
          >
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

  const canRenderContent = data != null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="mx-auto w-full max-w-6xl lg:max-w-7xl 2xl:max-w-[90rem] space-y-8">
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
              <h1 className="text-3xl font-bold text-white tracking-tight">
                {themeDisplayName}
              </h1>
              <p className="text-[11px] text-slate-600 mt-2">
                <span className="font-mono text-slate-500">
                  {DEFAULT_USER_ID}
                </span>
                ・<span className="font-mono">structure_tags[0]</span>{" "}
                がこのテーマ名と一致する保有のみ
              </p>
            </div>
            {data?.benchmarkLatestPrice != null &&
            data.benchmarkLatestPrice > 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-right shrink-0">
                <p className="text-[9px] font-bold uppercase text-slate-500">
                  VOO (ref)
                </p>
                <p className="font-mono text-lg text-slate-200">
                  {data.benchmarkLatestPrice.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            ) : null}
          </div>
        </header>

        {loading ? (
          <div className="text-sm text-slate-500">
            読み込み中…
            {slowLoading ? (
              <span className="ml-2 text-slate-500">
                通信に時間がかかっています...
              </span>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5">
            <p className="text-sm font-bold text-rose-300">データ取得に失敗しました</p>
            <p className="text-xs text-rose-200/80 mt-1">{error}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  const ac = new AbortController();
                  void load(ac.signal);
                }}
                className="h-9 px-4"
                disabled={loading}
              >
                再読み込み（Retry）
              </Button>
              {canRenderContent ? (
                <span className="text-[11px] text-slate-500 self-center">
                  直近の表示内容を維持しています
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Initial skeleton (prevents layout jump when data is empty / slow / offline) */}
        {loading && !canRenderContent ? (
          <div className="space-y-4" aria-busy="true">
            <div className="h-36 rounded-2xl border border-slate-800 bg-slate-900/40 animate-pulse" />
            <div className="h-28 rounded-2xl border border-slate-800 bg-slate-900/40 animate-pulse" />
            <div className="h-72 rounded-2xl border border-slate-800 bg-slate-900/40 animate-pulse" />
            <div className="h-80 rounded-2xl border border-slate-800 bg-slate-900/40 animate-pulse" />
          </div>
        ) : null}

        {canRenderContent ? (
          <>
            <ThemeMetaBlock theme={theme} themeName={themeLabel} />

            {themeLabel === "SaaSアポカリプス" ? <SaaSApocalypseLensPanel /> : null}

            {isSemiconductorSupplyChainTheme ? (
              <SemiconductorSupplyChainObservationPanel
                rows={supplyChainCatalogRows ?? []}
              />
            ) : null}

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
                    {data.themeTotalMarketValue > 0
                      ? jpyFmt.format(data.themeTotalMarketValue)
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-slate-500">
                    銘柄数
                  </p>
                  <p className="text-xl font-mono font-bold text-slate-100 mt-1">
                    {stocks.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-slate-500">
                    平均含み損益率
                  </p>
                  <p
                    className={`text-xl font-mono font-bold mt-1 ${pctClass(data.themeAverageUnrealizedPnlPercent)}`}
                  >
                    {fmtPct(data.themeAverageUnrealizedPnlPercent)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-slate-500">
                    平均 Alpha（日次）
                  </p>
                  <p
                    className={`text-xl font-mono font-bold mt-1 ${pctClass(data.themeAverageAlpha)}`}
                  >
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
                <p className="text-lg font-bold text-slate-100 leading-snug">
                  {themeAdoptionMaturity.headline}
                </p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  {themeAdoptionMaturity.detail}
                </p>
                {quoripsWatch?.adoptionStage === "chasm" ? (
                  <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/95 mb-1">
                      クオリプス（4894）× キャズム
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      再生医療（iPS
                      心筋等）は臨床・規制・製造の峡谷に位置しやすく、
                      <span className="text-cyan-300/95 font-semibold">
                        {" "}
                        日次 Alpha（Z・累積トレンドのズレ）
                      </span>
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
                          <p className="font-mono font-bold text-slate-100 text-sm">
                            {s.ticker}
                          </p>
                          {s.name ? (
                            <p
                              className="text-[9px] text-slate-500 truncate"
                              title={s.name}
                            >
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
                            {s.alphaHistory[s.alphaHistory.length - 1]! > 0
                              ? "+"
                              : ""}
                            {s.alphaHistory[s.alphaHistory.length - 1]}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-600">—</span>
                        )}
                      </div>
                      <div className="flex-1 flex items-center justify-center min-h-[3rem]">
                        {s.alphaHistory.length === 0 ? (
                          <span className="text-[10px] text-slate-600">
                            No series
                          </span>
                        ) : (
                          <TrendMiniChart history={s.alphaHistory} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {stocks.length > 0 ? (
              <InventoryTable
                stocks={stocks}
                totalHoldings={stocks.length}
                averageAlpha={data.themeAverageAlpha}
                userId={DEFAULT_USER_ID}
                onEarningsNoteSaved={() => {
                  const ac = new AbortController();
                  void load(ac.signal);
                }}
                onTrade={(init) =>
                  openTradeForm({ ...init, themeId: theme?.id ?? init.themeId })
                }
                onTradeNew={() => openTradeForm(null)}
                themeStructuralTrendUp={themeStructuralTrendUp}
              />
            ) : null}

            {stocks.length > 0 ||
            (data.ecosystem?.length ?? 0) > 0 ||
            theme?.id != null ? (
              <ThemeStructuralTrendChart
                series={data.themeStructuralTrendSeries}
                totalPct={data.themeStructuralTrendTotalPct}
                lookbackDays={THEME_STRUCTURAL_TREND_LOOKBACK_DAYS}
                startDateLabel={data.themeStructuralTrendStartDate}
              />
            ) : null}

            {theme?.id ? (
              <section
                aria-labelledby="theme-ecosystem-add-heading"
                className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6 space-y-4"
              >
                <div className="flex items-start gap-2">
                  <UserPlus
                    size={16}
                    className="text-amber-500/90 shrink-0 mt-0.5"
                    aria-hidden
                  />
                  <div>
                    <h2
                      id="theme-ecosystem-add-heading"
                      className="text-xs font-bold text-slate-400 uppercase tracking-widest"
                    >
                      Ecosystem · 銘柄を追加
                    </h2>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      Ticker・追加日（観測開始）・Importance・Role
                      を登録してウォッチリストへ追加します（同一テーマ内の
                      ticker 重複は不可）
                    </p>
                  </div>
                </div>
                <form
                  onSubmit={handleAddEcosystemMember}
                  className="flex flex-col gap-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[7.5rem_10.5rem_11rem_1fr_auto] gap-4 items-end">
                    <div className="space-y-1.5 min-w-0">
                      <label
                        htmlFor="eco-add-ticker"
                        className="text-[10px] font-bold uppercase tracking-wide text-slate-500"
                      >
                        Ticker
                      </label>
                      <Input
                        id="eco-add-ticker"
                        value={addTicker}
                        onChange={(e) => setAddTicker(e.target.value)}
                        placeholder="例: AAPL"
                        aria-invalid={addTickerDuplicate}
                        className={cn(
                          "font-mono",
                          addTickerDuplicate
                            ? "border-rose-500/80 focus-visible:ring-rose-500/40"
                            : undefined,
                        )}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label
                        htmlFor="eco-add-started-at"
                        className="text-[10px] font-bold uppercase tracking-wide text-slate-500"
                      >
                        追加日（観測開始）
                      </label>
                      <Input
                        id="eco-add-started-at"
                        type="date"
                        value={addObservationStartedAt}
                        onChange={(e) => setAddObservationStartedAt(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label
                        htmlFor="eco-add-importance"
                        className="text-[10px] font-bold uppercase tracking-wide text-slate-500"
                      >
                        Importance
                      </label>
                      <select
                        id="eco-add-importance"
                        value={addImportance}
                        onChange={(e) =>
                          setAddImportance(
                            e.target.value === "major" ? "major" : "standard",
                          )
                        }
                        className={cn(
                          "flex h-9 w-full rounded-md border border-slate-700 bg-slate-950/80 px-3 py-1 text-sm text-slate-200 shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500/40",
                        )}
                      >
                        <option value="standard">通常</option>
                        <option value="major">メジャー（Major）</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label
                        htmlFor="eco-add-role"
                        className="text-[10px] font-bold uppercase tracking-wide text-slate-500"
                      >
                        Role
                      </label>
                      <Input
                        id="eco-add-role"
                        value={addRole}
                        onChange={(e) => setAddRole(e.target.value)}
                        placeholder="江戸的役割・メモ"
                        autoComplete="off"
                      />
                    </div>
                    <div className="w-full md:w-auto shrink-0">
                      <Button
                        type="submit"
                        disabled={
                          !addTicker.trim() ||
                          addTickerDuplicate ||
                          addSubmitting
                        }
                        className="w-full md:w-auto px-5 h-9"
                      >
                        {addSubmitting ? "追加中…" : "追加"}
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600 min-h-[1.1rem]">
                    {addTickerDuplicate ? (
                      <span className="text-rose-400">
                        この銘柄は既に登録済み
                      </span>
                    ) : addCompanyNameLoading ? (
                      <span className="font-mono text-slate-500">
                        Resolving name…
                      </span>
                    ) : addCompanyName ? (
                      <span className="text-slate-400">{addCompanyName}</span>
                    ) : (
                      <span className="font-mono text-slate-700">—</span>
                    )}
                  </p>
                  {addTickerDuplicate ? (
                    <p className="text-xs text-rose-400" role="alert">
                      この銘柄は既にこのテーマに登録されています
                    </p>
                  ) : null}
                  {ecosystem.length === 0 ? (
                    <p className="text-[11px] text-slate-600">
                      まだウォッチリストに銘柄がありません。追加すると下のエコシステム表が表示されます。
                    </p>
                  ) : null}
                </form>
              </section>
            ) : null}

            {ecosystem.length > 0 ? (
              <section aria-labelledby="theme-ecosystem-heading">
                {isAiUnicornTheme ? (
                  <div className="mb-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {ecosystem
                      .filter((e) => e.isUnlisted)
                      .map((e) => (
                        <UnicornCard key={e.id} item={e} />
                      ))}
                  </div>
                ) : null}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="p-5 border-b border-slate-800 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between bg-slate-900/50">
                    <div className="flex items-start gap-2 min-w-0">
                      <Layers
                        size={16}
                        className="text-amber-500/90 shrink-0 mt-0.5"
                      />
                      <div>
                        <h2
                          id="theme-ecosystem-heading"
                          className="text-xs font-bold text-slate-400 uppercase tracking-widest"
                        >
                          Ecosystem map / Watchlist
                        </h2>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          テーマ設置日起点の累積 Alpha（VOO
                          比）で観測。ポートフォリオ外の重要銘柄も含む（Notion
                          連携）
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                        <label className="relative flex items-center min-w-[12rem] flex-1 sm:flex-initial sm:max-w-[16rem]">
                          <span className="sr-only">エコシステム検索</span>
                          <Search
                            size={14}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none shrink-0"
                            aria-hidden
                          />
                          <input
                            type="search"
                            value={ecosystemSearchQuery}
                            onChange={(ev) =>
                              setEcosystemSearchQuery(ev.target.value)
                            }
                            placeholder="銘柄・役割・ノートで検索"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950/80 pl-8 pr-3 py-2 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/40"
                            autoComplete="off"
                          />
                        </label>
                        <div
                          className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/40 p-1"
                          role="group"
                          aria-label="市場フィルター"
                        >
                          <button
                            type="button"
                            onClick={() => setEcoMarketFilter("all")}
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-md border transition-colors",
                              ecoMarketFilter === "all"
                                ? "text-cyan-300 border-cyan-500/45 bg-cyan-500/10"
                                : "text-slate-500 border-transparent hover:bg-slate-800/60",
                            )}
                          >
                            すべて
                          </button>
                          <button
                            type="button"
                            onClick={() => setEcoMarketFilter("jp")}
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-md border transition-colors",
                              ecoMarketFilter === "jp"
                                ? "text-emerald-300 border-emerald-500/45 bg-emerald-500/10"
                                : "text-slate-500 border-transparent hover:bg-slate-800/60",
                            )}
                          >
                            日本
                          </button>
                          <button
                            type="button"
                            onClick={() => setEcoMarketFilter("us")}
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-md border transition-colors",
                              ecoMarketFilter === "us"
                                ? "text-sky-300 border-sky-500/45 bg-sky-500/10"
                                : "text-slate-500 border-transparent hover:bg-slate-800/60",
                            )}
                          >
                            米国
                          </button>
                        </div>
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
                        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            分析
                          </span>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setEcoSortModeOpen((v) => !v)}
                              className={cn(
                                "rounded-md border px-2 py-1 text-[11px] font-bold transition-colors",
                                "border-slate-800 bg-slate-950/70 text-slate-200 hover:bg-slate-900/60",
                                "focus:outline-none focus:ring-1 focus:ring-cyan-500/40",
                              )}
                              aria-label="Ecosystem 分析ソート"
                              title="CUM・A / 乖離 / 落率を組み合わせて優先順位を作る"
                            >
                              {ecoSortModeLabel(ecoSortMode)}
                            </button>
                            {ecoSortModeOpen ? (
                              <div
                                className="absolute right-0 mt-2 w-[22rem] max-w-[86vw] rounded-xl border border-slate-800 bg-slate-950/95 shadow-2xl z-30 overflow-hidden"
                                role="listbox"
                                aria-label="分析ソート選択肢"
                              >
                                {(
                                  [
                                    "column",
                                    "dip_rank",
                                    "deep_value_rank",
                                  ] as const
                                ).map((mode) => {
                                  const selected = mode === ecoSortMode;
                                  const hovered = mode === ecoSortModeHover;
                                  return (
                                    <button
                                      key={mode}
                                      type="button"
                                      role="option"
                                      aria-selected={selected}
                                      onMouseEnter={() => setEcoSortModeHover(mode)}
                                      onMouseLeave={() => setEcoSortModeHover(null)}
                                      onClick={() => {
                                        setEcoSortMode(mode);
                                        setEcoSortModeOpen(false);
                                      }}
                                      className={cn(
                                        "w-full text-left px-3 py-2.5 border-b border-slate-800/80",
                                        "hover:bg-slate-900/60 transition-colors",
                                        selected
                                          ? "bg-cyan-500/10"
                                          : "bg-transparent",
                                      )}
                                      title={ecoSortModeHelp(mode)}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p
                                            className={cn(
                                              "text-[11px] font-bold",
                                              selected
                                                ? "text-cyan-200"
                                                : "text-slate-200",
                                            )}
                                          >
                                            {ecoSortModeLabel(mode)}
                                          </p>
                                          <p
                                            className={cn(
                                              "text-[10px] leading-relaxed mt-1",
                                              hovered || selected
                                                ? "text-slate-400"
                                                : "text-slate-600",
                                            )}
                                          >
                                            {ecoSortModeHelp(mode)}
                                          </p>
                                        </div>
                                        {selected ? (
                                          <span className="text-[10px] font-bold text-cyan-300 shrink-0">
                                            選択中
                                          </span>
                                        ) : null}
                                      </div>
                                    </button>
                                  );
                                })}
                                <div className="px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => setEcoSortModeOpen(false)}
                                    className="text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:text-slate-300 transition-colors"
                                  >
                                    閉じる
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            PE
                          </span>
                          <input
                            inputMode="decimal"
                            value={ecoPeMin}
                            onChange={(e) => setEcoPeMin(e.target.value)}
                            placeholder="min"
                            className="w-14 rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                            aria-label="PE 最小"
                          />
                          <span className="text-[10px] text-slate-700">-</span>
                          <input
                            inputMode="decimal"
                            value={ecoPeMax}
                            onChange={(e) => setEcoPeMax(e.target.value)}
                            placeholder="max"
                            className="w-14 rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                            aria-label="PE 最大"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setEcoEpsPositiveOnly((v) => !v)}
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-colors",
                            ecoEpsPositiveOnly
                              ? "text-rose-200 border-rose-500/45 bg-rose-500/10"
                              : "text-slate-500 border-slate-700 hover:bg-slate-800/60",
                          )}
                          title="EPS > 0（黒字）の銘柄のみ"
                        >
                          黒字のみ
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
                      {isDefensiveTheme && defensiveHolders.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                              HOLDER フィルター（複数選択）
                            </p>
                            <button
                              type="button"
                              onClick={() => setHolderFilter([])}
                              disabled={holderFilter.length === 0}
                              className="text-[10px] font-bold uppercase tracking-wide text-slate-500 border border-slate-700 px-2 py-1 rounded-md hover:bg-slate-800/60 transition-colors disabled:opacity-40"
                            >
                              クリア
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {defensiveHolders.map((h) => {
                              const on = holderFilterSet.has(h);
                              return (
                                <button
                                  key={h}
                                  type="button"
                                  onClick={() =>
                                    setHolderFilter((cur) =>
                                      cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h],
                                    )
                                  }
                                  className={cn(
                                    "text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full border transition-colors",
                                    on
                                      ? "text-rose-100 border-rose-400/40 bg-rose-500/15"
                                      : "text-slate-400 border-slate-700 bg-slate-900/30 hover:bg-slate-800/60",
                                  )}
                                >
                                  {h}
                                </button>
                              );
                            })}
                          </div>
                          {defensiveHolderStats ? (
                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                                Slice stats
                              </p>
                              <div className="text-[11px] font-mono text-slate-400 flex flex-wrap gap-x-5 gap-y-1">
                                <span>
                                  件数{" "}
                                  <span className="text-slate-200 font-bold tabular-nums">
                                    {defensiveHolderStats.count}
                                  </span>{" "}
                                  / PF{" "}
                                  <span className="text-slate-200 font-bold tabular-nums">
                                    {defensiveHolderStats.inPortfolio}
                                  </span>
                                </span>
                                <span>
                                  平均 Cumα{" "}
                                  <span
                                    className={cn(
                                      "font-bold tabular-nums",
                                      defensiveHolderStats.avgLatestAlpha != null
                                        ? defensiveHolderStats.avgLatestAlpha > 0
                                          ? "text-emerald-300"
                                          : defensiveHolderStats.avgLatestAlpha < 0
                                            ? "text-rose-300"
                                            : "text-slate-300"
                                        : "text-slate-500",
                                    )}
                                  >
                                    {defensiveHolderStats.avgLatestAlpha != null
                                      ? `${defensiveHolderStats.avgLatestAlpha > 0 ? "+" : ""}${defensiveHolderStats.avgLatestAlpha.toFixed(2)}%`
                                      : "—"}
                                  </span>
                                </span>
                                <span>
                                  平均 Z{" "}
                                  <span
                                    className={cn(
                                      "font-bold tabular-nums",
                                      defensiveHolderStats.avgDeviationZ != null
                                        ? defensiveHolderStats.avgDeviationZ <= -1.0
                                          ? "text-amber-300"
                                          : defensiveHolderStats.avgDeviationZ >= 1.0
                                            ? "text-emerald-300"
                                            : "text-slate-300"
                                        : "text-slate-500",
                                    )}
                                  >
                                    {defensiveHolderStats.avgDeviationZ != null
                                      ? `${defensiveHolderStats.avgDeviationZ > 0 ? "+" : ""}${defensiveHolderStats.avgDeviationZ.toFixed(2)}σ`
                                      : "—"}
                                  </span>
                                </span>
                                <span>
                                  平均 Div{" "}
                                  <span className="text-slate-200 font-bold tabular-nums">
                                    {defensiveHolderStats.avgDividendYield != null
                                      ? `${defensiveHolderStats.avgDividendYield.toFixed(2)}%`
                                      : "—"}
                                  </span>
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <p className="text-[10px] font-mono text-slate-600 text-right flex flex-wrap items-center justify-end gap-2">
                        {hydratingFull ? (
                          <span className="text-cyan-400/90 font-sans font-bold normal-case tracking-normal animate-pulse">
                            Alpha・Research 読込中…
                          </span>
                        ) : null}
                        <span>
                          {patrolOn ||
                          postChasmOnly ||
                          ecosystemSearchQuery.trim().length > 0 ||
                          ecoMarketFilter !== "all"
                            ? `表示 ${ecosystemSorted.length} / 全 ${ecosystem.length} 銘柄`
                            : `計 ${ecosystem.length} 銘柄`}
                        </span>
                      </p>
                    </div>
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
                              <th className="px-6 py-4 text-left whitespace-nowrap">
                                Holder
                              </th>
                              <th className="px-6 py-4 text-left whitespace-nowrap">
                                Dividend
                              </th>
                              <th className="px-6 py-4 text-left whitespace-nowrap">
                                Defensive role
                              </th>
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
                              <th className="px-6 py-4 text-left whitespace-nowrap">
                                江戸的役割
                              </th>
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
                            className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            onClick={() => toggleEcoSort("pe")}
                            title="Sort"
                          >
                            PE{ecoSortMark("pe")}
                          </th>
                          <th
                            className="px-6 py-4 text-right cursor-pointer select-none whitespace-nowrap"
                            onClick={() => toggleEcoSort("eps")}
                            title="Sort"
                          >
                            EPS{ecoSortMark("eps")}
                          </th>
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
                        (patrolOn ||
                          postChasmOnly ||
                          ecosystemSearchQuery.trim().length > 0 ||
                          ecoMarketFilter !== "all" ||
                          ecoPeMin.trim().length > 0 ||
                          ecoPeMax.trim().length > 0 ||
                          ecoEpsPositiveOnly) ? (
                          <tr>
                            <td
                              colSpan={ecosystemColSpan}
                              className="px-6 py-8 text-center text-sm text-slate-500"
                            >
                              {(() => {
                                const q =
                                  ecosystemSearchQuery.trim().length > 0;
                                const marketOnly =
                                  ecoMarketFilter !== "all" &&
                                  !patrolOn &&
                                  !postChasmOnly &&
                                  !q;
                                if (q) return "該当する構造が見つかりません";
                                if (marketOnly && ecoMarketFilter === "jp") {
                                  return "日本市場に該当する銘柄がありません。";
                                }
                                if (marketOnly && ecoMarketFilter === "us") {
                                  return "米国市場に該当する銘柄がありません。";
                                }
                                if (postChasmOnly && !patrolOn) {
                                  return "キャズム超え（アーリー／レイトマジョリティ）に該当する銘柄がありません。DB の adoption_stage を設定してください。";
                                }
                                if (patrolOn && !postChasmOnly) {
                                  return "割安パトロールの条件に合う銘柄がありません（乖離 Z≤−1.5 または 高値比 ≤−12%）。";
                                }
                                return "フィルター条件に合う銘柄がありません。";
                              })()}
                            </td>
                          </tr>
                        ) : null}
                        {ecosystemSorted.map((e, idx) => {
                          const prev =
                            idx > 0 ? ecosystemSorted[idx - 1] : null;
                          const field = fieldLabelOf(e);
                          const prevField = prev ? fieldLabelOf(prev) : null;
                          const showFieldHeader =
                            idx === 0 || field !== prevField;
                          const ecoOpp = ecoOpportunityRow(
                            e,
                            themeStructuralTrendUp,
                          );
                          const zEco =
                            e.alphaDeviationZ != null &&
                            Number.isFinite(e.alphaDeviationZ)
                              ? e.alphaDeviationZ
                              : null;
                          const ddEco =
                            e.drawdownFromHigh90dPct != null &&
                            Number.isFinite(e.drawdownFromHigh90dPct)
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
                                    colSpan={Math.max(1, ecosystemColSpan - 1)}
                                    className="border-b border-slate-800 bg-slate-950/90 px-6 py-2"
                                    aria-hidden
                                  />
                                </tr>
                              ) : null}
                              <tr className="group hover:bg-slate-800/40 transition-all">
                                <td
                                  className={`px-6 py-4 min-w-[10rem] max-w-[14rem] ${stickyTdFirst}`}
                                >
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
                                          <span className="break-all">
                                            {e.ticker}
                                          </span>
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
                                      <span
                                        className="text-[10px] text-slate-400 leading-snug line-clamp-2"
                                        title={e.companyName}
                                      >
                                        {e.companyName}
                                      </span>
                                    ) : null}
                                    {ecoEditingId === e.id ? (
                                      <div className="mt-2 space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          <div className="space-y-1">
                                            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                                              Company
                                            </p>
                                            <Input
                                              value={ecoEditCompanyName}
                                              onChange={(ev) =>
                                                setEcoEditCompanyName(
                                                  ev.target.value,
                                                )
                                              }
                                              placeholder="企業名（任意）"
                                              className="h-8 text-xs"
                                              autoComplete="off"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                                              Role
                                            </p>
                                            <Input
                                              value={ecoEditRole}
                                              onChange={(ev) =>
                                                setEcoEditRole(ev.target.value)
                                              }
                                              placeholder="役割（任意）"
                                              className="h-8 text-xs"
                                              autoComplete="off"
                                            />
                                          </div>
                                        </div>
                                        <label className="flex items-center gap-2 text-[10px] text-slate-400 select-none">
                                          <input
                                            type="checkbox"
                                            checked={ecoEditMajor}
                                            onChange={(ev) =>
                                              setEcoEditMajor(ev.target.checked)
                                            }
                                            className="accent-amber-500"
                                          />
                                          Major
                                        </label>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            type="button"
                                            onClick={() =>
                                              void saveEditEcosystem(e.id)
                                            }
                                            disabled={ecoEditSaving}
                                            className="h-8 px-3 text-xs"
                                          >
                                            {ecoEditSaving ? "保存中…" : "保存"}
                                          </Button>
                                          <button
                                            type="button"
                                            onClick={cancelEditEcosystem}
                                            className="h-8 px-3 rounded-md border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-800/60"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : null}
                                    {e.observationNotes
                                      ? (() => {
                                          const geo =
                                            extractGeopoliticalPotential(
                                              e.observationNotes,
                                            );
                                          return (
                                            <span
                                              className="text-[10px] text-slate-500 leading-snug line-clamp-2"
                                              title={e.observationNotes}
                                            >
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
                                        })()
                                      : null}
                                    {e.observationStartedAt ? (
                                      <span className="text-[10px] font-mono text-slate-600 pt-0.5">
                                        観測開始（投入）{" "}
                                        <span className="text-slate-500">
                                          {e.observationStartedAt}
                                        </span>
                                        {e.alphaObservationStartDate &&
                                        e.alphaObservationStartDate !==
                                          e.observationStartedAt ? (
                                          <span className="block text-[9px] text-slate-600 mt-0.5 font-normal">
                                            系列起点{" "}
                                            {e.alphaObservationStartDate}
                                          </span>
                                        ) : null}
                                      </span>
                                    ) : e.alphaObservationStartDate ? (
                                      <span className="text-[10px] font-mono text-slate-600 pt-0.5">
                                        観測起点{" "}
                                        <span className="text-slate-500">
                                          {e.alphaObservationStartDate}
                                        </span>
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
                                          <span className="text-xs text-slate-600">
                                            —
                                          </span>
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
                                          <p
                                            className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-3"
                                            title={e.role}
                                          >
                                            {e.role}
                                          </p>
                                        ) : (
                                          <span className="text-xs text-slate-600">
                                            —
                                          </span>
                                        )}
                                      </div>
                                      <div className="md:hidden">
                                        <p
                                          className="text-xs font-semibold text-slate-200 leading-snug line-clamp-2"
                                          title={e.defensiveStrength ?? e.role}
                                        >
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
                                              E:
                                              {e.daysToEarnings != null
                                                ? `D${e.daysToEarnings}`
                                                : e.nextEarningsDate}
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-slate-500">
                                              E:—
                                            </span>
                                          )}
                                          {e.dividendYieldPercent != null ? (
                                            <span
                                              className="text-[10px] font-bold text-slate-200 border border-slate-700 bg-slate-900/60 px-2 py-0.5 rounded-md"
                                              title={
                                                e.annualDividendRate != null
                                                  ? `年間配当: ${e.annualDividendRate}`
                                                  : "年間配当: —"
                                              }
                                            >
                                              Div:
                                              {e.dividendYieldPercent.toFixed(
                                                2,
                                              )}
                                              %
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-slate-500">
                                              Div:—
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4">
                                      {e.role ? (
                                        <div
                                          className="text-xs text-slate-300 leading-relaxed line-clamp-4"
                                          title={e.role}
                                        >
                                          {e.role}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-slate-600">
                                          —
                                        </span>
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
                                        isDefensiveTheme
                                          ? defensiveZClass(zEco)
                                          : zEco == null
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
                                  className="px-6 py-4 text-right font-mono font-bold tabular-nums whitespace-nowrap text-slate-200"
                                  title={
                                    e.trailingPe != null || e.forwardPe != null
                                      ? `PE trailing=${e.trailingPe ?? "—"} / forward=${e.forwardPe ?? "—"}`
                                      : "PE: 未取得"
                                  }
                                >
                                  {fmtPe(ecoPeOf(e))}
                                </td>
                                <td
                                  className={cn(
                                    "px-6 py-4 text-right font-mono font-bold tabular-nums whitespace-nowrap",
                                    (() => {
                                      const eps = ecoEpsOf(e);
                                      if (eps == null) return "text-slate-500";
                                      if (eps <= 0) return "text-rose-300";
                                      return "text-slate-200";
                                    })(),
                                  )}
                                  title={
                                    e.trailingEps != null || e.forwardEps != null
                                      ? `EPS trailing=${e.trailingEps ?? "—"} / forward=${e.forwardEps ?? "—"}`
                                      : "EPS: 未取得"
                                  }
                                >
                                  {fmtEps(ecoEpsOf(e))}
                                </td>
                                <td
                                  className={`px-6 py-4 text-right font-mono font-bold ${
                                    e.latestAlpha != null &&
                                    Number.isFinite(e.latestAlpha)
                                      ? pctClass(e.latestAlpha)
                                      : "text-slate-500"
                                  }`}
                                >
                                  {e.latestAlpha != null &&
                                  Number.isFinite(e.latestAlpha) ? (
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
                                        Proxy Momentum
                                        {e.proxyTicker
                                          ? ` (${e.proxyTicker})`
                                          : ""}
                                      </span>
                                    ) : null}
                                    <EcosystemCumulativeSparkline
                                      history={e.alphaHistory}
                                    />
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="font-mono text-slate-300 text-xs">
                                      {formatEcosystemCurrentPrice(e)}
                                    </span>
                                    {!e.inPortfolio ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openTradeForm({
                                            ticker:
                                              e.isUnlisted && e.proxyTicker
                                                ? e.proxyTicker
                                                : e.ticker,
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
                                    <div className="flex items-center gap-1">
                                      {ecoEditingId !== e.id ? (
                                        <button
                                          type="button"
                                          onClick={() => beginEditEcosystem(e)}
                                          className="text-[9px] font-bold uppercase tracking-wide text-slate-400 border border-slate-700 px-2 py-0.5 rounded-md hover:bg-slate-800/60"
                                        >
                                          Edit
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void deleteEcoMember(e.id, e.ticker)
                                        }
                                        className="text-[9px] font-bold uppercase tracking-wide text-rose-400 border border-rose-500/40 px-2 py-0.5 rounded-md hover:bg-rose-500/10"
                                      >
                                        Delete
                                      </button>
                                    </div>
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

            {stocks.length === 0 ? (
              <p className="text-sm text-slate-500">
                このテーマに該当する保有がありません。
              </p>
            ) : null}
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
          holdingOptions={stocks.map((s) => ({
            ticker: s.ticker,
            name: s.name,
          }))}
        />
      </div>
    </div>
  );
}
