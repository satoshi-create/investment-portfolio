import { classifyTickerInstrument } from "@/src/lib/alpha-logic";

/**
 * 保有のうち「ETF / 上場投信 / 投信コード（6桁以上）」らしき銘柄を推定する。
 * 個別株との完全分離はできないため、JP 上場株は銘柄名ヒントが必要（誤検知抑制）。
 */
export function isLikelyEtfOrFundHolding(ticker: string, name: string): boolean {
  const t = ticker.trim();
  if (!t) return false;

  const kind = classifyTickerInstrument(t);
  if (kind === "JP_INVESTMENT_TRUST") return true;

  const n = name.normalize("NFKC").trim();
  const lower = n.toLowerCase();

  if (kind === "JP_LISTED_EQUITY") {
    if (/\betf\b/i.test(lower)) return true;
    if (n.includes("上場投信") || n.includes("上場インデックス")) return true;
    if (/連動型|インデックス型/.test(n)) return true;
    if (/spdr|ishares|invesco|vanguard|next|ネクスト|ifree|ｉｆｒｅｅ/i.test(lower)) return true;
    return false;
  }

  if (kind === "US_EQUITY") {
    if (/\betf\b/i.test(lower)) return true;
    if (/index fund|index etf/i.test(lower)) return true;
    if (/\btrust\b.*\bfund\b|\bfund\b.*\btrust\b/i.test(lower)) return true;
    return false;
  }

  return false;
}
