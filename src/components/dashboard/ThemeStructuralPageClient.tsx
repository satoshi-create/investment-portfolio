"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  CircleSlash,
  Crosshair,
  FileSpreadsheet,
  Layers,
  Search,
  Star,
  TrendingUp,
  UserPlus,
  X,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { toast } from "sonner";

import { toggleThemeEcosystemMemberBookmark, toggleThemeEcosystemMemberKept } from "@/app/actions/theme-ecosystem";
import {
  type InvestmentThemeRecord,
  type ThemeDetailData,
  type ThemeEcosystemWatchItem,
  type TickerInstrumentKind,
  INVESTMENT_METRIC_TONE_TEXT_CLASS,
  investmentMetricToneForSignedPercent,
} from "@/src/types/investment";
import { judgmentPriorityRank, type JudgmentStatus } from "@/src/lib/judgment-logic";
import {
  ecoFcfYieldSortValue,
  ecoFcfYieldTone,
  ecoRuleOf40SortValue,
  ecoRuleOf40Tone,
} from "@/src/components/dashboard/eco-efficiency-display";
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
import { parseAlphaDailyHistoryJson } from "@/src/lib/eco-trend-daily";
import { cn } from "@/src/lib/cn";
import { USD_JPY_RATE_FALLBACK } from "@/src/lib/fx-constants";
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";
import { formatJpyValueForView, formatLocalPriceForView } from "@/src/lib/format-display-currency";
import {
  THEME_ECOSYSTEM_WATCHLIST_CSV_COLUMNS,
  themeEcosystemWatchlistToCsvRows,
} from "@/src/lib/csv-dashboard-presets";
import {
  exportToCSV,
  themeEcosystemWatchlistCsvFileName,
} from "@/src/lib/csv-export";
import { EcosystemCumulativeSparkline } from "@/src/components/dashboard/EcosystemCumulativeSparkline";
import { EcosystemKeepButton } from "@/src/components/dashboard/EcosystemKeepButton";
import { KeptStockShelf } from "@/src/components/dashboard/KeptStockShelf";
import { AiUnicornTrendPulse } from "@/src/components/dashboard/AiUnicornTrendPulse";
import { AiUnicornMiningSchedule } from "@/src/components/dashboard/AiUnicornMiningSchedule";
import { AiUnicornCreditSeam } from "@/src/components/dashboard/AiUnicornCreditSeam";
import { SemiconductorSupplyChainObservationPanel } from "@/src/components/dashboard/SemiconductorSupplyChainObservationPanel";
import { SaaSApocalypseLensPanel } from "@/src/components/dashboard/SaaSApocalypseLensPanel";
import { ThemeStructuralTrendChart } from "@/src/components/dashboard/ThemeStructuralTrendChart";
import { InventoryTable } from "@/src/components/dashboard/InventoryTable";
import { UnicornCard } from "@/src/components/dashboard/UnicornCard";
import {
  TradeEntryForm,
  type TradeEntryInitial,
} from "@/src/components/dashboard/TradeEntryForm";
import { EarningsNoteMarkdownPreview } from "@/src/components/dashboard/EarningsNoteMarkdownPreview";
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
import {
  DEFAULT_ECOSYSTEM_WATCHLIST_COLUMN_ORDER,
  loadEcosystemWatchlistColumnOrder,
  saveEcosystemWatchlistColumnOrder,
  visibleEcoColumnsStructural,
  type EcosystemWatchlistColId,
} from "@/src/lib/ecosystem-watchlist-column-order";
import {
  applyEcosystemWatchlistUserHidden,
  loadEcosystemWatchlistHiddenColumns,
  loadEcosystemWatchlistTableCompact,
  saveEcosystemWatchlistHiddenColumns,
  saveEcosystemWatchlistTableCompact,
} from "@/src/lib/ecosystem-watchlist-column-visibility";
import { EcosystemWatchlistColumnToolbar } from "@/src/components/dashboard/EcosystemWatchlistColumnToolbar";
import { EcosystemThemeTableMappedRow } from "@/src/components/dashboard/EcosystemThemeTableMappedRow";
import {
  StructuralEcosystemThead,
  type StructuralEcoSortKey,
} from "@/src/components/dashboard/StructuralEcosystemThead";
import { BitcoinThemePriceComparisonChart } from "@/src/components/dashboard/BitcoinThemePriceComparisonChart";
import {
  BitcoinStructuralHeaderAside,
  BitcoinStructuralObservationPanel,
  type StructuralBtcGlancePayload,
} from "@/src/components/dashboard/BitcoinStructuralPanels";
import {
  BITCOIN_STRUCTURAL_THEME_QUERY_NAME,
  BITCOIN_STRUCTURAL_THEME_SLUG,
} from "@/src/lib/bitcoin-structural-theme";

const DEFAULT_USER_ID = defaultProfileUserId();

function ecosystemInstrumentKind(item: ThemeEcosystemWatchItem): TickerInstrumentKind {
  const k = item.instrumentKind;
  if (k === "US_EQUITY" || k === "JP_INVESTMENT_TRUST" || k === "JP_LISTED_EQUITY") return k;
  const proxy = item.proxyTicker != null ? String(item.proxyTicker).trim() : "";
  const eff = item.isUnlisted && proxy.length > 0 ? proxy : String(item.ticker).trim();
  return classifyTickerInstrument(eff.length > 0 ? eff : String(item.ticker).trim());
}

function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function pctClass(v: number): string {
  if (!Number.isFinite(v)) return "text-muted-foreground";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
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

function ecoListingYmdKey(e: ThemeEcosystemWatchItem): string | null {
  const d = e.listingDate;
  if (d == null || String(d).trim().length < 10) return null;
  const ymd = String(d).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function ecoListingYearLabel(e: ThemeEcosystemWatchItem): string {
  const fk = ecoListingYmdKey(e);
  if (fk == null) return "—";
  return fk.slice(0, 4);
}

function ecoFmtMarketCapShort(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = Math.abs(n);
  if (v >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function ecoEarningsSortValue(e: ThemeEcosystemWatchItem): number | null {
  const d = e.daysToEarnings;
  if (d == null || !Number.isFinite(d) || d < 0) return null;
  return d;
}

/** 配当（Dividend）列ソート: 未来の権利落ちが近いほど小さい。未取得は末尾。過去のみは未来より後ろ。 */
function ecoDividendSortScore(e: ThemeEcosystemWatchItem): number {
  const d = e.daysToExDividend;
  if (d == null || !Number.isFinite(d)) return 1e9;
  if (d >= 0) return d;
  return 20000 + d;
}

function ecoHasUsableQuote(e: ThemeEcosystemWatchItem): boolean {
  return e.currentPrice != null && Number.isFinite(e.currentPrice) && e.currentPrice > 0;
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
  if (s.toLowerCase() === BITCOIN_STRUCTURAL_THEME_SLUG) {
    return {
      query: BITCOIN_STRUCTURAL_THEME_QUERY_NAME,
      display: BITCOIN_STRUCTURAL_THEME_QUERY_NAME,
      slug: BITCOIN_STRUCTURAL_THEME_SLUG,
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
    <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-5 md:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">
          Investment thesis
        </p>
        {theme?.description ? (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {theme.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            テーマ「{themeName}」の解説は未登録です。
            <span className="font-mono text-muted-foreground">investment_themes</span>{" "}
            に Notion から移行した{" "}
            <span className="font-mono">description</span>{" "}
            を投入すると表示されます。
          </p>
        )}
      </div>
      {theme?.goal ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Goal & milestones
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
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
          revenueGrowth: (() => {
            const v =
              (item as Record<string, unknown>).revenueGrowth ??
              (item as Record<string, unknown>).revenue_growth;
            const n = Number(v);
            return Number.isFinite(n) ? n : Number.NaN;
          })(),
          fcfMargin: (() => {
            const v =
              (item as Record<string, unknown>).fcfMargin ??
              (item as Record<string, unknown>).fcf_margin;
            const n = Number(v);
            return Number.isFinite(n) ? n : Number.NaN;
          })(),
          fcfYield: (() => {
            const v =
              (item as Record<string, unknown>).fcfYield ??
              (item as Record<string, unknown>).fcf_yield;
            const n = Number(v);
            return Number.isFinite(n) ? n : Number.NaN;
          })(),
          ruleOf40: (() => {
            const v =
              (item as Record<string, unknown>).ruleOf40 ??
              (item as Record<string, unknown>).rule_of_40;
            const n = Number(v);
            if (Number.isFinite(n)) return n;
            const rg = Number((item as Record<string, unknown>).revenueGrowth ?? (item as Record<string, unknown>).revenue_growth);
            const fm = Number((item as Record<string, unknown>).fcfMargin ?? (item as Record<string, unknown>).fcf_margin);
            return Number.isFinite(rg) && Number.isFinite(fm) ? rg + fm : Number.NaN;
          })(),
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
          isKept:
            typeof (item as Record<string, unknown>).isKept === "boolean"
              ? ((item as Record<string, unknown>).isKept as boolean)
              : Number((item as Record<string, unknown>).is_kept) === 1,
          judgmentStatus: ((): JudgmentStatus => {
            const raw =
              (item as Record<string, unknown>).judgmentStatus ??
              (item as Record<string, unknown>).judgment_status;
            const u = typeof raw === "string" ? raw.trim().toUpperCase() : "";
            if (u === "ELITE" || u === "ACCUMULATE" || u === "WATCH" || u === "DANGER") return u;
            return "WATCH";
          })(),
          judgmentReason: (() => {
            const a = (item as Record<string, unknown>).judgmentReason;
            const b = (item as Record<string, unknown>).judgment_reason;
            const s =
              typeof a === "string" && a.trim().length > 0
                ? a.trim()
                : typeof b === "string" && b.trim().length > 0
                  ? b.trim()
                  : "";
            return s.length > 0 ? s : "テーマAPIの再取得で理由を表示できます。";
          })(),
          listingDate:
            typeof item.listingDate === "string" && item.listingDate.trim().length >= 10
              ? item.listingDate.trim().slice(0, 10)
              : (typeof (item as Record<string, unknown>).foundedDate === "string" &&
                    String((item as Record<string, unknown>).foundedDate).trim().length >= 10
                  ? String((item as Record<string, unknown>).foundedDate).trim().slice(0, 10)
                  : null),
          marketCap:
            typeof item.marketCap === "number" && Number.isFinite(item.marketCap) ? item.marketCap : null,
          listingPrice:
            typeof item.listingPrice === "number" && Number.isFinite(item.listingPrice) ? item.listingPrice : null,
          memo: (() => {
            const a = (item as Record<string, unknown>).memo;
            const s = typeof a === "string" ? a.trim() : "";
            return s.length > 0 ? s : null;
          })(),
          isBookmarked:
            typeof item.isBookmarked === "boolean"
              ? item.isBookmarked
              : Number((item as Record<string, unknown>).is_bookmarked) === 1,
          performanceSinceFoundation: (() => {
            const v = (item as Record<string, unknown>).performanceSinceFoundation;
            return typeof v === "number" && Number.isFinite(v) ? v : null;
          })(),
          alphaDailyHistory: parseAlphaDailyHistoryJson(
            (item as Record<string, unknown>).alphaDailyHistory ??
              (item as Record<string, unknown>).alpha_daily_history,
          ),
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
    themeSyntheticUsRatio:
      typeof rest.themeSyntheticUsRatio === "number" && Number.isFinite(rest.themeSyntheticUsRatio)
        ? rest.themeSyntheticUsRatio
        : null,
    themeSyntheticJpRatio:
      typeof rest.themeSyntheticJpRatio === "number" && Number.isFinite(rest.themeSyntheticJpRatio)
        ? rest.themeSyntheticJpRatio
        : null,
    themeSyntheticBasis:
      rest.themeSyntheticBasis === "market_value" || rest.themeSyntheticBasis === "equal_count"
        ? rest.themeSyntheticBasis
        : null,
    themeBenchmarkVooClose:
      typeof rest.themeBenchmarkVooClose === "number" && Number.isFinite(rest.themeBenchmarkVooClose)
        ? rest.themeBenchmarkVooClose
        : null,
    themeBenchmarkTopixClose:
      typeof rest.themeBenchmarkTopixClose === "number" && Number.isFinite(rest.themeBenchmarkTopixClose)
        ? rest.themeBenchmarkTopixClose
        : null,
    themeSyntheticBenchmarkTooltip:
      typeof rest.themeSyntheticBenchmarkTooltip === "string" && rest.themeSyntheticBenchmarkTooltip.trim().length > 0
        ? rest.themeSyntheticBenchmarkTooltip.trim()
        : null,
    themeAverageFxNeutralAlpha:
      typeof rest.themeAverageFxNeutralAlpha === "number" && Number.isFinite(rest.themeAverageFxNeutralAlpha)
        ? rest.themeAverageFxNeutralAlpha
        : typeof rest.themeAverageAlpha === "number" && Number.isFinite(rest.themeAverageAlpha)
          ? rest.themeAverageAlpha
          : 0,
    fxUsdJpy:
      typeof rest.fxUsdJpy === "number" && Number.isFinite(rest.fxUsdJpy) && rest.fxUsdJpy > 0
        ? rest.fxUsdJpy
        : USD_JPY_RATE_FALLBACK,
  };
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
              : "bg-muted"
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
      <span className="text-xs text-muted-foreground" title={tip}>
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
      <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground leading-tight">
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
  const isBitcoinTheme = themeQueryName === BITCOIN_STRUCTURAL_THEME_QUERY_NAME;
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
  const [ecoSortKey, setEcoSortKey] = useState<StructuralEcoSortKey>("alpha");
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
  const [ecoEditListingDate, setEcoEditListingDate] = useState("");
  const [ecoEditMarketCap, setEcoEditMarketCap] = useState("");
  const [ecoEditListingPrice, setEcoEditListingPrice] = useState("");
  const [ecoEditSaving, setEcoEditSaving] = useState(false);
  const [ecoBookmarksOnly, setEcoBookmarksOnly] = useState(false);
  const [ecoHideIncompleteQuotes, setEcoHideIncompleteQuotes] = useState(false);
  const [ecoColumnOrder, setEcoColumnOrder] = useState<EcosystemWatchlistColId[]>(
    DEFAULT_ECOSYSTEM_WATCHLIST_COLUMN_ORDER,
  );
  const [ecoHiddenColumnIds, setEcoHiddenColumnIds] = useState<
    EcosystemWatchlistColId[]
  >([]);
  const [ecoTableCompact, setEcoTableCompact] = useState(false);
  const [ecoMemoTarget, setEcoMemoTarget] = useState<ThemeEcosystemWatchItem | null>(null);
  const [ecoMemoDraft, setEcoMemoDraft] = useState("");
  const [ecoMemoSaving, setEcoMemoSaving] = useState(false);
  const [ecoMemoModalTab, setEcoMemoModalTab] = useState<"edit" | "preview">("edit");
  /** Asset 列のカテゴリ（`field`）による複数選択フィルター */
  const [ecoFieldFilter, setEcoFieldFilter] = useState<string[]>([]);
  const [btcStructuralGlance, setBtcStructuralGlance] = useState<StructuralBtcGlancePayload | null>(
    null,
  );
  const [btcStructuralGlanceErr, setBtcStructuralGlanceErr] = useState<string | null>(null);
  const [btcStructuralGlanceLoading, setBtcStructuralGlanceLoading] = useState(false);

  /** `refetchThemeDetailQuiet` 並列時、古いレスポンスが `setData` しないよう世代管理 */
  const themeDetailQuietFetchGen = useRef(0);

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

  /** メモ保存・エコ編集後など: データのみ置き換え（`hydratingFull` は立てない。UI に「読み込み中」系を出さない） */
  const refetchThemeDetailQuiet = useCallback(
    async (signal: AbortSignal) => {
      const gen = ++themeDetailQuietFetchGen.current;
      const baseUrl = `/api/theme-detail?userId=${encodeURIComponent(DEFAULT_USER_ID)}&theme=${encodeURIComponent(themeQueryName)}`;
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
        setData((prev) => {
          if (gen !== themeDetailQuietFetchGen.current) return prev;
          return normalizeThemeDetailResponse(restFull);
        });
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
      }
    },
    [themeQueryName],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  useEffect(() => {
    if (!isBitcoinTheme) {
      setBtcStructuralGlance(null);
      setBtcStructuralGlanceErr(null);
      setBtcStructuralGlanceLoading(false);
      return;
    }
    const ac = new AbortController();
    setBtcStructuralGlanceLoading(true);
    setBtcStructuralGlanceErr(null);
    void fetch("/api/structural-btc-glance", { cache: "no-store", signal: ac.signal })
      .then(async (res) => {
        const j = (await res.json()) as StructuralBtcGlancePayload & { error?: string };
        if (!res.ok) {
          setBtcStructuralGlance(null);
          setBtcStructuralGlanceErr(j.error ?? `HTTP ${res.status}`);
          return;
        }
        setBtcStructuralGlance(j);
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setBtcStructuralGlance(null);
        setBtcStructuralGlanceErr(e instanceof Error ? e.message : "fetch failed");
      })
      .finally(() => {
        if (!ac.signal.aborted) setBtcStructuralGlanceLoading(false);
      });
    return () => ac.abort();
  }, [isBitcoinTheme]);

  const openTradeForm = useCallback((initial: TradeEntryInitial | null) => {
    setTradeInitial(initial);
    setTradeFormOpen(true);
  }, []);

  const stocks = data?.stocks ?? [];
  const {
    convert,
    viewCurrency,
    alphaDisplayMode,
    setViewCurrency,
    setAlphaDisplayMode,
    setFxRateFromQuote,
  } = useCurrencyConverter();

  useEffect(() => {
    if (data?.fxUsdJpy != null && Number.isFinite(data.fxUsdJpy) && data.fxUsdJpy > 0) {
      setFxRateFromQuote(data.fxUsdJpy);
    }
  }, [data?.fxUsdJpy, setFxRateFromQuote]);

  const formatEcoPriceForView = useCallback(
    (e: ThemeEcosystemWatchItem) => {
      if (e.currentPrice == null || !Number.isFinite(e.currentPrice) || e.currentPrice <= 0) return "—";
      const kind = ecosystemInstrumentKind(e);
      const native: "USD" | "JPY" = kind === "US_EQUITY" ? "USD" : "JPY";
      return formatLocalPriceForView(e.currentPrice, native, viewCurrency, convert);
    },
    [convert, viewCurrency],
  );

  const theme = data?.theme ?? null;
  const ecosystem = data?.ecosystem ?? [];
  const themeStructuralTrendSeries = data?.themeStructuralTrendSeries ?? [];
  const themeStructuralTrendUp = useMemo(
    () => isThemeStructuralTrendPositiveUp(themeStructuralTrendSeries),
    [themeStructuralTrendSeries],
  );

  /** 価格チャート比較用（代理ティッカー優先、N/A 行除外） */
  const bitcoinChartCompareTickers = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const e of ecosystem) {
      const proxy = e.proxyTicker != null ? String(e.proxyTicker).trim() : "";
      const raw = e.isUnlisted && proxy.length > 0 ? proxy : String(e.ticker).trim();
      if (raw.length === 0) continue;
      const u = raw.toUpperCase();
      if (u.startsWith("N/A:")) continue;
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
    return out;
  }, [ecosystem]);

  const handleToggleEcosystemBookmark = useCallback(
    async (memberId: string) => {
      const prevEntry = ecosystem.find((x) => x.id === memberId);
      if (!prevEntry) return;
      const optimistic = !prevEntry.isBookmarked;
      setData((cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          ecosystem: cur.ecosystem.map((x) =>
            x.id === memberId ? { ...x, isBookmarked: optimistic } : x,
          ),
        };
      });
      const res = await toggleThemeEcosystemMemberBookmark(memberId, {
        themeSlugForRevalidate: themeQueryName,
      });
      if (!res.ok) {
        toast.error(res.message ?? "ブックマーク更新に失敗しました");
        setData((cur) => {
          if (!cur) return cur;
          return {
            ...cur,
            ecosystem: cur.ecosystem.map((x) =>
              x.id === memberId ? { ...x, isBookmarked: prevEntry.isBookmarked } : x,
            ),
          };
        });
        return;
      }
      if (res.isBookmarked !== undefined) {
        setData((cur) => {
          if (!cur) return cur;
          return {
            ...cur,
            ecosystem: cur.ecosystem.map((x) =>
              x.id === memberId ? { ...x, isBookmarked: res.isBookmarked! } : x,
            ),
          };
        });
      }
    },
    [ecosystem, themeQueryName],
  );

  const handleToggleEcosystemKeep = useCallback(
    async (memberId: string) => {
      const prevEntry = ecosystem.find((x) => x.id === memberId);
      if (!prevEntry) return;
      const optimistic = !prevEntry.isKept;
      setData((cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          ecosystem: cur.ecosystem.map((x) =>
            x.id === memberId ? { ...x, isKept: optimistic } : x,
          ),
        };
      });
      const res = await toggleThemeEcosystemMemberKept(memberId, {
        themeSlugForRevalidate: themeQueryName,
      });
      if (!res.ok) {
        toast.error(res.message ?? "キープ状態の更新に失敗しました");
        setData((cur) => {
          if (!cur) return cur;
          return {
            ...cur,
            ecosystem: cur.ecosystem.map((x) =>
              x.id === memberId ? { ...x, isKept: prevEntry.isKept } : x,
            ),
          };
        });
        return;
      }
      if (res.isKept !== undefined) {
        setData((cur) => {
          if (!cur) return cur;
          return {
            ...cur,
            ecosystem: cur.ecosystem.map((x) =>
              x.id === memberId ? { ...x, isKept: res.isKept! } : x,
            ),
          };
        });
      }
    },
    [ecosystem, themeQueryName],
  );

  const resolveEcosystemKeepForTicker = useCallback(
    (ticker: string) => {
      const u = ticker.trim().toUpperCase();
      for (const e of ecosystem) {
        const proxy = e.proxyTicker != null ? e.proxyTicker.trim().toUpperCase() : "";
        const tk = e.ticker.trim().toUpperCase();
        if (tk === u || (proxy.length > 0 && proxy === u)) {
          return { memberId: e.id, isKept: e.isKept };
        }
      }
      return null;
    },
    [ecosystem],
  );

  const themeAvgAlphaDisplayed = useMemo(() => {
    if (data == null) return 0;
    return alphaDisplayMode === "fxNeutral"
      ? data.themeAverageFxNeutralAlpha
      : data.themeAverageAlpha;
  }, [data, alphaDisplayMode]);

  const ecosystemEfficiencySummary = useMemo(() => {
    const finite = (n: number) => Number.isFinite(n);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const r40s = ecosystem.map((e) => e.ruleOf40).filter(finite);
    const fys = ecosystem.map((e) => e.fcfYield).filter(finite);
    return {
      avgRuleOf40: avg(r40s),
      avgFcfYield: avg(fys),
      countRuleOf40: r40s.length,
      countFcfYield: fys.length,
    };
  }, [ecosystem]);

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

  const ecoFieldLabels = useMemo(() => {
    const s = new Set<string>();
    for (const e of ecosystem) {
      s.add(fieldLabelOf(e));
    }
    return [...s].sort((a, b) => a.localeCompare(b, "ja"));
  }, [ecosystem]);

  const ecoFieldFilterSet = useMemo(
    () => new Set(ecoFieldFilter.map((x) => x.trim()).filter(Boolean)),
    [ecoFieldFilter],
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
    setEcoEditListingDate(
      typeof e.listingDate === "string" && e.listingDate.trim().length >= 10 ? e.listingDate.trim().slice(0, 10) : "",
    );
    setEcoEditMarketCap(e.marketCap != null && Number.isFinite(e.marketCap) ? String(e.marketCap) : "");
    setEcoEditListingPrice(e.listingPrice != null && Number.isFinite(e.listingPrice) ? String(e.listingPrice) : "");
  }, []);

  const cancelEditEcosystem = useCallback(() => {
    setEcoEditingId(null);
    setEcoEditCompanyName("");
    setEcoEditRole("");
    setEcoEditMajor(false);
    setEcoEditListingDate("");
    setEcoEditMarketCap("");
    setEcoEditListingPrice("");
    setEcoEditSaving(false);
  }, []);

  const saveEditEcosystem = useCallback(
    async (memberId: string) => {
      if (!theme?.id || ecoEditSaving) return;
      const fd = ecoEditListingDate.trim();
      if (fd.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(fd)) {
        toast.error("初回取引日は YYYY-MM-DD で入力してください（空でクリア）");
        return;
      }
      const mcRaw = ecoEditMarketCap.trim().replace(/,/g, "");
      let marketCapPayload: number | null;
      if (mcRaw === "") {
        marketCapPayload = null;
      } else {
        const n = Number(mcRaw);
        if (!Number.isFinite(n)) {
          toast.error("時価総額は数値で入力してください（空でクリア）");
          return;
        }
        marketCapPayload = n;
      }
      const lpRaw = ecoEditListingPrice.trim().replace(/,/g, "");
      let listingPricePayload: number | null;
      if (lpRaw === "") {
        listingPricePayload = null;
      } else {
        const n = Number(lpRaw);
        if (!Number.isFinite(n)) {
          toast.error("listing_price（フォールバック用）は数値で入力してください（空でクリア）");
          return;
        }
        listingPricePayload = n;
      }
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
            listingDate: fd === "" ? null : fd,
            marketCap: marketCapPayload,
            listingPrice: listingPricePayload,
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
      ecoEditListingDate,
      ecoEditListingPrice,
      ecoEditMajor,
      ecoEditMarketCap,
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
    if (ecoMemoTarget) {
      setEcoMemoDraft(ecoMemoTarget.memo ?? "");
      setEcoMemoModalTab("edit");
    }
  }, [ecoMemoTarget]);

  const saveEcoMemberMemo = useCallback(
    async () => {
      if (!theme?.id || !ecoMemoTarget || ecoMemoSaving) return;
      setEcoMemoSaving(true);
      const ac = new AbortController();
      try {
        const res = await fetch("/api/theme-ecosystem/member", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: DEFAULT_USER_ID,
            themeId: theme.id,
            memberId: ecoMemoTarget.id,
            memo: ecoMemoDraft.trim().length > 0 ? ecoMemoDraft.trim() : null,
          }),
        });
        let json: { error?: string } = {};
        try {
          json = (await res.json()) as { error?: string };
        } catch {
          /* ignore */
        }
        if (!res.ok) {
          toast.error(json.error ?? "保存に失敗しました");
          return;
        }
        const memberId = ecoMemoTarget.id;
        const nextMemo: string | null =
          ecoMemoDraft.trim().length > 0 ? ecoMemoDraft.trim() : null;
        setData((cur) => {
          if (!cur) return cur;
          return {
            ...cur,
            ecosystem: cur.ecosystem.map((e) =>
              e.id === memberId ? { ...e, memo: nextMemo } : e,
            ),
          };
        });
        toast.success("メモを保存しました");
        setEcoMemoTarget(null);
        setEcoMemoSaving(false);
        await refetchThemeDetailQuiet(ac.signal);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        toast.error(e instanceof Error ? e.message : "保存に失敗しました");
      } finally {
        setEcoMemoSaving(false);
      }
    },
    [ecoMemoDraft, ecoMemoSaving, ecoMemoTarget, refetchThemeDetailQuiet, theme?.id],
  );

  useEffect(() => {
    if (patrolOn) setEcoShowValueCols(true);
  }, [patrolOn]);

  const ecosystemFiltered = useMemo(() => {
    let out = ecosystem;
    if (ecoBookmarksOnly) {
      out = out.filter((e) => e.isBookmarked === true);
    }
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
    if (ecoFieldFilterSet.size > 0) {
      out = out.filter((e) => ecoFieldFilterSet.has(fieldLabelOf(e)));
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
    if (ecoHideIncompleteQuotes) {
      out = out.filter((e) => ecoHasUsableQuote(e));
    }
    return out;
  }, [
    ecosystem,
    ecoBookmarksOnly,
    ecoHideIncompleteQuotes,
    patrolOn,
    postChasmOnly,
    ecosystemSearchQuery,
    ecoMarketFilter,
    holderFilterSet,
    isDefensiveTheme,
    ecosystemMatchesHolderFilter,
    ecoFieldFilterSet,
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
      if (ecoSortKey === "earnings") return dir * cmpNum(ecoEarningsSortValue(a), ecoEarningsSortValue(b));
      if (ecoSortKey === "listing")
        return dir * cmpStr(ecoListingYmdKey(a) ?? "\uFFFF", ecoListingYmdKey(b) ?? "\uFFFF");
      if (ecoSortKey === "mktCap") return dir * cmpNum(a.marketCap, b.marketCap);
      if (ecoSortKey === "perfListed")
        return dir * cmpNum(a.performanceSinceFoundation, b.performanceSinceFoundation);
      if (ecoSortKey === "judgment") {
        const ja = judgmentPriorityRank(a.judgmentStatus as JudgmentStatus);
        const jb = judgmentPriorityRank(b.judgmentStatus as JudgmentStatus);
        if (ja !== jb) return dir * (ja - jb);
        return dir * cmpStr(a.ticker, b.ticker);
      }
      if (ecoSortKey === "ruleOf40")
        return dir * cmpNum(ecoRuleOf40SortValue(a), ecoRuleOf40SortValue(b));
      if (ecoSortKey === "fcfYield")
        return dir * cmpNum(ecoFcfYieldSortValue(a), ecoFcfYieldSortValue(b));
      if (ecoSortKey === "pe") return dir * cmpNum(ecoPeOf(a), ecoPeOf(b));
      if (ecoSortKey === "eps") return dir * cmpNum(ecoEpsOf(a), ecoEpsOf(b));
      if (ecoSortKey === "alpha")
        return dir * cmpNum(a.latestAlpha, b.latestAlpha);
      if (ecoSortKey === "trend5d")
        return dir * cmpNum(lastAlpha(a), lastAlpha(b));
      if (ecoSortKey === "cumTrend")
        return dir * cmpNum(lastAlpha(a), lastAlpha(b));
      if (ecoSortKey === "price")
        return dir * cmpNum(a.currentPrice, b.currentPrice);
      if (ecoSortKey === "deviation") return dir * cmpNum(devZ(a), devZ(b));
      if (ecoSortKey === "drawdown") return dir * cmpNum(ddOf(a), ddOf(b));
      if (ecoSortKey === "dividend") {
        const c1 = cmpNum(ecoDividendSortScore(a), ecoDividendSortScore(b));
        if (c1 !== 0) return dir * c1;
        return dir * cmpNum(a.dividendYieldPercent, b.dividendYieldPercent);
      }
      if (ecoSortKey === "research") {
        const earnCmp = cmpNum(
          a.daysToEarnings != null && a.daysToEarnings >= 0
            ? a.daysToEarnings
            : null,
          b.daysToEarnings != null && b.daysToEarnings >= 0
            ? b.daysToEarnings
            : null,
        );
        if (earnCmp !== 0) return dir * earnCmp;
        const divEx = cmpNum(ecoDividendSortScore(a), ecoDividendSortScore(b));
        if (divEx !== 0) return dir * divEx;
        return dir * cmpNum(a.dividendYieldPercent, b.dividendYieldPercent);
      }
      return 0;
    });
    return arr;
  }, [ecosystemFiltered, ecoSortDir, ecoSortKey, ecoSortMode]);

  useEffect(() => {
    setEcoColumnOrder(loadEcosystemWatchlistColumnOrder());
    setEcoHiddenColumnIds(loadEcosystemWatchlistHiddenColumns());
    setEcoTableCompact(loadEcosystemWatchlistTableCompact());
  }, []);

  const persistEcoHiddenColumnIds = useCallback((next: EcosystemWatchlistColId[]) => {
    setEcoHiddenColumnIds(next);
    saveEcosystemWatchlistHiddenColumns(next);
  }, []);

  const persistEcoTableCompact = useCallback((next: boolean) => {
    setEcoTableCompact(next);
    saveEcosystemWatchlistTableCompact(next);
  }, []);

  const ecoBaseVisibleColumnIds = useMemo(
    () => visibleEcoColumnsStructural(ecoColumnOrder, { isDefensiveTheme, ecoShowValueCols }),
    [ecoColumnOrder, isDefensiveTheme, ecoShowValueCols],
  );

  const ecoVisibleColumnIds = useMemo(
    () => applyEcosystemWatchlistUserHidden(ecoBaseVisibleColumnIds, ecoHiddenColumnIds),
    [ecoBaseVisibleColumnIds, ecoHiddenColumnIds],
  );

  const ecosystemColSpan = ecoVisibleColumnIds.length;

  const ecoColumnSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleEcoColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setEcoColumnOrder((items) => {
      const oldIndex = items.indexOf(active.id as EcosystemWatchlistColId);
      const newIndex = items.indexOf(over.id as EcosystemWatchlistColId);
      if (oldIndex < 0 || newIndex < 0) return items;
      const next = arrayMove(items, oldIndex, newIndex);
      saveEcosystemWatchlistColumnOrder(next);
      return next;
    });
  }

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

  function toggleEcoSort(next: StructuralEcoSortKey) {
    if (next === ecoSortKey)
      setEcoSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setEcoSortKey(next);
      setEcoSortDir(
        next === "earnings" || next === "dividend" || next === "research" ? "asc" : "desc",
      );
    }
  }

  function ecoSortMark(k: StructuralEcoSortKey) {
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
    return "bg-secondary text-secondary-foreground";
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
                  on ? "bg-emerald-400" : "bg-muted"
                } ${isThis ? "ring-1 ring-ring" : ""}`}
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
    if (z == null || !Number.isFinite(z)) return "text-muted-foreground";
    const az = Math.abs(z);
    if (az <= 0.75) return "text-emerald-400"; // 平常（0近傍）
    if (az >= 2.0) return "text-rose-400"; // 石垣の揺らぎ
    return "text-amber-300"; // 注意域
  }

  const canRenderContent = data != null;

  return (
    <div className="bg-background text-foreground pb-8 font-sans">
      <div className="mx-auto w-full max-w-6xl lg:max-w-[90rem] xl:max-w-[100rem] 2xl:max-w-[120rem] space-y-8">
        <header className="border-b border-border pb-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                <Crosshair
                  size={14}
                  className={isBitcoinTheme ? "text-amber-500/90" : "text-cyan-500/90"}
                />
                <span>Structural theme command</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                {themeDisplayName}
              </h1>
              {isBitcoinTheme ? (
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                  <span className="font-mono text-muted-foreground/90">{DEFAULT_USER_ID}</span>
                  ・<span className="font-mono">structure_tags[0]</span>
                  が「ビットコイン」の保有とエコシステムを束ねます。相対パフォーマンスの物差しは従来どおり VOO
                  / 合成ベンチ（銘柄構成による）で、現物・ETF の参照は右カラムと下の構造レンズで併読してください。
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-2">
                  <span className="font-mono text-muted-foreground/90">
                    {DEFAULT_USER_ID}
                  </span>
                  ・<span className="font-mono">structure_tags[0]</span>{" "}
                  がこのテーマ名と一致する保有のみ
                </p>
              )}
            </div>
            {isBitcoinTheme ? (
              <BitcoinStructuralHeaderAside
                glance={btcStructuralGlance}
                error={btcStructuralGlanceErr}
                loading={btcStructuralGlanceLoading}
              />
            ) : data?.themeSyntheticUsRatio != null && data.themeSyntheticJpRatio != null ? (
              <div
                className="rounded-xl border border-border bg-card/60 px-4 py-3 text-right shrink-0 max-w-[16rem]"
                title={data.themeSyntheticBenchmarkTooltip ?? undefined}
              >
                <p className="text-[9px] font-bold uppercase text-muted-foreground">
                  Synthetic{" "}
                  <span className="font-mono text-muted-foreground normal-case">
                    (US:{Math.round(data.themeSyntheticUsRatio * 100)}% JP:
                    {Math.round(data.themeSyntheticJpRatio * 100)}%)
                  </span>
                </p>
                <div className="mt-1 space-y-0.5 font-mono text-[11px] text-foreground leading-snug">
                  {data.themeBenchmarkVooClose != null && data.themeBenchmarkVooClose > 0 ? (
                    <p>
                      <span className="text-muted-foreground">VOO</span>{" "}
                      {data.themeBenchmarkVooClose.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  ) : null}
                  {data.themeBenchmarkTopixClose != null && data.themeBenchmarkTopixClose > 0 ? (
                    <p>
                      <span className="text-muted-foreground">1306.T</span>{" "}
                      {data.themeBenchmarkTopixClose.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  ) : null}
                  {data.themeBenchmarkVooClose == null && data.themeBenchmarkTopixClose == null ? (
                    <p className="text-muted-foreground">参照価格未取得</p>
                  ) : null}
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">
                  加重: {data.themeSyntheticBasis === "equal_count" ? "銘柄数" : "評価額"}
                </p>
              </div>
            ) : data?.benchmarkLatestPrice != null && data.benchmarkLatestPrice > 0 ? (
              <div className="rounded-xl border border-border bg-card/60 px-4 py-3 text-right shrink-0">
                <p className="text-[9px] font-bold uppercase text-muted-foreground">VOO (ref)</p>
                <p className="font-mono text-lg text-foreground">
                  {data.benchmarkLatestPrice.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            ) : null}
          </div>
        </header>

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
                <span className="text-[11px] text-muted-foreground self-center">
                  直近の表示内容を維持しています
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Initial load: single panel avoids empty “ghost frames” + duplicate status rows */}
        {loading && !canRenderContent ? (
          <div
            className="rounded-2xl border border-border/70 bg-muted/20 p-5 sm:p-6 space-y-5"
            aria-busy="true"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span
                className="inline-flex h-2 w-2 shrink-0 rounded-full bg-accent-cyan animate-pulse"
                aria-hidden
              />
              <span>読み込み中…</span>
              {slowLoading ? (
                <span className="text-muted-foreground/90">通信に時間がかかっています...</span>
              ) : null}
            </div>
            <div className="space-y-3">
              <div className="h-36 rounded-xl bg-muted/35 animate-pulse" />
              <div className="h-24 rounded-xl bg-muted/30 animate-pulse" />
              <div className="h-56 rounded-xl bg-muted/30 animate-pulse" />
            </div>
          </div>
        ) : null}

        {canRenderContent ? (
          <>
            <ThemeMetaBlock theme={theme} themeName={themeLabel} />

            <KeptStockShelf themeName={themeDisplayName} items={ecosystem} />

            {isBitcoinTheme ? (
              <BitcoinStructuralObservationPanel
                glance={btcStructuralGlance}
                glanceError={btcStructuralGlanceErr}
              />
            ) : null}

            {isBitcoinTheme ? (
              <BitcoinThemePriceComparisonChart compareTickers={bitcoinChartCompareTickers} />
            ) : null}

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
              <div className="flex flex-wrap items-center justify-end gap-2 mb-2">
                <div
                  className="inline-flex rounded-lg border border-border bg-muted/80 p-0.5"
                  role="group"
                  aria-label="表示通貨"
                >
                  <button
                    type="button"
                    onClick={() => setViewCurrency("JPY")}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                      viewCurrency === "JPY"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/35"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ¥
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewCurrency("USD")}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                      viewCurrency === "USD"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/35"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    $
                  </button>
                </div>
                <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/60">
                  <button
                    type="button"
                    onClick={() => setAlphaDisplayMode("standard")}
                    className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${
                      alphaDisplayMode === "standard"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    標準α
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlphaDisplayMode("fxNeutral")}
                    className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${
                      alphaDisplayMode === "fxNeutral"
                        ? "bg-muted text-emerald-300/95"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    FX中立α
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="rounded-xl border border-border bg-card/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <TrendingUp size={12} className="opacity-70" />
                    テーマ評価額（{viewCurrency}）
                  </p>
                  <p className="text-xl font-mono font-bold text-foreground mt-1">
                    {data.themeTotalMarketValue > 0
                      ? formatJpyValueForView(data.themeTotalMarketValue, viewCurrency, convert)
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-muted-foreground">
                    銘柄数
                  </p>
                  <p className="text-xl font-mono font-bold text-foreground mt-1">
                    {stocks.length}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-muted-foreground">
                    平均含み損益率
                  </p>
                  <p
                    className={`text-xl font-mono font-bold mt-1 ${pctClass(data.themeAverageUnrealizedPnlPercent)}`}
                  >
                    {fmtPct(data.themeAverageUnrealizedPnlPercent)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-muted-foreground">
                    {alphaDisplayMode === "fxNeutral" ? "平均 α（FX-neutral）" : "平均 Alpha（日次）"}
                  </p>
                  <p
                    className={`text-xl font-mono font-bold mt-1 ${pctClass(themeAvgAlphaDisplayed)}`}
                  >
                    {fmtPct(themeAvgAlphaDisplayed)}
                  </p>
                  <p className="text-[8px] text-muted-foreground mt-1 leading-snug">
                    {alphaDisplayMode === "fxNeutral"
                      ? "現地通貨の超過収益（名目為替レンズに依存しない）"
                      : "テーマ内銘柄の単純平均"}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-muted-foreground" title="Rule of 40（売上成長率% + FCFマージン%）">
                    平均 Rule of 40（Eco）
                  </p>
                  <p
                    className={cn(
                      "text-xl font-mono font-bold mt-1",
                      ecosystemEfficiencySummary.avgRuleOf40 == null
                        ? "text-muted-foreground"
                        : ecosystemEfficiencySummary.avgRuleOf40 >= 40
                          ? "text-emerald-300"
                          : ecosystemEfficiencySummary.avgRuleOf40 >= 0
                            ? "text-foreground"
                            : "text-rose-300",
                    )}
                  >
                    {ecosystemEfficiencySummary.avgRuleOf40 == null
                      ? "—"
                      : `${ecosystemEfficiencySummary.avgRuleOf40.toFixed(1)}%`}
                  </p>
                  <p className="text-[8px] text-muted-foreground mt-1 leading-snug">
                    n={ecosystemEfficiencySummary.countRuleOf40}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card/60 px-4 py-4">
                  <p className="text-[9px] font-bold uppercase text-muted-foreground" title="FCF Yield（%）">
                    平均 FCF Yield（Eco）
                  </p>
                  <p className="text-xl font-mono font-bold text-foreground mt-1">
                    {ecosystemEfficiencySummary.avgFcfYield == null
                      ? "—"
                      : `${ecosystemEfficiencySummary.avgFcfYield.toFixed(1)}%`}
                  </p>
                  <p className="text-[8px] text-muted-foreground mt-1 leading-snug">
                    n={ecosystemEfficiencySummary.countFcfYield}
                  </p>
                </div>
              </div>
            </section>

            {ecosystem.length > 0 ? (
              <section
                aria-label="テーマ普及成熟度"
                className="rounded-2xl border border-border bg-gradient-to-br from-card/85 to-background p-5 md:p-6"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/90 mb-2">
                  Technology adoption · テーマ成熟度
                </p>
                <p className="text-lg font-bold text-foreground leading-snug">
                  {themeAdoptionMaturity.headline}
                </p>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  {themeAdoptionMaturity.detail}
                </p>
                {quoripsWatch?.adoptionStage === "chasm" ? (
                  <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/95 mb-1">
                      クオリプス（4894）× キャズム
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      再生医療（iPS
                      心筋等）は臨床・規制・製造の峡谷に位置しやすく、
                      <span className="text-cyan-300/95 font-semibold">
                        {" "}
                        日次 Alpha（Z・累積トレンドのズレ）
                      </span>
                      がイベントで動きやすい。割安パトロールと併せ、冷え込み＝期待調整のサインとして読むと直感的です。
                    </p>
                    {quoripsWatch.adoptionStageRationale ? (
                      <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed border-t border-border/80 pt-2">
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
                  className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3"
                >
                  Momentum cluster（保有銘柄 Alpha）
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {stocks.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-border bg-card/50 p-3 flex flex-col gap-2 min-h-[7.5rem]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-foreground text-sm">
                            {s.ticker}
                          </p>
                          {s.name ? (
                            <p
                              className="text-[9px] text-muted-foreground truncate"
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
                                  : "text-muted-foreground"
                            }`}
                          >
                            {s.alphaHistory[s.alphaHistory.length - 1]! > 0
                              ? "+"
                              : ""}
                            {s.alphaHistory[s.alphaHistory.length - 1]}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="flex-1 flex items-center justify-center min-h-[3rem]">
                        {s.alphaHistory.length === 0 ? (
                          <span className="text-[10px] text-muted-foreground">
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
                averageFxNeutralAlpha={data.themeAverageFxNeutralAlpha}
                userId={DEFAULT_USER_ID}
                onEarningsNoteSaved={() => {
                  const ac = new AbortController();
                  void refetchThemeDetailQuiet(ac.signal);
                }}
                onTrade={(init) =>
                  openTradeForm({ ...init, themeId: theme?.id ?? init.themeId })
                }
                onTradeNew={() => openTradeForm(null)}
                themeStructuralTrendUp={themeStructuralTrendUp}
                resolveEcosystemKeep={resolveEcosystemKeepForTicker}
                onToggleEcosystemKeep={(id) => void handleToggleEcosystemKeep(id)}
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
                className="rounded-2xl border border-border bg-card/40 p-5 md:p-6 space-y-4"
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
                      className="text-xs font-bold text-muted-foreground uppercase tracking-widest"
                    >
                      Ecosystem · 銘柄を追加
                    </h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
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
                        className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
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
                        className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
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
                        className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
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
                          "flex h-9 w-full rounded-md border border-border bg-muted/80 px-3 py-1 text-sm text-foreground shadow-sm",
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
                        className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
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
                  <p className="text-[10px] text-muted-foreground min-h-[1.1rem]">
                    {addTickerDuplicate ? (
                      <span className="text-rose-400">
                        この銘柄は既に登録済み
                      </span>
                    ) : addCompanyNameLoading ? (
                      <span className="font-mono text-muted-foreground">
                        Resolving name…
                      </span>
                    ) : addCompanyName ? (
                      <span className="text-muted-foreground">{addCompanyName}</span>
                    ) : (
                      <span className="font-mono text-muted-foreground">—</span>
                    )}
                  </p>
                  {addTickerDuplicate ? (
                    <p className="text-xs text-rose-400" role="alert">
                      この銘柄は既にこのテーマに登録されています
                    </p>
                  ) : null}
                  {ecosystem.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      まだウォッチリストに銘柄がありません。追加すると下のエコシステム表が表示されます。
                    </p>
                  ) : null}
                </form>
              </section>
            ) : null}

            {ecosystem.length > 0 ? (
              <section aria-labelledby="theme-ecosystem-heading">
                {isAiUnicornTheme ? (
                  <div className="mb-4 space-y-4">
                    <AiUnicornTrendPulse ecosystem={ecosystem} />
                    <AiUnicornMiningSchedule ecosystem={ecosystem} />
                    <AiUnicornCreditSeam ecosystem={ecosystem} />
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {ecosystem
                        .filter((e) => e.isUnlisted)
                        .map((e) => (
                          <UnicornCard
                            key={e.id}
                            item={e}
                            onToggleKeep={() => void handleToggleEcosystemKeep(e.id)}
                          />
                        ))}
                    </div>
                  </div>
                ) : null}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
                  <div className="p-5 border-b border-border flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between bg-card/50">
                    <div className="flex items-start gap-2 min-w-0">
                      <Layers
                        size={16}
                        className="text-amber-500/90 shrink-0 mt-0.5"
                      />
                      <div>
                        <h2
                          id="theme-ecosystem-heading"
                          className="text-xs font-bold text-muted-foreground uppercase tracking-widest"
                        >
                          Ecosystem map / Watchlist
                        </h2>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
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
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none shrink-0"
                            aria-hidden
                          />
                          <input
                            type="search"
                            value={ecosystemSearchQuery}
                            onChange={(ev) =>
                              setEcosystemSearchQuery(ev.target.value)
                            }
                            placeholder={
                              isBitcoinTheme
                                ? "銘柄・レイヤー（採掘/ETF等）・ノートで検索"
                                : "銘柄・役割・ノートで検索"
                            }
                            className="w-full rounded-lg border border-border bg-muted/80 pl-8 pr-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/40"
                            autoComplete="off"
                          />
                        </label>
                        <div
                          className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-1"
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
                                : "text-muted-foreground border-transparent hover:bg-muted/70",
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
                                : "text-muted-foreground border-transparent hover:bg-muted/70",
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
                                : "text-muted-foreground border-transparent hover:bg-muted/70",
                            )}
                          >
                            米国
                          </button>
                        </div>
                        {ecoFieldLabels.length > 0 ? (
                          <details className="group relative shrink-0">
                            <summary
                              className={cn(
                                "list-none cursor-pointer inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors [&::-webkit-details-marker]:hidden",
                                ecoFieldFilter.length > 0
                                  ? "border-cyan-500/45 bg-cyan-500/10 text-cyan-200"
                                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted/70",
                              )}
                              title="Asset 列のカテゴリ（field）で絞り込み"
                            >
                              <span>カテゴリ</span>
                              {ecoFieldFilter.length > 0 ? (
                                <span className="min-w-[1.25rem] tabular-nums text-cyan-100/95">
                                  {ecoFieldFilter.length}
                                </span>
                              ) : null}
                              <ChevronDown
                                className="h-3.5 w-3.5 shrink-0 opacity-70 transition-transform group-open:rotate-180"
                                aria-hidden
                              />
                            </summary>
                            <div
                              className="absolute right-0 top-[calc(100%+0.35rem)] z-50 w-[min(18rem,calc(100vw-2rem))] max-h-[min(50vh,18rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover/95 p-2 shadow-2xl backdrop-blur-sm"
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2 border-b border-border/80 px-1 pb-2">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                  複数選択
                                </span>
                                <button
                                  type="button"
                                  className="text-[10px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
                                  disabled={ecoFieldFilter.length === 0}
                                  onClick={() => setEcoFieldFilter([])}
                                >
                                  クリア
                                </button>
                              </div>
                              <ul className="space-y-0.5">
                                {ecoFieldLabels.map((fl) => {
                                  const on = ecoFieldFilterSet.has(fl);
                                  return (
                                    <li key={fl}>
                                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] hover:bg-muted/60">
                                        <input
                                          type="checkbox"
                                          className="rounded border-border shrink-0"
                                          checked={on}
                                          onChange={() =>
                                            setEcoFieldFilter((cur) =>
                                              cur.includes(fl)
                                                ? cur.filter((x) => x !== fl)
                                                : [...cur, fl],
                                            )
                                          }
                                        />
                                        <span className="min-w-0 truncate font-medium text-foreground">
                                          {fl}
                                        </span>
                                      </label>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </details>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setEcoBookmarksOnly((v) => !v)}
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-colors inline-flex items-center gap-1",
                            ecoBookmarksOnly
                              ? "text-accent-amber border-accent-amber/50 bg-accent-amber/10"
                              : "text-muted-foreground border-border hover:bg-muted/70",
                          )}
                          title="ブックマーク済みのウォッチ銘柄のみ"
                        >
                          <Star className={`h-3.5 w-3.5 ${ecoBookmarksOnly ? "fill-accent-amber text-accent-amber" : ""}`} />
                          ブックマークのみ
                        </button>
                        <button
                          type="button"
                          onClick={() => setEcoHideIncompleteQuotes((v) => !v)}
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-colors inline-flex items-center gap-1",
                            ecoHideIncompleteQuotes
                              ? "text-rose-200 border-rose-500/45 bg-rose-500/10"
                              : "text-muted-foreground border-border hover:bg-muted/70",
                          )}
                          title="現在株価が取得できていないウォッチ銘柄を非表示"
                        >
                          <CircleSlash className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          株価未取得を隠す
                        </button>
                        <button
                          type="button"
                          onClick={() => setEcoShowValueCols((v) => !v)}
                          className={`text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-colors ${
                            ecoShowValueCols
                              ? "text-amber-400 border-amber-500/50 bg-amber-500/10"
                              : "text-muted-foreground border-border hover:bg-muted/70"
                          }`}
                          title="日次 Alpha 乖離（σ）と 90 日高値比"
                        >
                          乖離・落率
                        </button>
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 py-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            分析
                          </span>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setEcoSortModeOpen((v) => !v)}
                              className={cn(
                                "rounded-md border px-2 py-1 text-[11px] font-bold transition-colors",
                                "border-border bg-muted/70 text-foreground hover:bg-card/60",
                                "focus:outline-none focus:ring-1 focus:ring-cyan-500/40",
                              )}
                              aria-label="Ecosystem 分析ソート"
                              title="CUM・A / 乖離 / 落率を組み合わせて優先順位を作る"
                            >
                              {ecoSortModeLabel(ecoSortMode)}
                            </button>
                            {ecoSortModeOpen ? (
                              <div
                                className="absolute right-0 mt-2 w-[22rem] max-w-[86vw] rounded-xl border border-border bg-popover/95 shadow-2xl z-30 overflow-hidden"
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
                                        "w-full text-left px-3 py-2.5 border-b border-border/80",
                                        "hover:bg-card/60 transition-colors",
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
                                                : "text-foreground",
                                            )}
                                          >
                                            {ecoSortModeLabel(mode)}
                                          </p>
                                          <p
                                            className={cn(
                                              "text-[10px] leading-relaxed mt-1",
                                              hovered || selected
                                                ? "text-muted-foreground"
                                                : "text-muted-foreground",
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
                                    className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    閉じる
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            PE
                          </span>
                          <input
                            inputMode="decimal"
                            value={ecoPeMin}
                            onChange={(e) => setEcoPeMin(e.target.value)}
                            placeholder="min"
                            className="w-14 rounded-md border border-border bg-muted/70 px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                            aria-label="PE 最小"
                          />
                          <span className="text-[10px] text-muted-foreground">-</span>
                          <input
                            inputMode="decimal"
                            value={ecoPeMax}
                            onChange={(e) => setEcoPeMax(e.target.value)}
                            placeholder="max"
                            className="w-14 rounded-md border border-border bg-muted/70 px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
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
                              : "text-muted-foreground border-border hover:bg-muted/70",
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
                              : "text-muted-foreground border-border hover:bg-muted/70"
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
                              : "text-muted-foreground border-border hover:bg-muted/70"
                          }`}
                          title="アーリーマジョリティ・レイトマジョリティのみ（キャズムより先＝普及が進んだ層）"
                        >
                          キャズム超え
                        </button>
                        <EcosystemWatchlistColumnToolbar
                          baseVisibleColumnIds={ecoBaseVisibleColumnIds}
                          hiddenColumnIds={ecoHiddenColumnIds}
                          setHiddenColumnIds={persistEcoHiddenColumnIds}
                          compactTable={ecoTableCompact}
                          setCompactTable={persistEcoTableCompact}
                          isDefensiveTheme={isDefensiveTheme}
                        />
                        <button
                          type="button"
                          onClick={handleEcosystemCsvDownload}
                          disabled={ecosystemSorted.length === 0}
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-muted/70 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                          title="表示中の行（フィルター・並び順反映）を UTF-8 BOM 付き CSV でダウンロード"
                        >
                          <FileSpreadsheet size={14} className="shrink-0" />
                          CSVダウンロード
                        </button>
                      </div>
                      {isDefensiveTheme && defensiveHolders.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              HOLDER フィルター（複数選択）
                            </p>
                            <button
                              type="button"
                              onClick={() => setHolderFilter([])}
                              disabled={holderFilter.length === 0}
                              className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground border border-border px-2 py-1 rounded-md hover:bg-muted/70 transition-colors disabled:opacity-40"
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
                                      : "text-muted-foreground border-border bg-card/30 hover:bg-muted/70",
                                  )}
                                >
                                  {h}
                                </button>
                              );
                            })}
                          </div>
                          {defensiveHolderStats ? (
                            <div className="rounded-xl border border-border bg-muted/60 px-4 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                                Slice stats
                              </p>
                              <div className="text-[11px] font-mono text-muted-foreground flex flex-wrap gap-x-5 gap-y-1">
                                <span>
                                  件数{" "}
                                  <span className="text-foreground font-bold tabular-nums">
                                    {defensiveHolderStats.count}
                                  </span>{" "}
                                  / PF{" "}
                                  <span className="text-foreground font-bold tabular-nums">
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
                                            : "text-foreground"
                                        : "text-muted-foreground",
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
                                            : "text-foreground"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {defensiveHolderStats.avgDeviationZ != null
                                      ? `${defensiveHolderStats.avgDeviationZ > 0 ? "+" : ""}${defensiveHolderStats.avgDeviationZ.toFixed(2)}σ`
                                      : "—"}
                                  </span>
                                </span>
                                <span>
                                  平均 Div{" "}
                                  <span className="text-foreground font-bold tabular-nums">
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
                      <p className="text-[10px] font-mono text-muted-foreground text-right flex flex-wrap items-center justify-end gap-2">
                        {hydratingFull ? (
                          <span className="text-cyan-400/90 font-sans font-bold normal-case tracking-normal animate-pulse">
                            Alpha・Research 読込中…
                          </span>
                        ) : null}
                        <span>
                          {patrolOn ||
                          postChasmOnly ||
                          ecoBookmarksOnly ||
                          ecoHideIncompleteQuotes ||
                          ecosystemSearchQuery.trim().length > 0 ||
                          ecoMarketFilter !== "all" ||
                          ecoFieldFilter.length > 0
                            ? `表示 ${ecosystemSorted.length} / 全 ${ecosystem.length} 銘柄`
                            : `計 ${ecosystem.length} 銘柄`}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "overflow-x-auto relative",
                      ecoTableCompact &&
                        "[&_thead_th]:!px-2.5 [&_thead_th]:!py-2 [&_thead_th]:!text-[9px] [&_thead_th]:!tracking-[0.08em] [&_tbody_td]:!px-2.5 [&_tbody_td]:!py-1.5 [&_tbody_td]:!text-[11px]",
                    )}
                  >
                    <DndContext
                      sensors={ecoColumnSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleEcoColumnDragEnd}
                    >
                      <table className="w-full text-left text-sm">
                        <SortableContext items={ecoVisibleColumnIds} strategy={horizontalListSortingStrategy}>
                          <StructuralEcosystemThead
                            ecoVisibleColumnIds={ecoVisibleColumnIds}
                            toggleEcoSort={toggleEcoSort}
                            ecoSortMark={ecoSortMark}
                          />
                        </SortableContext>
                      <tbody className="divide-y divide-border/50">
                        {ecosystemSorted.length === 0 &&
                        (patrolOn ||
                          postChasmOnly ||
                          ecoBookmarksOnly ||
                          ecoHideIncompleteQuotes ||
                          ecosystemSearchQuery.trim().length > 0 ||
                          ecoMarketFilter !== "all" ||
                          ecoFieldFilterSet.size > 0 ||
                          ecoPeMin.trim().length > 0 ||
                          ecoPeMax.trim().length > 0 ||
                          ecoEpsPositiveOnly) ? (
                          <tr>
                            <td
                              colSpan={ecosystemColSpan}
                              className="px-6 py-8 text-center text-sm text-muted-foreground"
                            >
                              {(() => {
                                const q =
                                  ecosystemSearchQuery.trim().length > 0;
                                const marketOnly =
                                  ecoMarketFilter !== "all" &&
                                  !patrolOn &&
                                  !postChasmOnly &&
                                  !q;
                                const fieldOnly =
                                  ecoFieldFilterSet.size > 0 &&
                                  !patrolOn &&
                                  !postChasmOnly &&
                                  !ecoBookmarksOnly &&
                                  !q &&
                                  ecoMarketFilter === "all" &&
                                  ecoPeMin.trim().length === 0 &&
                                  ecoPeMax.trim().length === 0 &&
                                  !ecoEpsPositiveOnly;
                                const quoteOnly =
                                  ecoHideIncompleteQuotes &&
                                  !patrolOn &&
                                  !postChasmOnly &&
                                  !ecoBookmarksOnly &&
                                  !q &&
                                  ecoMarketFilter === "all" &&
                                  ecoFieldFilterSet.size === 0 &&
                                  ecoPeMin.trim().length === 0 &&
                                  ecoPeMax.trim().length === 0 &&
                                  !ecoEpsPositiveOnly;
                                if (quoteOnly) {
                                  return "現在株価が取得できている銘柄がありません。フィルターを解除するか、後で再試行してください。";
                                }
                                if (q) return "該当する構造が見つかりません";
                                if (fieldOnly) {
                                  return "選択した Asset カテゴリに該当する銘柄がありません。";
                                }
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
                                <tr className="bg-muted/90">
                                  <td
                                    className={`px-6 py-2 min-w-[10rem] max-w-[14rem] sticky left-0 z-[19] bg-muted/90 border-r border-border/90 border-b border-border shadow-[2px_0_10px_rgba(0,0,0,0.35)] text-[10px] font-bold uppercase tracking-wider text-cyan-500/90`}
                                  >
                                    {field}
                                  </td>
                                  <td
                                    colSpan={Math.max(1, ecosystemColSpan - 1)}
                                    className="border-b border-border bg-muted/90 px-6 py-2"
                                    aria-hidden
                                  />
                                </tr>
                              ) : null}
                              <tr
                                id={`eco-row-${e.id}`}
                                className="group hover:bg-muted/45 transition-all scroll-mt-24"
                              >
                                <EcosystemThemeTableMappedRow
                                  visibleColumnIds={ecoVisibleColumnIds}
                                  compactRows={ecoTableCompact}
                                  e={e}
                                  ecoOpp={ecoOpp}
                                  zEco={zEco}
                                  ddEco={ddEco}
                                  isDefensiveTheme={isDefensiveTheme}
                                  themeLabel={themeLabel}
                                  theme={theme}
                                  ecoEditingId={ecoEditingId}
                                  ecoEditCompanyName={ecoEditCompanyName}
                                  setEcoEditCompanyName={setEcoEditCompanyName}
                                  ecoEditRole={ecoEditRole}
                                  setEcoEditRole={setEcoEditRole}
                                  ecoEditMajor={ecoEditMajor}
                                  setEcoEditMajor={setEcoEditMajor}
                                  ecoEditListingDate={ecoEditListingDate}
                                  setEcoEditListingDate={setEcoEditListingDate}
                                  ecoEditMarketCap={ecoEditMarketCap}
                                  setEcoEditMarketCap={setEcoEditMarketCap}
                                  ecoEditListingPrice={ecoEditListingPrice}
                                  setEcoEditListingPrice={setEcoEditListingPrice}
                                  ecoEditSaving={ecoEditSaving}
                                  showEcoMemoButton
                                  ecoResearchIncludeEarnings={false}
                                  formatEcoPriceForView={formatEcoPriceForView}
                                  onOpenTrade={(init) => openTradeForm(init)}
                                  beginEditEcosystem={beginEditEcosystem}
                                  deleteEcoMember={deleteEcoMember}
                                  handleToggleEcosystemKeep={handleToggleEcosystemKeep}
                                  handleToggleEcosystemBookmark={handleToggleEcosystemBookmark}
                                  saveEditEcosystem={saveEditEcosystem}
                                  cancelEditEcosystem={cancelEditEcosystem}
                                  setEcoMemoTarget={setEcoMemoTarget}
                                  holderBadgeClass={holderBadgeClass}
                                  dividendCalendar={dividendCalendar}
                                  defensiveZClass={defensiveZClass}
                                />
                              </tr>
                            </React.Fragment>
                          );
                        })}

                      </tbody>
                    </table>
                    </DndContext>
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
              <p className="text-sm text-muted-foreground">
                このテーマに該当する保有がありません。
              </p>
            ) : null}
          </>
        ) : null}

        {ecoMemoTarget ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
            role="presentation"
          >
            <button
              type="button"
              className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"
              aria-label="閉じる"
              onClick={() => !ecoMemoSaving && setEcoMemoTarget(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              className="relative z-10 flex max-h-[min(92dvh,52rem)] w-[min(100%,36rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-w-2xl"
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Ecosystem memo
                  </p>
                  <p className="text-base font-bold text-foreground mt-1 font-mono sm:text-lg">{ecoMemoTarget.ticker}</p>
                  {ecoMemoTarget.companyName ? (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{ecoMemoTarget.companyName}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={ecoMemoSaving}
                  onClick={() => setEcoMemoTarget(null)}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation disabled:opacity-40"
                  aria-label="閉じる"
                >
                  <X size={20} />
                </button>
              </div>
              <div
                className="inline-flex shrink-0 gap-0 border-b border-border px-3 sm:px-4 pt-2"
                role="tablist"
                aria-label="メモの表示"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={ecoMemoModalTab === "edit"}
                  disabled={ecoMemoSaving}
                  onClick={() => setEcoMemoModalTab("edit")}
                  className={`rounded-t-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-40 ${
                    ecoMemoModalTab === "edit"
                      ? "bg-background text-foreground border border-b-0 border-border -mb-px"
                      : "text-muted-foreground hover:text-foreground/90"
                  }`}
                >
                  編集
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={ecoMemoModalTab === "preview"}
                  disabled={ecoMemoSaving}
                  onClick={() => setEcoMemoModalTab("preview")}
                  className={`rounded-t-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-40 ${
                    ecoMemoModalTab === "preview"
                      ? "bg-background text-foreground border border-b-0 border-border -mb-px"
                      : "text-muted-foreground hover:text-foreground/90"
                  }`}
                >
                  プレビュー（Markdown）
                </button>
              </div>
              <div className="min-h-0 flex flex-1 flex-col bg-background">
                {ecoMemoModalTab === "edit" ? (
                  <label htmlFor="eco-memo-ta" className="sr-only">
                    エコシステムメモ
                  </label>
                ) : null}
                {ecoMemoModalTab === "edit" ? (
                  <textarea
                    id="eco-memo-ta"
                    value={ecoMemoDraft}
                    onChange={(ev) => setEcoMemoDraft(ev.target.value)}
                    disabled={ecoMemoSaving}
                    rows={16}
                    className="min-h-[16rem] flex-1 resize-y border-0 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-cyan/40 disabled:opacity-50 sm:px-5 sm:py-4"
                    placeholder="Markdown 可（見出し・リスト・表など）。空にして保存でクリア（theme_ecosystem_members.memo）"
                  />
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-3 sm:px-5 sm:py-4">
                    <p className="shrink-0 text-[10px] text-muted-foreground">
                      入力中の内容を Markdown として表示します（未保存の編集も反映）。
                    </p>
                    <div className="min-h-[12rem] flex-1 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
                      <EarningsNoteMarkdownPreview markdown={ecoMemoDraft} />
                    </div>
                  </div>
                )}
                <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-card/80 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    disabled={ecoMemoSaving}
                    onClick={() => setEcoMemoTarget(null)}
                    className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground border border-border px-4 py-2 rounded-lg hover:bg-muted/60"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    disabled={ecoMemoSaving}
                    onClick={() => void saveEcoMemberMemo()}
                    className="text-[11px] font-bold uppercase tracking-wide text-background bg-accent-cyan px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-40"
                  >
                    {ecoMemoSaving ? "保存中…" : "保存"}
                  </button>
                </div>
              </div>
            </div>
          </div>
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
