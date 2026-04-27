/**
 * リンチの保有例（歴史銘柄含む）— 表示名と Yahoo で参照するティッカー。
 * 廃業・買収銘柄はプロキシを明示。
 */
export type LynchHoldingsSeedRow = {
  id: string;
  displayName: string;
  /** Yahoo リサーチ取得に使うシンボル */
  ticker: string;
  providerSymbol?: string | null;
};

export const LYNCH_HOLDINGS_SEED: readonly LynchHoldingsSeedRow[] = [
  { id: "flying-tiger", displayName: "Flying Tiger", ticker: "FDX", providerSymbol: null },
  { id: "dunkin", displayName: "Dunkin Donuts", ticker: "QSR", providerSymbol: null },
  { id: "walmart", displayName: "Walmart", ticker: "WMT", providerSymbol: null },
  { id: "toys-r-us", displayName: "Toys R Us", ticker: "HAS", providerSymbol: null },
  { id: "stop-shop", displayName: "Stop & Shop", ticker: "ADRNY", providerSymbol: null },
  { id: "subaru", displayName: "Subaru", ticker: "FUJIY", providerSymbol: null },
  { id: "gap", displayName: "Gap", ticker: "GPS", providerSymbol: null },
  { id: "la-quinta", displayName: "La Quinta", ticker: "HLT", providerSymbol: null },
  { id: "service-corp", displayName: "Service Corp", ticker: "SCI", providerSymbol: null },
  { id: "tampax", displayName: "Tampax", ticker: "PG", providerSymbol: null },
  { id: "taco-bell", displayName: "Taco Bell", ticker: "YUM", providerSymbol: null },
  { id: "apple", displayName: "Apple", ticker: "AAPL", providerSymbol: null },
  { id: "volvo", displayName: "Volvo", ticker: "VLVLY", providerSymbol: null },
  { id: "pier1", displayName: "Pier 1 Imports", ticker: "W", providerSymbol: null },
  { id: "hanes", displayName: "Hanes", ticker: "HBI", providerSymbol: null },
  { id: "limited", displayName: "The Limited", ticker: "VSCO", providerSymbol: null },
  { id: "coleco", displayName: "Coleco", ticker: "MAT", providerSymbol: null },
  { id: "seven-oaks", displayName: "Seven Oaks", ticker: "OZK", providerSymbol: null },
  { id: "adp", displayName: "ADP", ticker: "ADP", providerSymbol: null },
  { id: "chrysler", displayName: "Chrysler", ticker: "STLA", providerSymbol: null },
  { id: "ford", displayName: "Ford", ticker: "F", providerSymbol: null },
  { id: "disney", displayName: "Disney", ticker: "DIS", providerSymbol: null },
] as const;
