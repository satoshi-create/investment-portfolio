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

const USO_MACRO_DEF = MARKET_GLANCE_MACRO_DEFS.find((d) => d.symbol === "USO");

/**
 * テーマ「非石油文明」「石油文明」用スポット指標（`fetchOilThemeMacroSpotIndicators`）。
 * USO は `MARKET_GLANCE_MACRO_DEFS` と同一ラベル・シンボル（MarketBar / グレンスと整合）。
 */
export const OIL_THEME_SPOT_MACRO_DEFS: readonly { label: string; symbol: string }[] =
  USO_MACRO_DEF != null
    ? [
        { label: "WTI 近月 (CL)", symbol: "CL=F" },
        { label: "Brent 近月 (BZ)", symbol: "BZ=F" },
        USO_MACRO_DEF,
      ]
    : [
        { label: "WTI 近月 (CL)", symbol: "CL=F" },
        { label: "Brent 近月 (BZ)", symbol: "BZ=F" },
        { label: "Crude (USO)", symbol: "USO" },
      ];

const OIL_STRUCTURAL_THEME_NAMES = new Set<string>(["非石油文明", "石油文明"]);

/** DB / URL 解決後のテーマ名が原油対照テーマか（上記2名の完全一致のみ）。 */
export function isOilStructuralTheme(themeName: string): boolean {
  return OIL_STRUCTURAL_THEME_NAMES.has(themeName.trim());
}
