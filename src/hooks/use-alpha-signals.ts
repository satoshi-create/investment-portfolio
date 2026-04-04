import { useMemo } from "react";

import type { Signal, Stock } from "@/src/types/investment";

export function useAlphaSignals(stocks: Stock[]): Signal[] {
  return useMemo(() => {
    return stocks
      .map((stock) => {
        const history = stock.alphaHistory;
        const currentAlpha = history[history.length - 1];
        const prevAlpha = history[history.length - 2];

        const lastThree = history.slice(-3);
        const isWarning = lastThree.length >= 3 && lastThree.every((a) => a < 0);
        const isBuy = prevAlpha < 0 && currentAlpha > 0;

        return {
          ...stock,
          isWarning,
          isBuy,
          currentAlpha: currentAlpha ?? 0,
        };
      })
      .filter((s) => s.isWarning || s.isBuy);
  }, [stocks]);
}
