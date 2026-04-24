"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { TooltipProvider } from "@/src/components/ui/tooltip";
import { USD_JPY_RATE_FALLBACK, type ViewCurrency } from "@/src/lib/fx-constants";

export type { ViewCurrency };

export type AlphaDisplayMode = "standard" | "fxNeutral";

type PortfolioCurrencyContextValue = {
  viewCurrency: ViewCurrency;
  setViewCurrency: Dispatch<SetStateAction<ViewCurrency>>;
  fxRate: number;
  setFxRateFromQuote: (rate: number | null | undefined) => void;
  alphaDisplayMode: AlphaDisplayMode;
  setAlphaDisplayMode: Dispatch<SetStateAction<AlphaDisplayMode>>;
};

const PortfolioCurrencyContext = createContext<PortfolioCurrencyContextValue | null>(null);

export function usePortfolioCurrency(): PortfolioCurrencyContextValue {
  const ctx = useContext(PortfolioCurrencyContext);
  if (!ctx) {
    throw new Error("usePortfolioCurrency must be used within ThemeProvider");
  }
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [viewCurrency, setViewCurrency] = useState<ViewCurrency>("USD");
  const [fxRate, setFxRate] = useState<number>(USD_JPY_RATE_FALLBACK);
  const [alphaDisplayMode, setAlphaDisplayMode] = useState<AlphaDisplayMode>("standard");

  const setFxRateFromQuote = useCallback((rate: number | null | undefined) => {
    if (rate != null && Number.isFinite(rate) && rate > 0) setFxRate(rate);
  }, []);

  const value = useMemo(
    () => ({
      viewCurrency,
      setViewCurrency,
      fxRate,
      setFxRateFromQuote,
      alphaDisplayMode,
      setAlphaDisplayMode,
    }),
    [viewCurrency, fxRate, alphaDisplayMode, setFxRateFromQuote],
  );

  return (
    <PortfolioCurrencyContext.Provider value={value}>
      <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="theme">
        <TooltipProvider delayDuration={250}>
          {children}
        </TooltipProvider>
      </NextThemesProvider>
    </PortfolioCurrencyContext.Provider>
  );
}
