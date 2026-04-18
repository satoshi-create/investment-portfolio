/**
 * FX-related constants with **no** Node/Yahoo dependencies.
 * Safe to import from Client Components (`"use client"`).
 */
export const USD_JPY_RATE_FALLBACK = 150;

/** Dashboard / theme display lens for nominal amounts (α % は無次元のためそのまま). */
export type ViewCurrency = "USD" | "JPY";
