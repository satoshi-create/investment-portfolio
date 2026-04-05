import React from "react";
import { LayoutGrid } from "lucide-react";

import type { CoreSatelliteBreakdown, StructureTagSlice } from "@/src/types/investment";
import { USD_JPY_RATE } from "@/src/lib/alpha-logic";
import { StatBox } from "@/src/components/dashboard/StatBox";

const TAG_BAR_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-cyan-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
];

type Props = {
  structureByTag: StructureTagSlice[];
  /** コメントアウト中の Core/Satellite カード用（将来復帰時に使用） */
  coreSatellite?: CoreSatelliteBreakdown;
  totalMarketValue: number;
};

export function StrategySection({ structureByTag, totalMarketValue }: Props) {
  const hasStructure = structureByTag.length > 0;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2 tracking-widest">
          <LayoutGrid size={14} /> Structure (primary tag)
        </h3>
        <p className="text-[10px] text-slate-600 mb-4 leading-relaxed">
          各銘柄の先頭タグで集計。積み上げバーは円換算後の評価額合計に対するシェアです。米国株（英字ティッカー）は
          1 USD = {USD_JPY_RATE} 円、数字のみの投信は円のまま。指数連動は DB の valuation_factor
          で評価額を合わせてください。
        </p>
        {hasStructure ? (
          <>
            <div className="h-5 w-full bg-slate-800 rounded-full overflow-hidden flex border border-slate-700">
              {structureByTag.map((slice, i) => (
                <div
                  key={slice.tag}
                  className={`h-full shrink-0 ${TAG_BAR_COLORS[i % TAG_BAR_COLORS.length]!} transition-all`}
                  style={{ width: `${slice.weightPercent}%` }}
                  title={`${slice.tag}: ${slice.weightPercent}%`}
                />
              ))}
            </div>
            <ul className="mt-4 space-y-2">
              {structureByTag.map((slice, i) => (
                <li
                  key={slice.tag}
                  className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tighter"
                >
                  <span
                    className={`flex items-center gap-2 ${
                      i === 0
                        ? "text-indigo-400"
                        : i === 1
                          ? "text-emerald-400"
                          : i === 2
                            ? "text-cyan-400"
                            : "text-slate-400"
                    }`}
                  >
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${TAG_BAR_COLORS[i % TAG_BAR_COLORS.length]}`}
                    />
                    {slice.tag}
                  </span>
                  <span className="text-slate-300 font-mono">{slice.weightPercent}%</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xs text-slate-600">評価額データが無いか、タグが未設定です。</p>
        )}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <StatBox
            label="Σ Market value (JPY)"
            value={
              totalMarketValue > 0
                ? `¥${totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : "—"
            }
            subLabel={`米株は USD×${USD_JPY_RATE}。指数は valuation_factor で調整`}
          />
        </div>
      </div>

      {/*
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl md:col-span-2 shadow-xl">
        <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2 tracking-widest">
          <Scale size={14} /> Core / Satellite vs 9:1
        </h3>
        <p className="text-[10px] text-slate-600 mb-4">
          目標: コア {coreSatellite.targetCorePercent}% / サテライト {100 - coreSatellite.targetCorePercent}
          %。比率は円換算後の評価額合計（米株 × {USD_JPY_RATE}）。
        </p>
        <div className="h-6 w-full bg-slate-800 rounded-full overflow-hidden flex border border-slate-700 mb-2">
          <div
            className="h-full bg-sky-500 transition-all flex items-center justify-center"
            style={{ width: `${coreW}%` }}
          />
          <div
            className="h-full bg-orange-500/90 transition-all flex items-center justify-center"
            style={{ width: `${satW}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px] font-bold uppercase tracking-tighter mb-6">
          <span className="text-sky-400">● Core {coreSatellite.coreWeightPercent}%</span>
          <span className="text-orange-400">● Satellite {coreSatellite.satelliteWeightPercent}%</span>
        </div>
        <div className="flex flex-wrap gap-8 items-start border-t border-slate-800 pt-4">
          <StatBox
            label="Core gap vs target"
            value={`${coreSatellite.coreGapVsTarget > 0 ? "+" : ""}${coreSatellite.coreGapVsTarget} pp`}
            subLabel={
              coreSatellite.coreGapVsTarget >= 0
                ? "コア比率は目標以上"
                : "コア比率が目標を下回っています"
            }
            valueColor={coreSatellite.coreGapVsTarget >= 0 ? "text-emerald-400" : "text-amber-400"}
          />
          <StatBox
            label="Σ Market value (JPY)"
            value={
              totalMarketValue > 0
                ? `¥${totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : "—"
            }
            subLabel={`米株は USD×${USD_JPY_RATE}。指数は valuation_factor で調整`}
          />
        </div>
      </div>
      */}
    </div>
  );
}
