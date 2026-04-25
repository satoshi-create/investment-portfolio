"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  CircleSlash,
  FileSpreadsheet,
  Layers,
  Search,
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

import { toggleThemeEcosystemMemberBookmark } from "@/app/actions/theme-ecosystem";
import {
  EarningsSummaryNoteEditorModal,
  EcosystemMarkdownMemoModal,
} from "@/src/components/dashboard/HoldingEcosystemNoteModals";
import { EARNINGS_SUMMARY_NOTE_MAX_LEN } from "@/src/lib/earnings-summary-note-meta";
import { EcosystemThemeTableMappedRow } from "@/src/components/dashboard/EcosystemThemeTableMappedRow";
import { EcosystemWatchlistColumnToolbar } from "@/src/components/dashboard/EcosystemWatchlistColumnToolbar";
import { sortStructuralEcosystemWatchlist } from "@/src/components/dashboard/ecosystem-structural-watchlist-sort";
import { stickyThFirst } from "@/src/components/dashboard/table-sticky";
import {
  StructuralEcosystemThead,
  type StructuralEcoSortKey,
} from "@/src/components/dashboard/StructuralEcosystemThead";
import { useDashboardData } from "@/src/components/dashboard/DashboardDataContext";
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { classifyTickerInstrument } from "@/src/lib/alpha-logic";
import { isPostChasmStage } from "@/src/lib/adoption-stage";
import { cn } from "@/src/lib/cn";
import { regionDisplayFromYahooCountry } from "@/src/lib/region-display";
import {
  applyEcosystemWatchlistUserHidden,
  loadEcosystemWatchlistHiddenColumns,
  loadEcosystemWatchlistTableCompact,
  saveEcosystemWatchlistHiddenColumns,
  saveEcosystemWatchlistTableCompact,
} from "@/src/lib/ecosystem-watchlist-column-visibility";
import {
  loadEcosystemWatchlistColumnOrder,
  saveEcosystemWatchlistColumnOrder,
  visibleEcoColumnsStructural,
  type EcosystemWatchlistColId,
} from "@/src/lib/ecosystem-watchlist-column-order";
import { ecosystemDividendPayoutPercent } from "@/src/lib/eco-dividend-payout";
import { formatLocalPriceForView } from "@/src/lib/format-display-currency";
import {
  THEME_ECOSYSTEM_WATCHLIST_CSV_COLUMNS,
  themeEcosystemWatchlistToCsvRows,
} from "@/src/lib/csv-dashboard-presets";
import { exportToCSV, themeEcosystemWatchlistCsvFileName } from "@/src/lib/csv-export";
import type { TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";
import type {
  EcosystemCrossThemeBookmarkItem,
  ThemeEcosystemWatchItem,
  TickerInstrumentKind,
} from "@/src/types/investment";

const DEFAULT_USER_ID = defaultProfileUserId();

function ecosystemInstrumentKind(item: ThemeEcosystemWatchItem): TickerInstrumentKind {
  const k = item.instrumentKind;
  if (k === "US_EQUITY" || k === "JP_INVESTMENT_TRUST" || k === "JP_LISTED_EQUITY") return k;
  const proxy = item.proxyTicker != null ? String(item.proxyTicker).trim() : "";
  const eff = item.isUnlisted && proxy.length > 0 ? proxy : String(item.ticker).trim();
  return classifyTickerInstrument(eff.length > 0 ? eff : String(item.ticker).trim());
}

function fieldLabelOf(e: ThemeEcosystemWatchItem): string {
  return e.field.trim() || "その他";
}

function ecosystemMatchesMarketFilter(
  e: ThemeEcosystemWatchItem,
  filter: "all" | "jp" | "us",
): boolean {
  if (filter === "all") return true;
  if (filter === "jp") return e.countryName === "日本";
  return e.countryName === "米国";
}

function ecosystemMatchesSearchQuery(e: ThemeEcosystemWatchItem, raw: string): boolean {
  const n = raw.trim().toLowerCase();
  if (n.length === 0) return true;
  const hay = [e.companyName, e.ticker, e.role, e.observationNotes ?? ""];
  return hay.some((s) => s.toLowerCase().includes(n));
}

function ecoOpportunityRow(_e: ThemeEcosystemWatchItem, _themeUp: boolean): boolean {
  return false;
}

function ecoHasUsableQuote(e: ThemeEcosystemWatchItem): boolean {
  return e.currentPrice != null && Number.isFinite(e.currentPrice) && e.currentPrice > 0;
}

function ecoPeOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.trailingPe ?? e.forwardPe ?? null;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}

function ecoEpsOf(e: ThemeEcosystemWatchItem): number | null {
  const v = e.trailingEps ?? e.forwardEps ?? null;
  return v != null && Number.isFinite(v) ? v : null;
}

function holderBadgeClass(holder: string): string {
  if (holder === "バークシャー") return "bg-red-100 text-red-800";
  if (holder === "エル" || holder === "ロンリード") return "bg-blue-100 text-blue-800";
  return "bg-secondary text-secondary-foreground";
}

function dividendCalendar(months: number[]) {
  const now = new Date();
  const m = now.getMonth() + 1;
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
              className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-400" : "bg-muted"} ${
                isThis ? "ring-1 ring-ring" : ""
              }`}
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
  if (z == null || !Number.isFinite(z)) return "text-muted-foreground";
  const az = Math.abs(z);
  if (az <= 0.75) return "text-emerald-400";
  if (az >= 2.0) return "text-rose-400";
  return "text-amber-300";
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
    return "押し目（Dip）探索。Z は 0σ 付近＝短期平常を優先しつつ、落率が深い銘柄を上位へ。構造の強さは CUM・A（累積Alpha）で見ます。";
  }
  return "深掘り（Deep）探索。Z が強くマイナス＝直近だけ相対的に冷えた銘柄を上位へ。落率と CUM・A を併読して優先度を作ります。";
}

export function EcosystemBookmarksClient({ initialItems }: { initialItems: EcosystemCrossThemeBookmarkItem[] }) {
  const router = useRouter();
  const { openTradeForm } = useDashboardData();
  const { convert, viewCurrency } = useCurrencyConverter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState(initialItems);
  const [ecoSortKey, setEcoSortKey] = useState<StructuralEcoSortKey>("alpha");
  const [ecoSortDir, setEcoSortDir] = useState<"asc" | "desc">("desc");
  const [ecoSortMode, setEcoSortMode] = useState<"column" | "dip_rank" | "deep_value_rank">("column");
  const [ecoSortModeOpen, setEcoSortModeOpen] = useState(false);
  const [ecoSortModeHover, setEcoSortModeHover] = useState<
    "column" | "dip_rank" | "deep_value_rank" | null
  >(null);
  const [ecoShowValueCols, setEcoShowValueCols] = useState(false);
  const [patrolOn, setPatrolOn] = useState(false);
  const [postChasmOnly, setPostChasmOnly] = useState(false);
  const [ecosystemSearchQuery, setEcosystemSearchQuery] = useState("");
  const [ecoMarketFilter, setEcoMarketFilter] = useState<"all" | "jp" | "us">("all");
  const [ecoPeMin, setEcoPeMin] = useState("");
  const [ecoPeMax, setEcoPeMax] = useState("");
  const [ecoEpsPositiveOnly, setEcoEpsPositiveOnly] = useState(false);
  const [ecoFieldFilter, setEcoFieldFilter] = useState<string[]>([]);
  const [holderFilter, setHolderFilter] = useState<string[]>([]);
  const [ecoHideIncompleteQuotes, setEcoHideIncompleteQuotes] = useState(false);
  const [ecoColumnOrder, setEcoColumnOrder] = useState<EcosystemWatchlistColId[]>(loadEcosystemWatchlistColumnOrder);
  const [ecoHiddenColumnIds, setEcoHiddenColumnIds] = useState(() => loadEcosystemWatchlistHiddenColumns());
  const [ecoTableCompact, setEcoTableCompact] = useState(loadEcosystemWatchlistTableCompact);

  const [ecoEditingId, setEcoEditingId] = useState<string | null>(null);
  const [ecoEditCompanyName, setEcoEditCompanyName] = useState("");
  const [ecoEditRole, setEcoEditRole] = useState("");
  const [ecoEditMajor, setEcoEditMajor] = useState(false);
  const [ecoEditListingDate, setEcoEditListingDate] = useState("");
  const [ecoEditMarketCap, setEcoEditMarketCap] = useState("");
  const [ecoEditListingPrice, setEcoEditListingPrice] = useState("");
  const [ecoEditSaving, setEcoEditSaving] = useState(false);
  const [ecoMemoTarget, setEcoMemoTarget] = useState<ThemeEcosystemWatchItem | null>(null);
  const [ecoMemoDraft, setEcoMemoDraft] = useState("");
  const [ecoMemoModalTab, setEcoMemoModalTab] = useState<"edit" | "preview">("edit");
  const [ecoMemoSaving, setEcoMemoSaving] = useState(false);
  const [ecoEarningsSummaryTarget, setEcoEarningsSummaryTarget] = useState<ThemeEcosystemWatchItem | null>(null);
  const [ecoEarningsSummaryDraft, setEcoEarningsSummaryDraft] = useState("");
  const [ecoEarningsSummaryModalTab, setEcoEarningsSummaryModalTab] = useState<"edit" | "preview">("edit");
  const [ecoEarningsSummarySaving, setEcoEarningsSummarySaving] = useState(false);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    if (patrolOn) setEcoShowValueCols(true);
  }, [patrolOn]);

  const isDefensiveTheme = useMemo(
    () => items.some((e) => (e.holderTags?.length ?? 0) > 0),
    [items],
  );

  const defensiveHolders = useMemo(() => {
    if (!isDefensiveTheme) return [];
    const set = new Set<string>();
    for (const e of items) {
      for (const h of e.holderTags ?? []) {
        const s = String(h).trim();
        if (s) set.add(s);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ja"));
  }, [items, isDefensiveTheme]);

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
    for (const e of items) {
      s.add(fieldLabelOf(e));
    }
    return [...s].sort((a, b) => a.localeCompare(b, "ja"));
  }, [items]);

  const ecoFieldFilterSet = useMemo(
    () => new Set(ecoFieldFilter.map((x) => x.trim()).filter(Boolean)),
    [ecoFieldFilter],
  );

  const defensiveHolderStats = useMemo(() => {
    if (!isDefensiveTheme) return null;
    const base = items.filter((e) => ecosystemMatchesHolderFilter(e));
    const alphas = base
      .map((e) => (e.latestAlpha != null && Number.isFinite(e.latestAlpha) ? e.latestAlpha : null))
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
    const payouts = base
      .map((e) => {
        const p = ecosystemDividendPayoutPercent(e);
        return p != null && Number.isFinite(p) ? p : null;
      })
      .filter((x): x is number => x != null);
    const avg = (arr: number[]) =>
      arr.length === 0 ? null : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
    return {
      count: base.length,
      inPortfolio: base.filter((e) => e.inPortfolio).length,
      avgLatestAlpha: avg(alphas),
      avgDeviationZ: avg(zs),
      avgDividendYield: avg(yields),
      avgDividendPayout: avg(payouts),
    };
  }, [items, ecosystemMatchesHolderFilter, isDefensiveTheme]);

  const ecosystemFiltered = useMemo(() => {
    let out: EcosystemCrossThemeBookmarkItem[] = items;
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
      out = out.filter((e) => ecosystemMatchesSearchQuery(e, ecosystemSearchQuery));
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
    items,
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

  const ecosystemSorted = useMemo(
    () =>
      sortStructuralEcosystemWatchlist(ecosystemFiltered, {
        ecoSortKey,
        ecoSortDir,
        ecoSortMode,
      }),
    [ecosystemFiltered, ecoSortDir, ecoSortKey, ecoSortMode],
  );

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
    setEcoColumnOrder((ord) => {
      const oldIndex = ord.indexOf(active.id as EcosystemWatchlistColId);
      const newIndex = ord.indexOf(over.id as EcosystemWatchlistColId);
      if (oldIndex < 0 || newIndex < 0) return ord;
      const next = arrayMove(ord, oldIndex, newIndex);
      saveEcosystemWatchlistColumnOrder(next);
      return next;
    });
  }

  function toggleEcoSort(next: StructuralEcoSortKey) {
    if (next === ecoSortKey) setEcoSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setEcoSortKey(next);
      setEcoSortDir(
        next === "earnings" ||
        next === "dividend" ||
        next === "payout" ||
        next === "research" ||
        next === "peg"
          ? "asc"
          : "desc",
      );
    }
  }

  function ecoSortMark(k: StructuralEcoSortKey) {
    if (k !== ecoSortKey) return "";
    return ecoSortDir === "asc" ? " ▲" : " ▼";
  }

  const formatEcoPriceForView = useCallback(
    (e: ThemeEcosystemWatchItem) => {
      if (e.currentPrice == null || !Number.isFinite(e.currentPrice) || e.currentPrice <= 0) return "—";
      const kind = ecosystemInstrumentKind(e);
      const native: "USD" | "JPY" = kind === "US_EQUITY" ? "USD" : "JPY";
      return formatLocalPriceForView(e.currentPrice, native, viewCurrency, convert);
    },
    [convert, viewCurrency],
  );

  const handleRefresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router, startTransition]);

  const handleToggleEcosystemBookmark = useCallback(
    async (memberId: string) => {
      const prevEntry = items.find((x) => x.id === memberId);
      if (!prevEntry) return;
      setItems((cur) => cur.filter((x) => x.id !== memberId));
      const res = await toggleThemeEcosystemMemberBookmark(memberId, {
        themeSlugForRevalidate: prevEntry.themeName,
      });
      if (!res.ok) {
        toast.error(res.message ?? "ブックマーク更新に失敗しました");
        handleRefresh();
        return;
      }
      toast.success("ブックマークを外しました");
      handleRefresh();
    },
    [handleRefresh, items],
  );

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

  const saveEditEcosystem = useCallback(
    async (memberId: string) => {
      const row = items.find((x) => x.id === memberId);
      if (!row?.themeId || ecoEditSaving) return;
      const themeId = row.themeId;
      const fd = ecoEditListingDate.trim();
      if (fd.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(fd)) {
        toast.error("初回取引日は YYYY-MM-DD で入力してください（空でクリア）");
        return;
      }
      const mcRaw = ecoEditMarketCap.trim().replace(/,/g, "");
      let marketCapPayload: number | null;
      if (mcRaw === "") marketCapPayload = null;
      else {
        const n = Number(mcRaw);
        if (!Number.isFinite(n)) {
          toast.error("時価総額は数値で入力してください（空でクリア）");
          return;
        }
        marketCapPayload = n;
      }
      const lpRaw = ecoEditListingPrice.trim().replace(/,/g, "");
      let listingPricePayload: number | null;
      if (lpRaw === "") listingPricePayload = null;
      else {
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
            themeId,
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
        await handleRefresh();
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
      handleRefresh,
      items,
    ],
  );

  const deleteEcoMember = useCallback(
    async (memberId: string, ticker: string) => {
      const row = items.find((x) => x.id === memberId);
      if (!row?.themeId) return;
      if (!confirm(`"${ticker}" をエコシステムから削除しますか？`)) return;
      const ac = new AbortController();
      try {
        const res = await fetch("/api/theme-ecosystem/member", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: DEFAULT_USER_ID,
            themeId: row.themeId,
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
        setItems((cur) => cur.filter((x) => x.id !== memberId));
        await handleRefresh();
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        toast.error(e instanceof Error ? e.message : "削除に失敗しました");
      }
    },
    [cancelEditEcosystem, ecoEditingId, handleRefresh, items],
  );

  useEffect(() => {
    if (ecoMemoTarget) {
      setEcoMemoDraft(ecoMemoTarget.memo ?? "");
      setEcoMemoModalTab("edit");
    }
  }, [ecoMemoTarget]);

  useEffect(() => {
    if (ecoEarningsSummaryTarget) {
      setEcoEarningsSummaryDraft(ecoEarningsSummaryTarget.earningsSummaryNote ?? "");
      setEcoEarningsSummaryModalTab("edit");
    }
  }, [ecoEarningsSummaryTarget]);

  const saveEcoMemberMemo = useCallback(async () => {
    if (!ecoMemoTarget?.themeId || ecoMemoSaving) return;
    setEcoMemoSaving(true);
    const ac = new AbortController();
    try {
      const res = await fetch("/api/theme-ecosystem/member", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEFAULT_USER_ID,
          themeId: ecoMemoTarget.themeId,
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
      const nextMemo: string | null = ecoMemoDraft.trim().length > 0 ? ecoMemoDraft.trim() : null;
      setItems((cur) => cur.map((e) => (e.id === memberId ? { ...e, memo: nextMemo } : e)));
      toast.success("メモを保存しました");
      setEcoMemoTarget(null);
      setEcoMemoSaving(false);
      await handleRefresh();
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setEcoMemoSaving(false);
    }
  }, [ecoMemoDraft, ecoMemoSaving, ecoMemoTarget, handleRefresh]);

  const saveEcoEarningsSummaryNote = useCallback(async () => {
    if (!ecoEarningsSummaryTarget?.themeId || ecoEarningsSummarySaving) return;
    const trimmed = ecoEarningsSummaryDraft.trim();
    if (trimmed.length > EARNINGS_SUMMARY_NOTE_MAX_LEN) {
      toast.error(`決算要約は最大 ${EARNINGS_SUMMARY_NOTE_MAX_LEN} 文字です`);
      return;
    }
    setEcoEarningsSummarySaving(true);
    try {
      const res = await fetch("/api/theme-ecosystem/member", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEFAULT_USER_ID,
          themeId: ecoEarningsSummaryTarget.themeId,
          memberId: ecoEarningsSummaryTarget.id,
          earningsSummaryNote: trimmed.length > 0 ? trimmed : null,
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
      const memberId = ecoEarningsSummaryTarget.id;
      const nextNote: string | null = trimmed.length > 0 ? trimmed : null;
      setItems((cur) => cur.map((e) => (e.id === memberId ? { ...e, earningsSummaryNote: nextNote } : e)));
      toast.success("決算要約を保存しました");
      setEcoEarningsSummaryTarget(null);
      await handleRefresh();
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setEcoEarningsSummarySaving(false);
    }
  }, [
    ecoEarningsSummaryDraft,
    ecoEarningsSummarySaving,
    ecoEarningsSummaryTarget,
    handleRefresh,
  ]);

  const handleEcosystemCsvDownload = useCallback(() => {
    const rows: Record<string, unknown>[] = [];
    for (const e of ecosystemSorted) {
      rows.push(...themeEcosystemWatchlistToCsvRows([e], e.themeName));
    }
    exportToCSV(rows, themeEcosystemWatchlistCsvFileName("全テーマ-ブックマーク"), THEME_ECOSYSTEM_WATCHLIST_CSV_COLUMNS);
  }, [ecosystemSorted]);

  const onOpenTrade = useCallback(
    (initial: TradeEntryInitial) => {
      openTradeForm(initial);
    },
    [openTradeForm],
  );

  return (
    <div className="mx-auto w-full max-w-6xl lg:max-w-[90rem] xl:max-w-[100rem] 2xl:max-w-[120rem] space-y-4 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/themes"
            className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            テーマ一覧
          </Link>
          <h1 className="text-lg font-bold text-foreground/95">全テーマ · ウォッチブックマーク</h1>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
            各テーマの Ecosystem map / Watchlist で ☆ した銘柄を、構造テーマと同じ表レイアウトで横断表示します。下の帯行でテーマ（structure_tags
            先頭に相当する枠）が切り替わるごとにグルーピングされます。
          </p>
        </div>
        {items.length > 0 ? (
          <div className="text-[10px] font-mono text-muted-foreground">{items.length} 銘柄</div>
        ) : null}
      </div>

      {isPending ? (
        <p className="text-[10px] text-muted-foreground font-mono" aria-live="polite">
          再読み込み中…
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
          ブックマークはまだありません。各テーマの Ecosystem ウォッチ表で、銘柄行の星アイコンから追加できます。
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-border flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between bg-card/50">
            <div className="flex items-start gap-2 min-w-0">
              <Layers size={16} className="text-amber-500/90 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Ecosystem map / Watchlist
                </h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  行は所属テーマごとにグルーピング（帯行）。列設定・ソートは構造テーマページと共通の保存キーを使用します。
                </p>
              </div>
            </div>
            <div className="text-[9px] font-mono text-muted-foreground/90 text-right">
              表示 {ecosystemSorted.length} / 登録 {items.length}
            </div>
          </div>

          <div className="p-3 sm:p-4 border-b border-border bg-card/30 space-y-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="relative flex items-center min-w-[12rem] flex-1 sm:max-w-[16rem]">
                <span className="sr-only">検索</span>
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none shrink-0"
                  aria-hidden
                />
                <input
                  type="search"
                  value={ecosystemSearchQuery}
                  onChange={(ev) => setEcosystemSearchQuery(ev.target.value)}
                  placeholder="銘柄・役割・ノートで検索"
                  className="w-full rounded-lg border border-border bg-muted/80 pl-8 pr-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/40"
                  autoComplete="off"
                />
              </label>
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-1" role="group">
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
                      <span className="min-w-[1.25rem] tabular-nums text-cyan-100/95">{ecoFieldFilter.length}</span>
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
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">複数選択</span>
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
                                    cur.includes(fl) ? cur.filter((x) => x !== fl) : [...cur, fl],
                                  )
                                }
                              />
                              <span className="min-w-0 truncate font-medium text-foreground">{fl}</span>
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
                onClick={() => setEcoHideIncompleteQuotes((v) => !v)}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-colors inline-flex items-center gap-1",
                  ecoHideIncompleteQuotes
                    ? "text-rose-200 border-rose-500/45 bg-rose-500/10"
                    : "text-muted-foreground border-border hover:bg-muted/70",
                )}
                title="現在株価が取得できていない銘柄を非表示"
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
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">分析</span>
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
                      {(["column", "dip_rank", "deep_value_rank"] as const).map((mode) => {
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
                              selected ? "bg-cyan-500/10" : "bg-transparent",
                            )}
                            title={ecoSortModeHelp(mode)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p
                                  className={cn("text-[11px] font-bold", selected ? "text-cyan-200" : "text-foreground")}
                                >
                                  {ecoSortModeLabel(mode)}
                                </p>
                                <p
                                  className={cn(
                                    "text-[10px] leading-relaxed mt-1",
                                    hovered || selected ? "text-muted-foreground" : "text-muted-foreground",
                                  )}
                                >
                                  {ecoSortModeHelp(mode)}
                                </p>
                              </div>
                              {selected ? (
                                <span className="text-[10px] font-bold text-cyan-300 shrink-0">選択中</span>
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
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">PE</span>
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
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-colors",
                  patrolOn
                    ? "text-cyan-400 border-cyan-500/50 bg-cyan-500/10"
                    : "text-muted-foreground border-border hover:bg-muted/70",
                )}
                title="Alpha 乖離が大きい負け、または高値からの下落が大きい銘柄のみ"
              >
                割安パトロール
              </button>
              <button
                type="button"
                onClick={() => setPostChasmOnly((p) => !p)}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-colors",
                  postChasmOnly
                    ? "text-emerald-400 border-emerald-500/50 bg-emerald-500/10"
                    : "text-muted-foreground border-border hover:bg-muted/70",
                )}
                title="アーリーマジョリティ以降のみ"
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
                title="表示中の行を UTF-8 BOM 付き CSV"
              >
                <FileSpreadsheet size={14} className="shrink-0" />
                CSV
              </button>
            </div>
            {isDefensiveTheme && defensiveHolders.length > 0 ? (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    HOLDER フィルター
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
                          setHolderFilter((cur) => (cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h]))
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
                  <div className="rounded-xl border border-border bg-muted/60 px-4 py-3 text-[11px] font-mono text-muted-foreground">
                    件数 <span className="text-foreground font-bold tabular-nums">{defensiveHolderStats.count}</span> /
                    PF{" "}
                    <span className="text-foreground font-bold tabular-nums">{defensiveHolderStats.inPortfolio}</span>
                    {" · "}
                    平均Z{" "}
                    <span className="text-foreground font-bold tabular-nums">
                      {defensiveHolderStats.avgDeviationZ != null
                        ? `${defensiveHolderStats.avgDeviationZ > 0 ? "+" : ""}${defensiveHolderStats.avgDeviationZ.toFixed(2)}σ`
                        : "—"}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
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
                  {ecosystemSorted.length === 0 && items.length > 0 ? (
                    <tr>
                      <td colSpan={ecosystemColSpan} className="px-6 py-8 text-center text-sm text-muted-foreground">
                        フィルター条件に合う銘柄がありません。
                      </td>
                    </tr>
                  ) : null}
                  {ecosystemSorted.map((e, idx) => {
                    const prev = idx > 0 ? ecosystemSorted[idx - 1]! : null;
                    const showThemeHeader = idx === 0 || (prev != null && e.themeName !== prev.themeName);
                    const zEco =
                      e.alphaDeviationZ != null && Number.isFinite(e.alphaDeviationZ) ? e.alphaDeviationZ : null;
                    const ddEco =
                      e.drawdownFromHigh90dPct != null && Number.isFinite(e.drawdownFromHigh90dPct)
                        ? e.drawdownFromHigh90dPct
                        : null;
                    const ecoOpp = ecoOpportunityRow(e, false);
                    return (
                      <React.Fragment key={e.id}>
                        {showThemeHeader ? (
                          <tr className="bg-amber-950/25">
                            <td
                              colSpan={Math.max(1, ecosystemColSpan)}
                              className={cn(
                                "px-3 py-2 min-w-0 z-[19] bg-amber-950/35 border-b border-amber-500/20",
                                stickyThFirst,
                              )}
                            >
                              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-200/95">
                                <span className="text-muted-foreground/90 font-mono">所属テーマ</span>
                                <Link
                                  href={`/themes/${encodeURIComponent(e.themeName)}`}
                                  className="inline-flex items-center gap-1 text-amber-100 hover:underline"
                                >
                                  {e.themeName}
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                        <tr
                          id={`eco-row-${e.id}`}
                          className={cn(
                            "group hover:bg-muted/45 transition-all scroll-mt-24",
                            regionDisplayFromYahooCountry(e.yahooCountry).rowBg,
                          )}
                        >
                          <EcosystemThemeTableMappedRow
                            visibleColumnIds={ecoVisibleColumnIds}
                            compactRows={ecoTableCompact}
                            e={e}
                            ecoOpp={ecoOpp}
                            zEco={zEco}
                            ddEco={ddEco}
                            isDefensiveTheme={isDefensiveTheme}
                            themeLabel={e.themeName}
                            theme={null}
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
                            onOpenTrade={onOpenTrade}
                            beginEditEcosystem={beginEditEcosystem}
                            deleteEcoMember={deleteEcoMember}
                            handleToggleEcosystemKeep={async () => {}}
                            handleToggleEcosystemBookmark={handleToggleEcosystemBookmark}
                            saveEditEcosystem={saveEditEcosystem}
                            cancelEditEcosystem={cancelEditEcosystem}
                            setEcoMemoTarget={setEcoMemoTarget}
                            setEcoEarningsSummaryTarget={setEcoEarningsSummaryTarget}
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
      )}

      {ecoMemoTarget ? (
        <EcosystemMarkdownMemoModal
          ticker={ecoMemoTarget.ticker}
          companyName={ecoMemoTarget.companyName}
          draft={ecoMemoDraft}
          onDraftChange={setEcoMemoDraft}
          tab={ecoMemoModalTab}
          onTabChange={setEcoMemoModalTab}
          saving={ecoMemoSaving}
          onClose={() => !ecoMemoSaving && setEcoMemoTarget(null)}
          onSave={saveEcoMemberMemo}
          textareaId="eco-memo-ta-bm"
          placeholder="Markdown 可。空にして保存でクリア"
          previewLeadText="未保存の編集も表示します"
        />
      ) : null}

      {ecoEarningsSummaryTarget ? (
        <EarningsSummaryNoteEditorModal
          eyebrow="決算要約メモ"
          title=""
          titleId="eco-earnings-summary-modal-title-bm"
          ticker={ecoEarningsSummaryTarget.ticker}
          companyName={ecoEarningsSummaryTarget.companyName}
          prominentTicker
          draft={ecoEarningsSummaryDraft}
          onDraftChange={setEcoEarningsSummaryDraft}
          tab={ecoEarningsSummaryModalTab}
          onTabChange={setEcoEarningsSummaryModalTab}
          saving={ecoEarningsSummarySaving}
          errorText={null}
          onClose={() => !ecoEarningsSummarySaving && setEcoEarningsSummaryTarget(null)}
          onSave={saveEcoEarningsSummaryNote}
          textareaId="eco-earnings-ta-bm"
          variant="ecosystem"
        />
      ) : null}
    </div>
  );
}
