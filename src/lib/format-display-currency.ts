import type { ViewCurrency } from "@/src/lib/fx-constants";

/**
 * Native quote for a row: 米株 = USD, 日本 = JPY.
 */
export function nativeCurrencyForStock(stock: { instrumentKind: string }): "USD" | "JPY" {
  return stock.instrumentKind === "US_EQUITY" ? "USD" : "JPY";
}

function usdFmt(v: number, maxFractionDigits: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: maxFractionDigits,
  }).format(v);
}

function jpyFmtInt(v: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(v);
}

/**
 * Formats a **denomination in JPY** (e.g. portfolio `marketValue`) for the user’s view.
 */
export function formatJpyValueForView(
  valueJpy: number,
  view: ViewCurrency,
  convert: (amount: number, from: "USD" | "JPY", to: "USD" | "JPY") => number,
): string {
  if (!Number.isFinite(valueJpy)) return "—";
  if (view === "JPY") return jpyFmtInt(valueJpy);
  const usd = convert(valueJpy, "JPY", "USD");
  return usdFmt(usd, usd < 1000 ? 2 : 0);
}

/**
 * Interprets `localPrice` in `nativeCcy` and formats in `view` (e.g. 米株の $ → 円表示で JPY 建て).
 */
export function formatLocalPriceForView(
  localPrice: number,
  nativeCcy: "USD" | "JPY",
  view: ViewCurrency,
  convert: (amount: number, from: "USD" | "JPY", to: "USD" | "JPY") => number,
): string {
  if (!Number.isFinite(localPrice) || localPrice <= 0) return "—";
  if (nativeCcy === view) {
    if (view === "USD") return usdFmt(localPrice, localPrice < 500 ? 2 : 2);
    return localPrice < 1000 ? `¥${localPrice.toFixed(2)}` : jpyFmtInt(Math.round(localPrice));
  }
  const target = convert(localPrice, nativeCcy, view);
  if (view === "USD") return usdFmt(target, target < 500 ? 2 : 2);
  return jpyFmtInt(Math.round(target));
}

/**
 * Formats a **signed** amount in native quote currency (or converted to `view`).
 * For net cash, P−NCPS, etc. Zero is shown as 0 (not "—").
 */
export function formatSignedLocalMoneyForView(
  localAmount: number,
  nativeCcy: "USD" | "JPY",
  view: ViewCurrency,
  convert: (amount: number, from: "USD" | "JPY", to: "USD" | "JPY") => number,
): string {
  if (!Number.isFinite(localAmount)) return "—";
  const display =
    nativeCcy === view ? localAmount : convert(localAmount, nativeCcy, view);
  if (!Number.isFinite(display)) return "—";
  if (view === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: display < 1000 && display > -1000 ? 2 : 0,
      signDisplay: "exceptZero",
    }).format(display);
  }
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
    signDisplay: "exceptZero",
  }).format(Math.round(display));
}

/** Per-share amounts in native currency (signed). */
export function formatSignedLocalPerShareForView(
  localPerShare: number,
  nativeCcy: "USD" | "JPY",
  view: ViewCurrency,
  convert: (amount: number, from: "USD" | "JPY", to: "USD" | "JPY") => number,
): string {
  if (!Number.isFinite(localPerShare)) return "—";
  const display =
    nativeCcy === view ? localPerShare : convert(localPerShare, nativeCcy, view);
  if (!Number.isFinite(display)) return "—";
  if (view === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
      signDisplay: "exceptZero",
    }).format(display);
  }
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
    signDisplay: "exceptZero",
  }).format(Math.round(display));
}
