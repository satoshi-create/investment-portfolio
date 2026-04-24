import type { PortfolioAggregateKPI } from "@/src/types/investment";
import type { CsvColumnDef } from "@/src/lib/csv-export";
import { parseCsv } from "@/src/lib/csv-parse-minimal";

/**
 * 書き出し/取り込みの列。1行目の見出しは DB/JSON と齟齬のない snake 系 + id。
 */
export const AGGREGATE_KPI_CSV_COLUMNS: CsvColumnDef[] = [
  { key: "id", header: "id" },
  { key: "userId", header: "user_id" },
  { key: "asOfDate", header: "as_of_date" },
  { key: "windowDays", header: "window_days" },
  { key: "snapshotCount", header: "snapshot_count" },
  { key: "periodStart", header: "period_start" },
  { key: "periodEnd", header: "period_end" },
  { key: "totalProfitChange", header: "total_profit_change" },
  { key: "valuationChange", header: "valuation_change" },
  { key: "avgPfDailyChangePct", header: "avg_pf_daily_change_pct" },
  { key: "avgBmDailyChangePct", header: "avg_bm_daily_change_pct" },
  { key: "avgAlphaDeviationPct", header: "avg_alpha_deviation_pct" },
  { key: "avgVooDailyPct", header: "avg_voo_daily_pct" },
  { key: "computedAt", header: "computed_at" },
];

export function portfolioAggregateKpisToCsvRows(kpis: PortfolioAggregateKPI[]): Record<string, unknown>[] {
  return kpis.map((k) => ({
    id: k.id,
    userId: k.userId,
    asOfDate: k.asOfDate,
    windowDays: k.windowDays,
    snapshotCount: k.snapshotCount,
    periodStart: k.periodStart,
    periodEnd: k.periodEnd,
    totalProfitChange: k.totalProfitChange,
    valuationChange: k.valuationChange,
    avgPfDailyChangePct: k.avgPfDailyChangePct,
    avgBmDailyChangePct: k.avgBmDailyChangePct,
    avgAlphaDeviationPct: k.avgAlphaDeviationPct,
    avgVooDailyPct: k.avgVooDailyPct,
    computedAt: k.computedAt,
  }));
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, "_");
}

function numOrEmpty(raw: string): number | null {
  const s = raw.trim();
  if (s.length === 0) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

const HEADER_ALIASES: Record<string, string> = {
  id: "id",
  user_id: "user_id",
  userid: "user_id",
  as_of_date: "as_of_date",
  asof: "as_of_date",
  window_days: "window_days",
  windowdays: "window_days",
  snapshot_count: "snapshot_count",
  n: "snapshot_count",
  period_start: "period_start",
  period_end: "period_end",
  total_profit_change: "total_profit_change",
  profit_change: "total_profit_change",
  valuation_change: "valuation_change",
  delta_valuation: "valuation_change",
  avg_pf_daily_change_pct: "avg_pf_daily_change_pct",
  avg_bm_daily_change_pct: "avg_bm_daily_change_pct",
  avg_alpha_deviation_pct: "avg_alpha_deviation_pct",
  alpha: "avg_alpha_deviation_pct",
  avg_voo_daily_pct: "avg_voo_daily_pct",
  computed_at: "computed_at",
  computed: "computed_at",
};

/**
 * インポート用 1 行。サーバーで upsert。
 */
export type AggregateKpiImportRow = {
  id: string;
  userId: string;
  asOfDate: string;
  windowDays: number;
  snapshotCount: number;
  periodStart: string;
  periodEnd: string;
  totalProfitChange: number | null;
  valuationChange: number | null;
  avgPfDailyChangePct: number | null;
  avgBmDailyChangePct: number | null;
  avgAlphaDeviationPct: number | null;
  avgVooDailyPct: number | null;
  computedAt: string;
};

function resolveCanonHeader(raw: string): string | null {
  const n = normHeader(raw);
  if (n.length === 0) return null;
  if (HEADER_ALIASES[n]) return HEADER_ALIASES[n]!;
  if (Object.values(HEADER_ALIASES).includes(n)) return n;
  return n;
}

export function parseAggregateKpiImportCsv(csvText: string): { ok: true; rows: AggregateKpiImportRow[] } | { ok: false; error: string } {
  const raw = csvText.replace(/^\uFEFF/, "");
  const matrix = parseCsv(raw);
  if (matrix.length < 2) {
    return { ok: false, error: "CSV には見出し行と少なくとも 1 行のデータが必要です。" };
  }
  const headerLine = matrix[0]!.map((h) => resolveCanonHeader(h) ?? normHeader(h));
  const colIndex = new Map<string, number>();
  headerLine.forEach((h, i) => {
    if (h && !colIndex.has(h)) colIndex.set(h, i);
  });

  const need = [
    "as_of_date",
    "window_days",
    "snapshot_count",
    "period_start",
    "period_end",
    "computed_at",
  ] as const;
  for (const k of need) {
    if (colIndex.get(k) == null) {
      return { ok: false, error: `必須列がありません: ${k}（見出し: ${headerLine.join(", ")}）` };
    }
  }

  const rows: AggregateKpiImportRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r]!;
    const g = (key: string) => {
      const i = colIndex.get(key);
      return i == null ? "" : (line[i] ?? "").trim();
    };

    const asOf = g("as_of_date");
    if (!YMD.test(asOf)) {
      return { ok: false, error: `行 ${r + 1}: as_of_date が YYYY-MM-DD 形式ではありません: ${asOf || "（空）"}` };
    }
    const wd = numOrEmpty(g("window_days"));
    if (wd == null || !Number.isInteger(wd) || wd < 1 || wd > 366) {
      return { ok: false, error: `行 ${r + 1}: window_days は 1…366 の整数である必要があります` };
    }
    const nSnap = numOrEmpty(g("snapshot_count"));
    if (nSnap == null || !Number.isInteger(nSnap) || nSnap < 0) {
      return { ok: false, error: `行 ${r + 1}: snapshot_count は 0 以上の整数である必要があります` };
    }
    const pStart = g("period_start");
    const pEnd = g("period_end");
    if (!YMD.test(pStart) || !YMD.test(pEnd)) {
      return { ok: false, error: `行 ${r + 1}: period_start / period_end は YYYY-MM-DD 形式である必要があります` };
    }
    const comp = g("computed_at");
    if (comp.length < 10) {
      return { ok: false, error: `行 ${r + 1}: computed_at が短すぎます（ISO 日時推奨）` };
    }

    const idRaw = g("id").trim();

    rows.push({
      id: idRaw,
      userId: g("user_id"),
      asOfDate: asOf,
      windowDays: wd,
      snapshotCount: nSnap,
      periodStart: pStart,
      periodEnd: pEnd,
      totalProfitChange: numOrEmpty(g("total_profit_change")),
      valuationChange: numOrEmpty(g("valuation_change")),
      avgPfDailyChangePct: numOrEmpty(g("avg_pf_daily_change_pct")),
      avgBmDailyChangePct: numOrEmpty(g("avg_bm_daily_change_pct")),
      avgAlphaDeviationPct: numOrEmpty(g("avg_alpha_deviation_pct")),
      avgVooDailyPct: numOrEmpty(g("avg_voo_daily_pct")),
      computedAt: comp,
    });
  }

  if (rows.length > 500) {
    return { ok: false, error: "1 度に取り込める行は 500 行までです。" };
  }

  return { ok: true, rows };
}

export function aggregateKpiCsvFileName(windowDays: number): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `aggregate_kpis_${windowDays}d_${y}${m}${day}.csv`;
}
