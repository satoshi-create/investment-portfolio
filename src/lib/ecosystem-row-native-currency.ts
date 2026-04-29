import { classifyTickerInstrument } from "@/src/lib/alpha-logic";
import type { ThemeEcosystemWatchItem } from "@/src/types/investment";

/** 観測行の金額表示用: 米株は USD、それ以外は JPY（`formatEcoPriceForView` と同系） */
export function ecosystemRowNativeCurrency(e: ThemeEcosystemWatchItem): "USD" | "JPY" {
  const proxy = e.proxyTicker != null ? String(e.proxyTicker).trim() : "";
  const eff = e.isUnlisted && proxy.length > 0 ? proxy : String(e.ticker).trim();
  const tk = eff.length > 0 ? eff : String(e.ticker).trim();
  return classifyTickerInstrument(tk) === "US_EQUITY" ? "USD" : "JPY";
}
