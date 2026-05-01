/**
 * テーマ・エコシステム行の「複利点火」判定（サーバー正規化）。
 * - バックフィル: hybrid なし（終値 / DB 系列フォールバック）で `is_compounding_ignited` を永続化。
 * - API: `fetchHoldingsHybridPriceSnapshots` の結果を渡し、Live/close 整合の pulse で上書き。
 *
 * Yahoo が live を返さないときは `HybridHoldingPriceSnapshot` が close となり、**最終戻り値の source は close**。
 * UI は常に本関数＋（API では）hybrid 後の `ThemeEcosystemWatchItem` を真実とする。
 */
import { buildFiveDayPulseDailyAlpha, calculateAlphaAcceleration } from "@/src/lib/alpha-logic";
import { ecosystemRawDailyAlphaOldestToNewest } from "@/src/lib/eco-trend-daily";
import type { HybridHoldingPriceSnapshot } from "@/src/lib/price-service";
import type { ThemeEcosystemWatchItem, TickerInstrumentKind } from "@/src/types/investment";

export type CompoundingIgnitionPriceSource = "live" | "close";

export type CompoundingIgnitionComputeResult = {
  isCompoundingIgnited: boolean;
  pulse5d: number[];
  hasIntradayPulse: boolean;
  compoundingIgnitionPriceSource: CompoundingIgnitionPriceSource;
};

/** theme-detail / バックフィル共通: 日次・累積系列と hybrid で点火と 5D pulse を算出。 */
export function computeCompoundingIgnitionFromAlphaSeries(input: {
  dailyAlphaOldestToNewest: readonly number[];
  cumulativeAlphaOldestToNewest: readonly number[];
  latestDailyAlphaObservationYmd: string | null;
  hybrid: HybridHoldingPriceSnapshot | null | undefined;
  /** hybrid が無いときのフォールバック（alpha_history の終値など） */
  fallbackLivePrice: number | null;
  fallbackPreviousClose: number | null;
  benchmarkDayChangePercent: number | null;
}): CompoundingIgnitionComputeResult {
  const hp = input.hybrid;
  const useHybrid = hp != null && Number.isFinite(hp.price) && hp.price > 0;
  const pulse = buildFiveDayPulseDailyAlpha({
    dailyAlphaHistory: input.dailyAlphaOldestToNewest,
    latestAlphaObservationYmd: input.latestDailyAlphaObservationYmd,
    priceSource: useHybrid ? hp!.source : "close",
    livePrice: useHybrid ? hp!.price : input.fallbackLivePrice,
    previousClose: useHybrid ? hp!.previousClose ?? null : input.fallbackPreviousClose,
    benchmarkDayChangePercent: input.benchmarkDayChangePercent,
  });
  const accel = calculateAlphaAcceleration({
    dailyAlphaOldestToNewest: pulse.series,
    cumulativeAlphaOldestToNewest: input.cumulativeAlphaOldestToNewest,
  });
  const src: CompoundingIgnitionPriceSource = useHybrid ? hp!.source : "close";
  return {
    isCompoundingIgnited: accel.isCompoundingIgnited,
    pulse5d: pulse.series,
    hasIntradayPulse: pulse.hasIntradayPulse,
    compoundingIgnitionPriceSource: src,
  };
}

/** enrich 済みウォッチ行 + オプション hybrid（API でバッチ注入）。hybrid 無しは enrich の株価フィールドで pulse。 */
export function computeCompoundingIgnitionForEcosystemWatchItem(
  item: ThemeEcosystemWatchItem,
  hybrid: HybridHoldingPriceSnapshot | null | undefined,
): CompoundingIgnitionComputeResult {
  const daily = ecosystemRawDailyAlphaOldestToNewest(item);
  return computeCompoundingIgnitionFromAlphaSeries({
    dailyAlphaOldestToNewest: daily,
    cumulativeAlphaOldestToNewest: item.alphaHistory,
    latestDailyAlphaObservationYmd: item.latestDailyAlphaObservationYmd,
    hybrid,
    fallbackLivePrice: item.currentPrice,
    fallbackPreviousClose: item.previousClose,
    benchmarkDayChangePercent: item.benchmarkDayChangePercent,
  });
}

/** `fetchEcosystemWatchlistSearchIndex` 向け: AlphaPoint 系列からフォールバック終値を拾う。 */
export function benchmarkPctForInstrumentKind(
  kind: TickerInstrumentKind,
  usPct: number | null,
  jpPct: number | null,
): number | null {
  return kind === "US_EQUITY" ? usPct : jpPct;
}
