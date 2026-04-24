/**
 * Regression: REGULAR + stale regularMarketTime but fresher postMarket* (Yahoo Overnight).
 * Run: npx tsx scripts/verify-pick-live-quote.ts
 */
import assert from "node:assert/strict";

import { pickLivePriceFromQuote } from "../src/lib/price-service";

const closeMs = Date.parse("2026-04-23T20:00:01.000Z");
const overnightMs = Date.parse("2026-04-24T07:38:32.000Z");

const intcStyle = {
  marketState: "REGULAR",
  regularMarketPreviousClose: 65.27,
  regularMarketPrice: 66.78,
  regularMarketChangePercent: 2.31,
  regularMarketTime: Math.floor(closeMs / 1000),
  postMarketPrice: 81.34,
  postMarketChangePercent: 21.8,
  postMarketTime: Math.floor(overnightMs / 1000),
} as Record<string, unknown>;

const r = pickLivePriceFromQuote(intcStyle);
assert.equal(r?.price, 81.34);
assert.equal(r?.changePct, 21.8);

const rth = {
  marketState: "REGULAR",
  regularMarketPreviousClose: 100,
  regularMarketPrice: 101,
  regularMarketChangePercent: 1,
  regularMarketTime: Math.floor(Date.now() / 1000),
  postMarketPrice: 99,
  postMarketChangePercent: -1,
  postMarketTime: Math.floor(Date.now() / 1000) - 3600,
} as Record<string, unknown>;
const r2 = pickLivePriceFromQuote(rth);
assert.equal(r2?.price, 101);

console.log("verify-pick-live-quote: OK");
