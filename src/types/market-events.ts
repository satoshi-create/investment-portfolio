/** Row from `market_events` (Koyomi / patrol calendar) or synthetic watchlist / holding events. */
export type MarketEventRecord = {
  id: string;
  event_date: string;
  title: string;
  category: string;
  importance: number;
  description: string | null;
  /** 合成イベントの由来。DB `market_events` 由来は `macro`。 */
  source?: "macro" | "holding" | "watchlist";
};
