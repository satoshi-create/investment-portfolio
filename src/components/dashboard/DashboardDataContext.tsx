"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { recordPortfolioSnapshotAction } from "@/app/actions/snapshot";
import { generateSignalsAction } from "@/app/actions/signals";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { fetchWithTimeout } from "@/src/lib/fetch-utils";
import type { StoryHubPersistFields } from "@/src/lib/story-hub-optimistic";
import type {
  DashboardSummary,
  EcosystemWatchlistSearchItem,
  InvestmentThemeRecord,
  Signal,
  Stock,
  StructureTagSlice,
  ThemeStructuralSparklineEntry,
} from "@/src/types/investment";
import type { TradeEntryInitial } from "@/src/components/dashboard/TradeEntryForm";
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";

const DEFAULT_USER_ID = defaultProfileUserId();

/** `/api/dashboard` のサーバー側ソフト上限（既定 45s）より長くし、先に Abort しないようにする */
const DASHBOARD_FETCH_TIMEOUT_MS = 55_000;
const LIVE_PULSE_POLL_MS = 45_000;

export const EMPTY_SUMMARY: DashboardSummary = {
  portfolioAverageAlpha: 0,
  portfolioAverageFxNeutralAlpha: 0,
  portfolioAvgAlphaStalestLatestYmd: null,
  portfolioAvgAlphaFreshestLatestYmd: null,
  portfolioAvgAlphaAsOfDisplay: null,
  averageDailyAlphaPct: null,
  portfolioTotalLiveAlphaPct: null,
  benchmarkLatestPrice: 0,
  benchmarkChangePct: null,
  benchmarkPriceSource: "close",
  benchmarkAsOf: null,
  fxUsdJpy: null,
  totalHoldings: 0,
  marketIndicators: [],
  goldPrice: null,
  btcPrice: null,
  totalCostBasisJpy: 0,
  totalRealizedPnlJpy: 0,
  totalUnrealizedPnlJpy: 0,
  totalProfitJpy: 0,
  totalReturnPct: 0,
  portfolioAvgDayChangePct: null,
};

export type DashboardPayload = {
  userId: string;
  stocks: Stock[];
  allThemes: InvestmentThemeRecord[];
  themeStructuralSparklines: ThemeStructuralSparklineEntry[];
  signals: Signal[];
  structureBySector: StructureTagSlice[];
  totalMarketValue: number;
  summary: DashboardSummary;
  ecosystemWatchlistSearch: EcosystemWatchlistSearchItem[];
};

type DashboardContextValue = {
  clientReady: boolean;
  userId: string;
  data: DashboardPayload | null;
  error: string | null;
  loading: boolean;
  slowLoading: boolean;
  actionMessage: string | null;
  refreshPending: boolean;
  snapshotPending: boolean;
  pending: boolean;
  tradeFormOpen: boolean;
  tradeInitial: TradeEntryInitial | null;
  /** ホームの保有テーブルでハイライト・スクロールするティッカー（大文字キー） */
  focusedTicker: string | null;
  setFocusedTicker: (ticker: string | null) => void;
  loadDashboard: () => Promise<void>;
  onGenerateSignals: () => void;
  onRefresh: () => void;
  onRecordSnapshot: () => void;
  openTradeForm: (initial: TradeEntryInitial | null) => void;
  closeTradeForm: () => void;
  resolveSignalOptimistic: (signalId: string) => void;
  structuralSparklineByThemeId: Record<string, number[]>;
  portfolioThemeSet: Set<string>;
  satelliteStockCount: number;
  /** Story パネル保存後: 該当保有行のメモ・決算・リンチ文を即時反映（フル再取得を待たない） */
  patchStockStoryHubFields: (holdingId: string, fields: StoryHubPersistFields) => void;
};

const DashboardDataContext = createContext<DashboardContextValue | null>(null);

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [clientReady, setClientReady] = useState(false);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slowLoading, setSlowLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [refreshPending, startRefreshTransition] = useTransition();
  const [snapshotPending, startSnapshotTransition] = useTransition();
  const [tradeFormOpen, setTradeFormOpen] = useState(false);
  const [tradeInitial, setTradeInitial] = useState<TradeEntryInitial | null>(null);
  const [focusedTicker, setFocusedTicker] = useState<string | null>(null);
  const { setFxRateFromQuote } = useCurrencyConverter();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setSlowLoading(false);
    setError(null);
    const slowTimer = setTimeout(() => setSlowLoading(true), 3000);
    try {
      const res = await fetchWithTimeout(
        `/api/dashboard?userId=${encodeURIComponent(DEFAULT_USER_ID)}`,
        { cache: "no-store" },
        { timeoutMs: DASHBOARD_FETCH_TIMEOUT_MS },
      );
      const json = (await res.json()) as Partial<DashboardPayload> & { error?: string; hint?: string };
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}${json.hint ? ` — ${json.hint}` : ""}`);
        return;
      }
      setData({
        userId: json.userId!,
        stocks: json.stocks ?? [],
        allThemes: json.allThemes ?? [],
        themeStructuralSparklines: json.themeStructuralSparklines ?? [],
        signals: json.signals ?? [],
        structureBySector: json.structureBySector ?? [],
        totalMarketValue: json.totalMarketValue ?? 0,
        summary: { ...EMPTY_SUMMARY, ...(json.summary ?? {}) },
        ecosystemWatchlistSearch: Array.isArray(json.ecosystemWatchlistSearch)
          ? (json.ecosystemWatchlistSearch as EcosystemWatchlistSearchItem[])
          : [],
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError("接続タイムアウト：通信環境を確認してください");
      } else {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      }
    } finally {
      clearTimeout(slowTimer);
      setSlowLoading(false);
      setLoading(false);
    }
  }, []);

  const resolveSignalOptimistic = useCallback(
    (signalId: string) => {
      setData((prev) => {
        if (!prev) return prev;
        return { ...prev, signals: (prev.signals ?? []).filter((s) => s.id !== signalId) };
      });
      void loadDashboard();
    },
    [loadDashboard],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadDashboard();
    }, LIVE_PULSE_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadDashboard]);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const summaryForFx = data?.summary ?? EMPTY_SUMMARY;
  useEffect(() => {
    setFxRateFromQuote(summaryForFx.fxUsdJpy);
  }, [summaryForFx.fxUsdJpy, setFxRateFromQuote]);

  const onGenerateSignals = useCallback(() => {
    setActionMessage(null);
    startTransition(async () => {
      const result = await generateSignalsAction(DEFAULT_USER_ID);
      setActionMessage(result.message);
      await loadDashboard();
    });
  }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    setActionMessage(null);
    startRefreshTransition(async () => {
      const result = await generateSignalsAction(DEFAULT_USER_ID);
      setActionMessage(result.message);
      await loadDashboard();
    });
  }, [loadDashboard]);

  const onRecordSnapshot = useCallback(() => {
    setActionMessage(null);
    startSnapshotTransition(async () => {
      const result = await recordPortfolioSnapshotAction(DEFAULT_USER_ID);
      setActionMessage(result.message);
      const msg = result.message;
      setTimeout(() => {
        if (result.ok) toast.success(msg, { duration: 10_000 });
        else toast.error(msg, { duration: 12_000 });
      }, 0);
      if (result.ok) await loadDashboard();
    });
  }, [loadDashboard]);

  const openTradeForm = useCallback((initial: TradeEntryInitial | null) => {
    setTradeInitial(initial);
    setTradeFormOpen(true);
  }, []);

  const closeTradeForm = useCallback(() => {
    setTradeFormOpen(false);
    setTradeInitial(null);
  }, []);

  const patchStockStoryHubFields = useCallback((holdingId: string, fields: StoryHubPersistFields) => {
    setData((prev) => {
      if (!prev) return prev;
      const stocks = prev.stocks.map((s) =>
        s.id === holdingId
          ? {
              ...s,
              memo: fields.memo,
              earningsSummaryNote: fields.earningsSummaryNote,
              lynchDriversNarrative: fields.lynchDriversNarrative,
              lynchStoryText: fields.lynchStoryText,
            }
          : s,
      );
      return { ...prev, stocks };
    });
  }, []);

  const stocks = useMemo(() => data?.stocks ?? [], [data]);
  const portfolioThemeSet = useMemo(
    () => new Set(stocks.map((s) => (s.tag ?? "").trim()).filter((x) => x.length > 0)),
    [stocks],
  );

  const structuralSparklineByThemeId = useMemo(() => {
    const rec: Record<string, number[]> = {};
    for (const e of data?.themeStructuralSparklines ?? []) {
      if (e.themeId != null && e.themeId.length > 0 && Array.isArray(e.cumulativeValues)) {
        rec[e.themeId] = e.cumulativeValues;
      }
    }
    return rec;
  }, [data?.themeStructuralSparklines]);

  const satelliteStockCount = useMemo(
    () =>
      stocks.filter((s) => s.category === "Satellite" && s.quantity > 0 && s.marketValue > 0).length,
    [stocks],
  );

  const value = useMemo<DashboardContextValue>(
    () => ({
      clientReady,
      userId: DEFAULT_USER_ID,
      data,
      error,
      loading,
      slowLoading,
      actionMessage,
      refreshPending,
      snapshotPending,
      pending,
      tradeFormOpen,
      tradeInitial,
      focusedTicker,
      setFocusedTicker,
      loadDashboard,
      onGenerateSignals,
      onRefresh,
      onRecordSnapshot,
      openTradeForm,
      closeTradeForm,
      resolveSignalOptimistic,
      structuralSparklineByThemeId,
      portfolioThemeSet,
      satelliteStockCount,
      patchStockStoryHubFields,
    }),
    [
      clientReady,
      data,
      error,
      loading,
      slowLoading,
      actionMessage,
      refreshPending,
      snapshotPending,
      pending,
      tradeFormOpen,
      tradeInitial,
      focusedTicker,
      loadDashboard,
      onGenerateSignals,
      onRefresh,
      onRecordSnapshot,
      openTradeForm,
      closeTradeForm,
      resolveSignalOptimistic,
      structuralSparklineByThemeId,
      portfolioThemeSet,
      satelliteStockCount,
      patchStockStoryHubFields,
    ],
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData(): DashboardContextValue {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error("useDashboardData must be used within DashboardDataProvider");
  return ctx;
}
