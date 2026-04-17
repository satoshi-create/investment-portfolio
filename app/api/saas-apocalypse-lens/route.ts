import { NextResponse } from "next/server";

import { fetchPriceHistory } from "@/src/lib/price-service";

export const dynamic = "force-dynamic";

const SAAS_BASKET = ["SNOW", "NOW", "CRM", "ADBE", "WDAY"] as const;
const UPSTREAM_SEMI = "^SOX";

type ReturnPoint = { date: string; r: number };

function dailyReturns(bars: { date: string; close: number }[]): ReturnPoint[] {
  const out: ReturnPoint[] = [];
  for (let i = 1; i < bars.length; i++) {
    const p0 = bars[i - 1]!.close;
    const p1 = bars[i]!.close;
    if (!Number.isFinite(p0) || !Number.isFinite(p1) || p0 <= 0 || p1 <= 0) continue;
    out.push({ date: bars[i]!.date, r: p1 / p0 - 1 });
  }
  return out;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 10) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i]!;
    const y = ys[i]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    sx += x;
    sy += y;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const denom = Math.sqrt(sxx) * Math.sqrt(syy);
  if (!Number.isFinite(denom) || denom <= 0) return null;
  return sxy / denom;
}

async function buildLens(lookbackDays = 90) {
  const [soxBars, ...basketBars] = await Promise.all([
    fetchPriceHistory(UPSTREAM_SEMI, lookbackDays, UPSTREAM_SEMI),
    ...SAAS_BASKET.map((t) => fetchPriceHistory(t, lookbackDays, null)),
  ]);

  const sox = soxBars
    .filter((b) => Number.isFinite(b.close) && b.close > 0)
    .map((b) => ({ date: b.date, close: b.close }));

  const byTicker = basketBars.map(
    (bars) =>
      new Map(
        bars
          .filter((b) => Number.isFinite(b.close) && b.close > 0)
          .map((b) => [b.date, b.close]),
      ),
  );

  const dateSet = new Set<string>();
  for (const m of byTicker) for (const d of m.keys()) dateSet.add(d);
  const dates = [...dateSet].sort();

  const basket: { date: string; close: number }[] = [];
  for (const d of dates) {
    let sum = 0;
    let n = 0;
    for (const m of byTicker) {
      const c = m.get(d);
      if (c == null) continue;
      sum += c;
      n += 1;
    }
    if (n >= Math.max(3, Math.ceil(SAAS_BASKET.length * 0.6))) {
      basket.push({ date: d, close: sum / n });
    }
  }

  const soxR = dailyReturns(sox);
  const saasR = dailyReturns(basket);
  const soxByDate = new Map(soxR.map((p) => [p.date, p.r]));
  const saasByDate = new Map(saasR.map((p) => [p.date, p.r]));
  const shared = [...new Set(soxR.map((p) => p.date).filter((d) => saasByDate.has(d)))].sort();

  const xs0: number[] = [];
  const ys0: number[] = [];
  for (const d of shared) {
    const x = soxByDate.get(d);
    const y = saasByDate.get(d);
    if (x == null || y == null) continue;
    xs0.push(x);
    ys0.push(y);
  }
  const corr0 = pearson(xs0, ys0);

  let bestLagDays = 0;
  let bestLagCorr = corr0;
  for (let lag = 1; lag <= 10; lag++) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < shared.length; i++) {
      const dUp = shared[i]!;
      const dSaas = shared[i + lag];
      if (!dSaas) break;
      const x = soxByDate.get(dUp);
      const y = saasByDate.get(dSaas);
      if (x == null || y == null) continue;
      xs.push(x);
      ys.push(y);
    }
    const c = pearson(xs, ys);
    if (c != null && (bestLagCorr == null || c > bestLagCorr)) {
      bestLagCorr = c;
      bestLagDays = lag;
    }
  }

  const soxCum = sox.length >= 2 ? sox[sox.length - 1]!.close / sox[0]!.close - 1 : null;
  const saasCum =
    basket.length >= 2 ? basket[basket.length - 1]!.close / basket[0]!.close - 1 : null;
  const reboundPotential = soxCum != null && saasCum != null ? soxCum - saasCum : null;

  return {
    asOf: new Date().toISOString(),
    lookbackDays,
    upstream: UPSTREAM_SEMI,
    basketTickers: [...SAAS_BASKET],
    corr0,
    bestLagDays,
    bestLagCorr,
    soxCumulativeReturn: soxCum,
    saasCumulativeReturn: saasCum,
    reboundPotential,
    dataOk: soxR.length >= 10 && saasR.length >= 10,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lookbackRaw = searchParams.get("lookbackDays");
    const lookbackDays = Math.max(30, Math.min(180, Math.floor(Number(lookbackRaw ?? 90) || 90)));
    const lens = await buildLens(lookbackDays);
    return NextResponse.json(lens);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

