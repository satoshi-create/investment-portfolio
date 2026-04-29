import type { Stock, ThemeEcosystemWatchItem } from "@/src/types/investment";

/**
 * `enrichEcosystemMemberRow` の `inPortfolio` 判定と同じキー（上場= ticker、未上場= proxy）で
 * 有効ティッカーを得る。
 */
function ecosystemRowEffectiveTickerUpper(e: ThemeEcosystemWatchItem): string {
  if (e.isUnlisted) {
    const p = e.proxyTicker != null ? String(e.proxyTicker).trim() : "";
    return p.length > 0 ? p.toUpperCase() : "";
  }
  return String(e.ticker).trim().toUpperCase();
}

/**
 * テーマ・エコウォッチ行が `inPortfolio` のとき、ダッシュ/テーマ詳細の `stocks` から
 * 対応する保有 `Stock` を解決する（`ticker` / `providerSymbol`）。
 * 同一ティッカーが複数行ある場合は評価額が大きい方を採用。
 */
export function resolvePortfolioStockForEcosystemRow(
  e: ThemeEcosystemWatchItem,
  stocks: Stock[],
): Stock | null {
  if (!e.inPortfolio) return null;
  const want = ecosystemRowEffectiveTickerUpper(e);
  if (!want) return null;
  const matches: Stock[] = [];
  for (const s of stocks) {
    const t = s.ticker.trim().toUpperCase();
    const ps = (s.providerSymbol ?? "").trim().toUpperCase();
    if (t === want || (ps.length > 0 && ps === want)) {
      matches.push(s);
    }
  }
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;
  return matches.reduce((a, b) => (a.marketValue >= b.marketValue ? a : b));
}
