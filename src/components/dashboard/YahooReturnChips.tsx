"use client";

import type { YahooBuybackPosture } from "@/src/types/investment";
import {
  buybackChipShortLabel,
  hasBuybackChipData,
  yahooBuybackResearchTooltip,
} from "@/src/lib/yahoo-buyback-posture";

type Props = {
  consecutiveDividendYears: number | null;
  ttmRepurchaseOfStock: number | null;
  yahooBuybackPosture: YahooBuybackPosture | null;
  className?: string;
};

const DIVIDEND_STREAK_TITLE =
  "Yahoo 配当履歴（historical）から推定した暦年ベースの連続年。履歴が無い場合は quoteSummary の配当指標から最低1年のヒントになり得ます。";

/**
 * 配当連続年数・自社株買い TTM のチップ（保有 Research / エコ Research で共通）。
 */
export function YahooReturnChips({ consecutiveDividendYears, ttmRepurchaseOfStock, yahooBuybackPosture, className }: Props) {
  const showDiv = consecutiveDividendYears != null && consecutiveDividendYears > 0;
  const showBb = hasBuybackChipData(ttmRepurchaseOfStock, yahooBuybackPosture);
  if (!showDiv && !showBb) return null;
  return (
    <div className={className ?? "flex flex-wrap gap-1.5 pt-1"}>
      {showDiv ? (
        <span
          className="text-[9px] font-mono text-cyan-200/90 border border-cyan-500/30 rounded px-1.5 py-0.5"
          title={DIVIDEND_STREAK_TITLE}
        >
          配当 {consecutiveDividendYears} 年
        </span>
      ) : null}
      {showBb ? (
        <span
          className="text-[9px] font-mono text-amber-200/90 border border-amber-500/30 rounded px-1.5 py-0.5"
          title={yahooBuybackResearchTooltip({ ttmRepurchaseOfStock, yahooBuybackPosture })}
        >
          自社株買い {buybackChipShortLabel(ttmRepurchaseOfStock, yahooBuybackPosture)}
        </span>
      ) : null}
    </div>
  );
}
