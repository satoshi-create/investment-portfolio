import { useMemo } from "react";

import { computeAlphaDeviationZScore } from "@/src/lib/alpha-logic";
import {
  SIGNAL_SIGMA_PHASE_TRANSITION,
  SIGNAL_SIGMA_STRUCTURAL_STRAIN,
} from "@/src/lib/signal-constants";
import type { LiveSignalType, Signal, Stock } from "@/src/types/investment";

export function useAlphaSignals(stocks: Stock[]): Signal[] {
  return useMemo(() => {
    return stocks
      .map((stock) => {
        const history = stock.alphaHistory;
        const currentAlpha = history[history.length - 1];
        const prevAlpha = history[history.length - 2];

        const lastThree = history.slice(-3);
        const trendWarn = lastThree.length >= 3 && lastThree.every((a) => a < 0);
        const z = computeAlphaDeviationZScore(history);

        const isBuy =
          prevAlpha !== undefined &&
          currentAlpha !== undefined &&
          prevAlpha < 0 &&
          currentAlpha > 0;

        let signalType: LiveSignalType | null = null;
        if (isBuy) {
          signalType = "BUY";
        } else if (z !== null && z < SIGNAL_SIGMA_PHASE_TRANSITION) {
          signalType = "CRITICAL";
        } else if (z !== null && z < SIGNAL_SIGMA_STRUCTURAL_STRAIN) {
          signalType = "BREAK";
        } else if (trendWarn) {
          signalType = "WARN";
        }

        if (signalType === null) return null;

        return {
          ...stock,
          signalType,
          isWarning: signalType !== "BUY",
          isBuy: signalType === "BUY",
          currentAlpha: currentAlpha ?? 0,
          detectedAt: "",
        };
      })
      .filter((s): s is Signal => s != null);
  }, [stocks]);
}
