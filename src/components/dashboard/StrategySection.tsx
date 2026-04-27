"use client";

import React, { useMemo } from "react";
import { GitBranch, Radar } from "lucide-react";

import type { Stock, StructureTagSlice } from "@/src/types/investment";
import { roundAlphaMetric } from "@/src/lib/alpha-logic";
import { USD_JPY_RATE_FALLBACK } from "@/src/lib/fx-constants";
import { StatBox } from "@/src/components/dashboard/StatBox";
import { LynchAllocationPiePanel } from "@/src/components/dashboard/LynchAllocationPiePanel";
import { useCurrencyConverter } from "@/src/hooks/use-currency-converter";
import { formatJpyValueForView } from "@/src/lib/format-display-currency";

const SATELLITE_TARGET_MIN = 6;
const SATELLITE_TARGET_MAX = 10;

type SectorPole = "tech_growth" | "energy_cyclical" | "defensive" | "other";

/** バー左→右: テック／成長 → その他 → ディフェンシブ → エネルギー／シクリカル（相反が目で追いやすい順） */
function sectorPole(tag: string): SectorPole {
  const u = tag.toLowerCase();
  if (
    /ソフト|software|fang|グロース|growth|ev|半導体|semi|chip|ai|cloud|saas|tech|ネット|digital/i.test(tag) ||
    /software|fang|growth|semi|cloud|saas|tech|digital|chip|nvidia/i.test(u)
  ) {
    return "tech_growth";
  }
  if (
    /エネルギー|エネルギ|energy|再エネ|renew|鉱|素材|material|industrial|銀行|金融(?!テック)/i.test(tag) ||
    /energy|renew|material|mining|oil|gas/i.test(u)
  ) {
    return "energy_cyclical";
  }
  if (
    /実体|小売|retail|消費|staple|ヘルス|health|医薬|pharma|utility|配当|dividend|インフラ|コア/i.test(tag) ||
    /retail|staple|health|pharma|utility|dividend/i.test(u)
  ) {
    return "defensive";
  }
  return "other";
}

const POLE_SORT: Record<SectorPole, number> = {
  tech_growth: 0,
  other: 1,
  defensive: 2,
  energy_cyclical: 3,
};

function poleHintJa(pole: SectorPole): string {
  switch (pole) {
    case "tech_growth":
      return "成長・テック寄り";
    case "energy_cyclical":
      return "エネルギー・シクリカル寄り";
    case "defensive":
      return "ディフェンシブ寄り";
    default:
      return "中立／その他";
  }
}

function sortSectorsForBalanceBar(slices: StructureTagSlice[]): StructureTagSlice[] {
  return [...slices].sort((a, b) => {
    const pa = sectorPole(a.tag);
    const pb = sectorPole(b.tag);
    const oa = POLE_SORT[pa];
    const ob = POLE_SORT[pb];
    if (oa !== ob) return oa - ob;
    return b.marketValue - a.marketValue;
  });
}

/** POLE_SORT 順に並べた配列の前半を Growth、後半を Cyclical として合算シェア % を返す */
function growthCyclicalFromSortedSectors(sorted: StructureTagSlice[]): {
  growthSlices: StructureTagSlice[];
  cyclicalSlices: StructureTagSlice[];
  growthPct: number;
  cyclicalPct: number;
} {
  const n = sorted.length;
  if (n === 0) {
    return { growthSlices: [], cyclicalSlices: [], growthPct: 0, cyclicalPct: 0 };
  }
  if (n === 1) {
    const g = sorted[0]!.weightPercent;
    return { growthSlices: sorted, cyclicalSlices: [], growthPct: g, cyclicalPct: 0 };
  }
  const mid = Math.floor(n / 2);
  const growthSlices = sorted.slice(0, mid);
  const cyclicalSlices = sorted.slice(mid);
  const growthPct = growthSlices.reduce((s, x) => s + x.weightPercent, 0);
  const cyclicalPct = cyclicalSlices.reduce((s, x) => s + x.weightPercent, 0);
  return { growthSlices, cyclicalSlices, growthPct, cyclicalPct };
}

type GrowthCyclicalBalance = "balanced" | "leaning_growth" | "leaning_cyclical";

function growthCyclicalBalanceStatus(growthPct: number): GrowthCyclicalBalance {
  if (growthPct >= 55 && growthPct <= 65) return "balanced";
  if (growthPct > 65) return "leaning_growth";
  return "leaning_cyclical";
}

function balanceBadgePresentation(status: GrowthCyclicalBalance): { label: string; className: string } {
  switch (status) {
    case "balanced":
      return {
        label: "Balanced",
        className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
      };
    case "leaning_growth":
      return {
        label: "Leaning Growth",
        className: "border-sky-500/40 bg-sky-500/10 text-sky-300",
      };
    default:
      return {
        label: "Leaning Cyclical",
        className: "border-amber-500/45 bg-amber-500/10 text-amber-200",
      };
  }
}

/** バー左（Growth）→右（Cyclical）へ連続的な色相（青系→オレンジ・赤系） */
function sectorHeatColor(index: number, total: number): string {
  if (total <= 1) return "hsl(205 85% 48%)";
  const t = index / (total - 1);
  const h = 205 - t * 168;
  const s = 72 + t * 18;
  const l = 50 - t * 12;
  return `hsl(${h} ${s}% ${l}%)`;
}

function signedValueJpyInView(
  valueJpy: number,
  view: "USD" | "JPY",
  convert: (amount: number, from: "USD" | "JPY", to: "USD" | "JPY") => number,
): string {
  if (!Number.isFinite(valueJpy)) return "—";
  const core = formatJpyValueForView(Math.abs(valueJpy), view, convert);
  if (valueJpy > 0) return `+${core}`;
  if (valueJpy < 0) return `−${core}`;
  return core;
}

function profitColor(value: number): string {
  if (!Number.isFinite(value)) return "text-muted-foreground";
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function satelliteGaugeClass(count: number): string {
  if (count >= SATELLITE_TARGET_MIN && count <= SATELLITE_TARGET_MAX) {
    return "border-emerald-500/50 bg-emerald-500/5";
  }
  if (count < SATELLITE_TARGET_MIN) {
    return "border-amber-500/50 bg-amber-500/5";
  }
  return "border-rose-500/40 bg-rose-500/5";
}

type Props = {
  structureBySector: StructureTagSlice[];
  /** リンチ構成（評価額ウェイト）。省略時は円グラフを出さない。 */
  stocks?: Stock[];
  /** Satellite かつ評価額 > 0 の銘柄数（個別株モニタ用） */
  satelliteStockCount: number;
  totalMarketValue: number;
  totalProfitJpy: number;
  /** 保有の含み損益合計（円）。`totalProfitJpy` − 確定損益 に一致 */
  totalUnrealizedPnlJpy: number;
  totalReturnPct: number;
  totalCostBasisJpy: number;
  /** `JPY=X` 取得値。失敗時はダッシュボード計算と同様にフォールバック表示。 */
  fxUsdJpy: number | null;
};

export function StrategySection({
  structureBySector,
  stocks = [],
  satelliteStockCount,
  totalMarketValue,
  totalProfitJpy,
  totalUnrealizedPnlJpy,
  totalReturnPct,
  totalCostBasisJpy,
  fxUsdJpy,
}: Props) {
  const { convert, viewCurrency } = useCurrencyConverter();
  const hasSectors = structureBySector.length > 0;
  const sortedSectors = useMemo(() => sortSectorsForBalanceBar(structureBySector), [structureBySector]);
  const gcBalance = useMemo(() => growthCyclicalFromSortedSectors(sortedSectors), [sortedSectors]);
  const gcStatus = useMemo(() => growthCyclicalBalanceStatus(gcBalance.growthPct), [gcBalance.growthPct]);
  const gcBadge = useMemo(() => balanceBadgePresentation(gcStatus), [gcStatus]);
  const gRound = Math.round(gcBalance.growthPct);
  const cRound = Math.round(gcBalance.cyclicalPct);
  const fxDisplay =
    fxUsdJpy != null && Number.isFinite(fxUsdJpy) && fxUsdJpy > 0 ? fxUsdJpy : USD_JPY_RATE_FALLBACK;
  const fxNote =
    fxUsdJpy != null && Number.isFinite(fxUsdJpy) && fxUsdJpy > 0 ? "JPY=X" : `フォールバック ${USD_JPY_RATE_FALLBACK}`;

  const unrealizedReturnPct =
    totalCostBasisJpy > 0 && Number.isFinite(totalUnrealizedPnlJpy)
      ? roundAlphaMetric((totalUnrealizedPnlJpy / totalCostBasisJpy) * 100)
      : null;

  const yahooReturnHeadline = useMemo(() => {
    if (stocks.length === 0) return null;
    let divStreak = 0;
    let buybackTtm = 0;
    for (const s of stocks) {
      if (s.consecutiveDividendYears != null && s.consecutiveDividendYears > 0) divStreak += 1;
      if (s.ttmRepurchaseOfStock != null && Number.isFinite(s.ttmRepurchaseOfStock) && s.ttmRepurchaseOfStock > 0) {
        buybackTtm += 1;
      }
    }
    return { divStreak, buybackTtm, total: stocks.length };
  }, [stocks]);

  return (
    <div className="space-y-4">
      {/* Satellite 個別株モニター */}
      <div
        className={`rounded-2xl border px-4 py-3 md:px-5 md:py-3.5 ${satelliteGaugeClass(satelliteStockCount)}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Satellite 個別株（監視レンジ）
            </p>
            <p className="text-sm font-bold text-foreground mt-0.5">
              <span className="font-mono text-lg text-white">{satelliteStockCount}</span>
              <span className="text-muted-foreground font-normal text-xs">
                {" "}
                銘柄 / 目安 {SATELLITE_TARGET_MIN}〜{SATELLITE_TARGET_MAX}
              </span>
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground max-w-md leading-relaxed">
            {satelliteStockCount < SATELLITE_TARGET_MIN && "目安未満: サテライトの分散やテーマ補完の余地があります。"}
            {satelliteStockCount > SATELLITE_TARGET_MAX && "目安超過: 個別株の追跡負荷・集中度に注意。"}
            {satelliteStockCount >= SATELLITE_TARGET_MIN &&
              satelliteStockCount <= SATELLITE_TARGET_MAX &&
              "レンジ内: 個別株の枚数監視としては適正ゾーンです（内容の質は別途確認）。"}
          </p>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden flex border border-border">
          {Array.from({ length: 12 }).map((_, i) => {
            const n = i + 1;
            const inTarget = n >= SATELLITE_TARGET_MIN && n <= SATELLITE_TARGET_MAX;
            const filled = n <= satelliteStockCount;
            return (
              <div
                key={n}
                className={`h-full flex-1 border-r border-border/60 last:border-r-0 ${
                  filled
                    ? inTarget
                      ? "bg-emerald-500/90"
                      : "bg-muted-foreground/60"
                    : inTarget
                      ? "bg-emerald-950/80"
                      : "bg-card/90"
                }`}
                title={`${n} 銘柄`}
              />
            );
          })}
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5 font-mono">
          12 スロットのうち塗りつぶし数 = 評価額のある Satellite 銘柄数。中央の緑帯は目安 {SATELLITE_TARGET_MIN}〜
          {SATELLITE_TARGET_MAX} 銘柄ゾーン。
        </p>
      </div>

      {yahooReturnHeadline != null ? (
        <div className="rounded-2xl border border-border bg-card/70 px-4 py-3 md:px-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Yahoo 還元スナップショット（保有）</p>
          <p className="mt-1.5 text-xs text-foreground/90 font-mono tabular-nums">
            配当連続（推定）あり:{" "}
            <span className="font-bold text-cyan-300/95">
              {yahooReturnHeadline.divStreak}/{yahooReturnHeadline.total}
            </span>
            <span className="text-muted-foreground mx-2">·</span>
            自社株買い TTM 計上あり:{" "}
            <span className="font-bold text-amber-300/95">
              {yahooReturnHeadline.buybackTtm}/{yahooReturnHeadline.total}
            </span>
          </p>
          <p className="text-[9px] text-muted-foreground mt-1 leading-relaxed">
            銘柄別の年数・CF 期別・3y/5y 合計は下の保有テーブル「Research」列のバッジ（ホバーでツールチップ）を参照。
          </p>
        </div>
      ) : null}

      <div className="bg-card border border-border p-6 rounded-2xl shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2 tracking-widest">
              <Radar size={14} /> Sector Balance
            </h3>
            {hasSectors ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${gcBadge.className}`}
                >
                  {gcBadge.label}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  Current {gRound} : {cRound}
                  <span className="text-muted-foreground/80 font-sans font-normal normal-case ml-1">(Growth : Cyclical)</span>
                </span>
              </div>
            ) : null}
          </div>
          <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
            セクター（DB の sector 優先・なければタグ 2 番目）別シェア。バー左→右は POLE_SORT 順（
            <span className="text-sky-400/90">Growth 側</span>
            {" → "}
            <span className="text-orange-400/90">Cyclical 側</span>
            ）。左半分スライスの合計を Growth、右半分を Cyclical として 6:4 ターゲット（Growth 60%）と比較します。
          </p>
          <div className="lg:grid lg:grid-cols-[1fr_min(100%,280px)] lg:gap-8 lg:items-start">
            <div>
              <div className="flex items-center gap-2 mb-2 text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">
                <GitBranch size={12} className="text-sky-500/90 shrink-0" />
                <span className="text-sky-400/80">Growth</span>
                <span className="flex-1 border-t border-dashed border-border" />
                <span className="text-orange-400/80">Cyclical</span>
              </div>
              {hasSectors ? (
                <>
                  <div className="relative pt-5">
                    <span
                      className="pointer-events-none absolute left-[60%] top-0 z-30 -translate-x-1/2 text-[8px] font-bold uppercase tracking-widest text-amber-300/95 whitespace-nowrap"
                      aria-hidden
                    >
                      Target 6:4
                    </span>
                    <div className="relative h-5 w-full rounded-full overflow-hidden flex border border-border bg-muted">
                      {sortedSectors.map((slice, segIndex) => {
                        const pole = sectorPole(slice.tag);
                        const heat = sectorHeatColor(segIndex, sortedSectors.length);
                        return (
                          <div
                            key={slice.tag}
                            className="h-full shrink-0 transition-all"
                            style={{
                              width: `${slice.weightPercent}%`,
                              backgroundColor: heat,
                            }}
                            title={`${slice.tag}: ${slice.weightPercent}% · ${slice.count} 銘柄 · ${poleHintJa(pole)}`}
                          />
                        );
                      })}
                      <div
                        className="pointer-events-none absolute inset-y-0 left-[60%] z-20 w-px -translate-x-1/2 bg-amber-400/95 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                        aria-hidden
                      />
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {sortedSectors.map((slice, segIndex) => {
                      const pole = sectorPole(slice.tag);
                      const heat = sectorHeatColor(segIndex, sortedSectors.length);
                      const halfLabel =
                        segIndex < Math.floor(sortedSectors.length / 2) || sortedSectors.length === 1
                          ? "Growth 側"
                          : "Cyclical 側";
                      return (
                        <li
                          key={slice.tag}
                          className="flex justify-between items-start gap-2 text-[10px] font-bold uppercase tracking-tighter"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-2 w-2 shrink-0 rounded-full border border-white/10"
                                style={{ backgroundColor: heat }}
                              />
                              <span className="text-foreground/85 truncate">{slice.tag}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground font-normal normal-case mt-0.5 pl-4">
                              {poleHintJa(pole)} · {halfLabel}
                            </p>
                          </div>
                          <span className="text-foreground/85 font-mono shrink-0 text-right">
                            <span className="text-muted-foreground font-normal normal-case mr-2">{slice.count} 銘柄</span>
                            {slice.weightPercent}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">セクターデータがありません。</p>
              )}
            </div>

            <div className="mt-8 lg:mt-0 border-t border-border pt-6 lg:border-t-0 lg:border-l lg:border-border lg:pt-0 lg:pl-8">
              <LynchAllocationPiePanel stocks={stocks} bare />
            </div>
          </div>
      </div>

      <div className="bg-card border border-border p-6 rounded-2xl shadow-xl">
        <div className="flex flex-row flex-wrap justify-start items-end gap-x-8 gap-y-5">
          <StatBox
            label="Total profit"
            value={signedValueJpyInView(totalProfitJpy, viewCurrency, convert)}
            valueColor={profitColor(totalProfitJpy)}
            subLabel={
              Number.isFinite(totalReturnPct)
                ? `${totalReturnPct > 0 ? "+" : ""}${totalReturnPct.toFixed(2)}% total return`
                : "—"
            }
          />
          <StatBox
            label="含み損益"
            value={signedValueJpyInView(totalUnrealizedPnlJpy, viewCurrency, convert)}
            valueColor={profitColor(totalUnrealizedPnlJpy)}
            subLabel={
              unrealizedReturnPct != null && Number.isFinite(unrealizedReturnPct)
                ? `${unrealizedReturnPct > 0 ? "+" : ""}${unrealizedReturnPct.toFixed(2)}% vs cost basis`
                : "現在保有の評価 − 取得コスト（円換算）"
            }
          />
          <StatBox
            label="Cost basis"
            value={
              Number.isFinite(totalCostBasisJpy) && totalCostBasisJpy >= 0
                ? formatJpyValueForView(totalCostBasisJpy, viewCurrency, convert)
                : "—"
            }
            valueColor="text-foreground"
            subLabel="Total invested (holdings)"
          />
          <StatBox
            label={`Σ Market value (${viewCurrency})`}
            value={
              totalMarketValue > 0
                ? formatJpyValueForView(totalMarketValue, viewCurrency, convert)
                : "—"
            }
            subLabel={`米株は USD×${fxDisplay.toFixed(2)}（${fxNote}）。指数は valuation_factor で調整 · 表示 ${viewCurrency}`}
          />
        </div>
      </div>
    </div>
  );
}
