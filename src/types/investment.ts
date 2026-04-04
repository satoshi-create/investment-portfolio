export type AlphaHistory = number[];

/** Interpretation of `holdings.ticker` for Alpha inputs (see `src/lib/alpha-logic.ts`). */
export type TickerInstrumentKind = "JP_INVESTMENT_TRUST" | "US_EQUITY";

/** DB `holdings` row subset for sync / signals context. */
export interface Holding {
  id: string;
  ticker: string;
  providerSymbol?: string | null;
}

export interface Stock {
  id: string;
  ticker: string;
  name: string;
  tag: string;
  alphaHistory: AlphaHistory;
  weight: number;
  quantity: number;
  /** Yahoo Finance 等。未設定時は `ticker` から自動変換（`price-service`）。 */
  providerSymbol?: string | null;
}

export interface Signal extends Stock {
  isWarning: boolean;
  isBuy: boolean;
  currentAlpha: number;
}

export interface SignalPerformanceLog {
  date: string;
  ticker: string;
  type: "BUY" | "WARN";
  result: string;
  status: "Active" | "Avoided" | "Success" | "Failed";
}
