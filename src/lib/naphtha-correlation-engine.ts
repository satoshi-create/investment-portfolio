/**
 * Pure helpers: Pearson correlation, naphtha spike dates, aligned daily returns.
 * Separated from I/O for unit-style clarity and optional RPC reuse.
 */

export const NAPHTHA_DEFAULT_LOOKBACK_DAYS = 90;
/** Absolute daily % move on proxy series to draw "Edo Transition Trigger" line */
export const NAPHTHA_SPIKE_ABS_DAILY_PCT = 2.5;
export const MIN_PAIRS_FOR_CORRELATION = 14;

export function pearsonCorrelation(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < MIN_PAIRS_FOR_CORRELATION) return null;
  const n = a.length;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i]!;
    sumB += b[i]!;
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i]! - meanA;
    const db = b[i]! - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  if (den < 1e-12) return null;
  return num / den;
}

/** Map date -> forward daily % return from sorted closing prices (same calendar order as dates). */
export function dailyReturnPercentByDate(dates: string[], closes: number[]): Map<string, number> {
  const out = new Map<string, number>();
  if (dates.length !== closes.length || dates.length < 2) return out;
  for (let i = 1; i < dates.length; i++) {
    const d = dates[i]!;
    const prev = closes[i - 1]!;
    const cur = closes[i]!;
    if (!(prev > 0) || !(cur > 0)) continue;
    out.set(d.slice(0, 10), ((cur - prev) / prev) * 100);
  }
  return out;
}

export function detectSpikeDates(returnByDate: Map<string, number>, thresholdAbsPct: number): string[] {
  const spikes: string[] = [];
  for (const [d, r] of returnByDate) {
    if (Number.isFinite(r) && Math.abs(r) >= thresholdAbsPct) spikes.push(d.slice(0, 10));
  }
  return spikes.sort();
}

export function meanNonNull(values: (number | null)[]): number | null {
  const nums = values.filter((x): x is number => x != null && Number.isFinite(x));
  if (nums.length === 0) return null;
  return nums.reduce((s, x) => s + x, 0) / nums.length;
}
