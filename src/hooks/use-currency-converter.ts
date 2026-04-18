"use client";

import { useCallback } from "react";

import { usePortfolioCurrency } from "@/src/components/ThemeProvider";

export type Currency = "USD" | "JPY";

/**
 * USD/JPY cross only. `amount` is in `from`; result is in `to`.
 */
export function useCurrencyConverter() {
  const {
    fxRate,
    viewCurrency,
    setViewCurrency,
    setFxRateFromQuote,
    alphaDisplayMode,
    setAlphaDisplayMode,
  } = usePortfolioCurrency();

  const convert = useCallback(
    (amount: number, from: Currency, to: Currency): number => {
      if (from === to) return amount;
      if (!Number.isFinite(amount)) return amount;
      if (!Number.isFinite(fxRate) || fxRate <= 0) return amount;
      if (from === "USD" && to === "JPY") return amount * fxRate;
      if (from === "JPY" && to === "USD") return amount / fxRate;
      return amount;
    },
    [fxRate],
  );

  return {
    convert,
    fxRate,
    viewCurrency,
    setViewCurrency,
    setFxRateFromQuote,
    alphaDisplayMode,
    setAlphaDisplayMode,
  };
}
