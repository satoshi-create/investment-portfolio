/**
 * Market glance strip: Yahoo symbols used by `fetchGlobalMarketIndicators` and Nenrin chart API.
 * Keep labels in sync with `MarketBar` (built from this list).
 */
export const MARKET_GLANCE_MACRO_DEFS: readonly { label: string; symbol: string }[] = [
  { label: "USD/JPY", symbol: "JPY=X" },
  { label: "Crude (USO)", symbol: "USO" },
  { label: "Gold", symbol: "GC=F" },
  { label: "BTC", symbol: "BTC-USD" },
  { label: "S&P 500", symbol: "^GSPC" },
  { label: "NASDAQ 100", symbol: "^NDX" },
  { label: "SOX", symbol: "^SOX" },
  { label: "VIX", symbol: "^VIX" },
  { label: "Nikkei 225", symbol: "^N225" },
  { label: "10Y Yield", symbol: "^TNX" },
  { label: "Dow Jones", symbol: "^DJI" },
  { label: "Russell 2000", symbol: "^RUT" },
];

export const MARKET_GLANCE_MACRO_SYMBOL_SET = new Set(
  MARKET_GLANCE_MACRO_DEFS.map((d) => d.symbol),
);
