import { classifyTickerInstrument } from "@/src/lib/alpha-logic";
import type { TickerInstrumentKind } from "@/src/types/investment";

/**
 * クライアント表示用: Yahoo 引用の手動上書きがなければ、米株は大文字、日株は `.T` なしのコード表記。
 */
export function yahooSymbolForTooltip(ticker: string, providerSymbol?: string | null): string {
  const manual = providerSymbol?.trim();
  if (manual != null && manual.length > 0) return manual;
  const raw = ticker.trim();
  if (raw.length === 0) return "";
  const kind = classifyTickerInstrument(raw);
  if (kind === "JP_INVESTMENT_TRUST" || kind === "JP_LISTED_EQUITY") {
    return `${raw.replace(/\.T$/i, "").trim()}.T`;
  }
  return raw.toUpperCase();
}

/**
 * テーブル上のティッカー: 日本株は東証コードのみ（4〜6 桁・数値中心）、米株は従来どおり大文字英字。
 */
export function formatTickerForDisplay(ticker: string, kind: TickerInstrumentKind): string {
  const t = ticker.trim();
  if (t.length === 0) return "";
  if (kind === "JP_LISTED_EQUITY" || kind === "JP_INVESTMENT_TRUST") {
    return t.replace(/\.T$/i, "");
  }
  return t.toUpperCase();
}
