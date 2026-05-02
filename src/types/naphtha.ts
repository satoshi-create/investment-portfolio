/**
 * Naphtha correlation engine / 江戸循環ネットワーク — commodity proxy vs 対 VOO 日次 Alpha。
 *
 * ```mermaid
 * graph TD
 *   A[Naphtha API] -->|Fetch| B(Supabase/Turso: commodity_prices)
 *   C[Yahoo / alpha_history] -->|Alpha vs VOO| D(alpha series)
 *   B & D --> E{Correlation Engine}
 *   E -->|If Spike Detected| F[Edo Transition Alert]
 *   F -->|Update| G[Notion: Investment Dashboard]
 *   F -->|Render| H[Next.js Dashboard]
 * ```
 */

/** DB row: `commodity_prices` */
export interface CommodityPriceRow {
  id: string;
  symbol: string;
  price: number;
  timestamp: string;
  sourceUrl: string | null;
  createdAt?: string;
}

/** Chart payload assembled server-side for `NaphthaCorrelationChart`. */
export interface NaphthaCorrelationChartData {
  lookbackDays: number;
  /** Yahoo symbol used when DB series is sparse (e.g. CL=F as crack-spread proxy). */
  naphthaProxyYahooSymbol: string;
  /** Upper pane: Naphtha (or proxy) spot / historical close by session date. */
  priceArea: { date: string; price: number }[];
  /**
   * Lower pane rows: Recharts `data` — each row has `date` plus one numeric key per ticker
   * (`alpha_${sanitizedTicker}`) for daily alpha vs VOO (% pt).
   */
  alphaComboRows: Record<string, number | string | null>[];
  /** `{ dataKey, labelJa }` for Line components */
  alphaSeries: { dataKey: string; labelJa: string; ticker: string }[];
  /** Dates (YYYY-MM-DD) where proxy daily return exceeded spike threshold (Edo Transition Trigger). */
  spikeDates: string[];
  /** Pearson corr: naphtha daily return vs equal-weighted mean of watchlist daily alphas (aligned dates). */
  aggregateCorrelation: number | null;
  correlationPairCount: number;
  /** 24h / 7d change on latest proxy close vs DB prior rows (best-effort). */
  change24hPct: number | null;
  change7dPct: number | null;
  /** Whether chart used DB commodity rows, Yahoo only, or merged. */
  priceSource: "db" | "yahoo" | "merged";
}
