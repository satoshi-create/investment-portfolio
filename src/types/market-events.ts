/** Row from `market_events` (Koyomi / patrol calendar). */
export type MarketEventRecord = {
  id: string;
  event_date: string;
  title: string;
  category: string;
  importance: number;
  description: string | null;
};
