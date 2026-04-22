/**
 * ビットコインテーマ用: 複数 Yahoo シンボルの日足を揃え、同一カレンダー上の「期間初日比・累積％」を構築。
 * `market-glance` のマクロ制限なし（サーバー専用・btc-theme API からのみ呼ぶ）。
 */
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export type BtcThemeChartPeriod = "5d" | "1mo" | "3mo";

export type BtcThemeChartRow = {
  date: string;
  /** 各ティッカー（大文字）→ その日の終値ベース累積％（初日共通＝0） */
  [ticker: string]: string | number;
};

const CALENDAR_BUFFER_DAYS = 18;

function formatDateYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function chartBarDateYmd(q: { date: unknown }): string | null {
  const d = q.date instanceof Date ? q.date : new Date(String(q.date));
  if (Number.isNaN(d.getTime())) return null;
  return formatDateYmd(d);
}

function roundPct(v: number): number {
  return Math.round(v * 100) / 100;
}

function periodToCalendarSpan(period: BtcThemeChartPeriod): number {
  if (period === "5d") return 9;
  if (period === "3mo") return 100;
  return 35;
}

function periodRange(calendarDays: number): { period1: string; period2: string } {
  const safeDays = Math.max(1, Math.floor(Number.isFinite(calendarDays) ? calendarDays : 1));
  const period2 = new Date();
  const period1 = new Date(period2.getTime());
  const span = safeDays + CALENDAR_BUFFER_DAYS;
  period1.setUTCDate(period1.getUTCDate() - span);
  let p1 = period1.toISOString().slice(0, 10);
  const p2 = period2.toISOString().slice(0, 10);
  if (p1 >= p2) {
    period1.setUTCDate(period1.getUTCDate() - 1);
    p1 = period1.toISOString().slice(0, 10);
  }
  return { period1: p1, period2: p2 };
}

export async function fetchDailyClosesByDate(
  yahooSymbol: string,
  period: BtcThemeChartPeriod,
): Promise<Map<string, number>> {
  const { period1, period2 } = periodRange(periodToCalendarSpan(period));
  const result = await yahooFinance.chart(yahooSymbol, { period1, period2, interval: "1d" });
  const quotes = result.quotes ?? [];
  const out = new Map<string, number>();
  for (const q of quotes) {
    if (q.close == null || !Number.isFinite(q.close) || q.close <= 0) continue;
    const ymd = chartBarDateYmd(q);
    if (ymd == null) continue;
    out.set(ymd, q.close);
  }
  return out;
}

function intersectSortedDates(maps: Map<string, number>[]): string[] {
  if (maps.length === 0) return [];
  let common = new Set(maps[0]!.keys());
  for (let i = 1; i < maps.length; i++) {
    const next = new Set<string>();
    for (const d of common) {
      if (maps[i]!.has(d)) next.add(d);
    }
    common = next;
  }
  return [...common].sort();
}

export type BtcThemeMergedChartResult = {
  period: BtcThemeChartPeriod;
  tickers: string[];
  /** Recharts 用: 各行に date + 各 ticker の数値キー */
  rows: BtcThemeChartRow[];
  errors: { ticker: string; message: string }[];
};

/**
 * 各シンボルの日足マップから、**全シンボルに共通する日付**だけを残し、
 * 先頭共通日の終値を 100% 基準にした累積騰落率（%）系列を構築する。
 */
export function mergeCloseMapsToNenrinRows(
  byTicker: Map<string, Map<string, number>>,
): { rows: BtcThemeChartRow[]; tickers: string[] } {
  const tickers = [...byTicker.keys()];
  const maps = tickers.map((t) => byTicker.get(t)!);
  const dates = intersectSortedDates(maps);
  if (dates.length < 2) {
    return { rows: [], tickers };
  }

  const first = dates[0]!;
  const bases = new Map<string, number>();
  for (const tk of tickers) {
    const m = byTicker.get(tk)!;
    const b = m.get(first);
    if (b == null || !Number.isFinite(b) || b <= 0) {
      return { rows: [], tickers };
    }
    bases.set(tk, b);
  }

  const rows: BtcThemeChartRow[] = [];
  for (const d of dates) {
    const row: BtcThemeChartRow = { date: d };
    let ok = true;
    for (const tk of tickers) {
      const close = byTicker.get(tk)!.get(d);
      const base = bases.get(tk)!;
      if (close == null || !Number.isFinite(close)) {
        ok = false;
        break;
      }
      const pct = ((close - base) / base) * 100;
      row[tk] = Number.isFinite(pct) ? roundPct(pct) : 0;
    }
    if (ok) rows.push(row);
  }

  return { rows, tickers };
}

export function normalizeBtcThemePeriod(raw: string | null): BtcThemeChartPeriod {
  const s = (raw ?? "1mo").trim().toLowerCase();
  if (s === "5d") return "5d";
  if (s === "3mo") return "3mo";
  return "1mo";
}
