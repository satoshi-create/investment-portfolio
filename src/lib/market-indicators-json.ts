import type { MarketIndicator } from "@/src/types/investment";

/**
 * `market_glance_snapshots.payload_json` / `portfolio_daily_snapshots.market_indicators_json` をパース（空配列可）。
 */
export function parseMarketGlancePayload(raw: unknown): MarketIndicator[] | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const out: MarketIndicator[] = [];
    for (const item of parsed) {
      if (item == null || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const label = typeof o.label === "string" ? o.label : "";
      const value = typeof o.value === "number" ? o.value : Number(o.value);
      const changePct = typeof o.changePct === "number" ? o.changePct : Number(o.changePct);
      if (!label) continue;
      if (!Number.isFinite(value) || !Number.isFinite(changePct)) continue;
      out.push({ label, value, changePct });
    }
    return out;
  } catch {
    return undefined;
  }
}
