import type { YahooBuybackPosture } from "@/src/types/investment";

function parseFiscalRepurchasesAbs(raw: unknown): YahooBuybackPosture["fiscalRepurchasesAbs"] {
  if (!Array.isArray(raw)) return [];
  const out: { endDateYmd: string; amountAbs: number }[] = [];
  for (const x of raw) {
    if (x == null || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const ymd =
      typeof o.endDateYmd === "string"
        ? o.endDateYmd.trim().slice(0, 10)
        : typeof o.end_date_ymd === "string"
          ? o.end_date_ymd.trim().slice(0, 10)
          : "";
    const amt = o.amountAbs ?? o.amount_abs;
    const n = typeof amt === "number" ? amt : Number(amt);
    if (ymd.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    if (!Number.isFinite(n) || n <= 0) continue;
    out.push({ endDateYmd: ymd, amountAbs: n });
  }
  return out;
}

/** テーマ API 等の JSON から `YahooBuybackPosture` を復元（camelCase / snake_case）。 */
export function parseYahooBuybackPostureJson(raw: unknown): YahooBuybackPosture | null {
  if (raw == null) return null;
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const fiscal = parseFiscalRepurchasesAbs(
    o.fiscalRepurchasesAbs ?? o.fiscal_repurchases_abs,
  );
  const s3 = o.sum3yAbs ?? o.sum3y_abs;
  const s5 = o.sum5yAbs ?? o.sum5y_abs;
  const aq = o.activeQuartersLast4 ?? o.active_quarters_last4;
  const sum3yAbs = s3 != null && Number.isFinite(Number(s3)) && Number(s3) > 0 ? Number(s3) : null;
  const sum5yAbs = s5 != null && Number.isFinite(Number(s5)) && Number(s5) > 0 ? Number(s5) : null;
  const activeQuartersLast4 =
    aq != null && Number.isFinite(Number(aq)) && Number(aq) >= 0 && Number(aq) <= 4 ? Number(aq) : null;
  if (fiscal.length === 0 && sum3yAbs == null && sum5yAbs == null && activeQuartersLast4 == null) return null;
  return {
    fiscalRepurchasesAbs: fiscal,
    sum3yAbs,
    sum5yAbs,
    activeQuartersLast4,
  };
}

/** 自社株買い規模の短縮表示（現地通貨・絶対値）。 */
export function formatRepurchaseAbsScale(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return n.toFixed(0);
}

/** TTM 以外に、CF 系列（期別・3y/5y）があればチップ表示する。 */
export function hasBuybackChipData(
  ttmRepurchaseOfStock: number | null,
  yahooBuybackPosture: YahooBuybackPosture | null,
): boolean {
  if (ttmRepurchaseOfStock != null && Number.isFinite(ttmRepurchaseOfStock) && ttmRepurchaseOfStock > 0) return true;
  const p = yahooBuybackPosture;
  if (p == null) return false;
  if (p.fiscalRepurchasesAbs.length > 0) return true;
  if (p.sum3yAbs != null && Number.isFinite(p.sum3yAbs) && p.sum3yAbs > 0) return true;
  if (p.sum5yAbs != null && Number.isFinite(p.sum5yAbs) && p.sum5yAbs > 0) return true;
  if (p.activeQuartersLast4 != null && p.activeQuartersLast4 > 0) return true;
  return false;
}

/** チップ本文（TTM 優先、無ければ 3y / 5y / 汎用）。 */
export function buybackChipShortLabel(ttmRepurchaseOfStock: number | null, yahooBuybackPosture: YahooBuybackPosture | null): string {
  const ttm = ttmRepurchaseOfStock;
  if (ttm != null && Number.isFinite(ttm) && ttm > 0) return `TTM ${formatRepurchaseAbsScale(ttm)}`;
  const p = yahooBuybackPosture;
  if (p?.sum3yAbs != null && Number.isFinite(p.sum3yAbs) && p.sum3yAbs > 0) return `3y ${formatRepurchaseAbsScale(p.sum3yAbs)}`;
  if (p?.sum5yAbs != null && Number.isFinite(p.sum5yAbs) && p.sum5yAbs > 0) return `5y ${formatRepurchaseAbsScale(p.sum5yAbs)}`;
  if (p != null && p.fiscalRepurchasesAbs.length > 0) return "CF 期別";
  if (p?.activeQuartersLast4 != null && p.activeQuartersLast4 > 0) return `4Q中${p.activeQuartersLast4}期`;
  return "CF";
}

/** 保有・エコ共通: 自社株買いバッジの `title` 用。 */
export function yahooBuybackResearchTooltip(input: {
  ttmRepurchaseOfStock: number | null;
  yahooBuybackPosture: YahooBuybackPosture | null;
}): string {
  const ttm = input.ttmRepurchaseOfStock;
  const head =
    ttm != null && Number.isFinite(ttm) && ttm > 0
      ? `直近4四半期の自社株買い合計（絶対値）: ${formatRepurchaseAbsScale(ttm)}`
      : "直近4四半期の自社株買い合計（TTM）: 未取得またはゼロ（下記は quoteSummary の CF 系列）";
  const lines = [head];
  const p = input.yahooBuybackPosture;
  if (p != null) {
    if (p.sum3yAbs != null && Number.isFinite(p.sum3yAbs) && p.sum3yAbs > 0) {
      lines.push(`暦年ベース直近3年合計（絶対値）: ${formatRepurchaseAbsScale(p.sum3yAbs)}`);
    }
    if (p.sum5yAbs != null && Number.isFinite(p.sum5yAbs) && p.sum5yAbs > 0) {
      lines.push(`暦年ベース直近5年合計: ${formatRepurchaseAbsScale(p.sum5yAbs)}`);
    }
    if (p.activeQuartersLast4 != null) lines.push(`直近4Qのうち repurchase 非ゼロの期: ${p.activeQuartersLast4}`);
    if (p.fiscalRepurchasesAbs.length > 0) {
      lines.push(
        "期別（新しい順・絶対値）:\n" +
          p.fiscalRepurchasesAbs
            .slice(0, 8)
            .map((x) => `${x.endDateYmd}: ${formatRepurchaseAbsScale(x.amountAbs)}`)
            .join("\n"),
      );
    }
  }
  return lines.join("\n\n");
}
