import type { Client } from "@libsql/client";

import type { Holding } from "@/src/types/investment";

function holdingsMissingInvestmentMeta(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes("listing_date");
}

function holdingsMissingShortTermRulesColumns(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes("stop_loss_pct");
}

function holdingsMissingYahooResearchColumns(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes("ex_dividend_date");
}

function holdingsMissingColumn(e: unknown, column: string): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return lower.includes("no such column") && lower.includes(column.toLowerCase());
}

function parseOptionalIsoDatePrefix(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length >= 10 ? s.slice(0, 10) : null;
}

function parseOptionalFiniteNumberMeta(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 損切・利確など正の % のみ採用（0 以下・非有限は null） */
function parseOptionalPositivePercentRule(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseBookmarkFlag(raw: unknown): boolean {
  return raw != null && String(raw).trim() !== "" ? Number(raw) === 1 : false;
}

function mapHoldingsRow(
  row: Record<string, unknown>,
  shortTerm: { exitRuleEnabled: boolean; stopLossPct: number | null; targetProfitPct: number | null; tradeDeadline: string | null },
): Holding {
  return {
    id: String(row.id),
    ticker: String(row.ticker),
    providerSymbol:
      row.provider_symbol != null && String(row.provider_symbol).length > 0 ? String(row.provider_symbol) : null,
    avgAcquisitionPrice: parseOptionalFiniteNumberMeta(row.avg_acquisition_price),
    listingDate: parseOptionalIsoDatePrefix(
      row.listing_date ?? (row as Record<string, unknown>)["founded_date"],
    ),
    marketCap: parseOptionalFiniteNumberMeta(row.market_cap),
    listingPrice: parseOptionalFiniteNumberMeta(row.listing_price),
    nextEarningsDate: parseOptionalIsoDatePrefix(row.next_earnings_date),
    exDividendDate: parseOptionalIsoDatePrefix(row.ex_dividend_date),
    recordDate: parseOptionalIsoDatePrefix(row.record_date),
    annualDividendRate: parseOptionalFiniteNumberMeta(row.annual_dividend_rate),
    dividendYieldPercent: parseOptionalFiniteNumberMeta(row.dividend_yield_percent),
    yahooResearchSyncedAt:
      row.yahoo_research_synced_at != null && String(row.yahoo_research_synced_at).trim().length > 0
        ? String(row.yahoo_research_synced_at).trim()
        : null,
    institutionalOwnership: parseOptionalFiniteNumberMeta(row["institutional_ownership"]),
    memo: row.memo != null && String(row.memo).trim().length > 0 ? String(row.memo) : null,
    isBookmarked: parseBookmarkFlag(row.is_bookmarked),
    stopLossPct: shortTerm.stopLossPct,
    targetProfitPct: shortTerm.targetProfitPct,
    tradeDeadline: shortTerm.tradeDeadline,
    exitRuleEnabled: shortTerm.exitRuleEnabled,
  };
}

function shortTermFromRow(row: Record<string, unknown>) {
  return {
    exitRuleEnabled: row.exit_rule_enabled != null && Number(row.exit_rule_enabled) === 1,
    stopLossPct: parseOptionalPositivePercentRule(row.stop_loss_pct),
    targetProfitPct: parseOptionalPositivePercentRule(row.target_profit_pct),
    tradeDeadline: parseOptionalIsoDatePrefix(row.trade_deadline),
  };
}

/** Active holdings (`quantity > 0`) for `userId`, including `provider_symbol` (Yahoo / alpha sync). */
export async function fetchHoldingsWithProviderForUser(db: Client, userId: string): Promise<Holding[]> {
  const metaYahooNoInst = `, listing_date, market_cap, listing_price, next_earnings_date, ex_dividend_date, record_date, annual_dividend_rate, dividend_yield_percent, yahoo_research_synced_at, memo, is_bookmarked, instrument_meta_synced_at`;
  const metaYahoo = `${metaYahooNoInst}, institutional_ownership`;
  const metaLegacy = `, listing_date, market_cap, listing_price, next_earnings_date, memo, is_bookmarked, instrument_meta_synced_at`;
  const shortTerm = `, stop_loss_pct, target_profit_pct, trade_deadline, exit_rule_enabled`;
  const from = ` FROM holdings WHERE user_id = ? AND quantity > 0 ORDER BY ticker`;
  const args = [userId];
  const run = (meta: string, st: string) =>
    db.execute({
      sql: `SELECT id, ticker, provider_symbol, avg_acquisition_price${meta}${st}${from}`,
      args,
    });

  async function runWithInstitutionalFallback(st: string) {
    try {
      return await run(metaYahoo, st);
    } catch (e) {
      if (holdingsMissingColumn(e, "institutional_ownership")) {
        return await run(metaYahooNoInst, st);
      }
      throw e;
    }
  }

  try {
    const rs = await runWithInstitutionalFallback(shortTerm);
    return rs.rows.map((row) => mapHoldingsRow(row as Record<string, unknown>, shortTermFromRow(row as Record<string, unknown>)));
  } catch (e) {
    if (holdingsMissingYahooResearchColumns(e)) {
      try {
        const rs = await run(metaLegacy, shortTerm);
        return rs.rows.map((row) =>
          mapHoldingsRow(row as Record<string, unknown>, shortTermFromRow(row as Record<string, unknown>)),
        );
      } catch (e2) {
        if (!holdingsMissingShortTermRulesColumns(e2)) throw e2;
        const rs2 = await db.execute({
          sql: `SELECT id, ticker, provider_symbol, avg_acquisition_price${metaLegacy}${from}`,
          args,
        });
        return rs2.rows.map((row) =>
          mapHoldingsRow(row as Record<string, unknown>, {
            exitRuleEnabled: false,
            stopLossPct: null,
            targetProfitPct: null,
            tradeDeadline: null,
          }),
        );
      }
    }
    if (holdingsMissingShortTermRulesColumns(e)) {
      try {
        const rs = await runWithInstitutionalFallback("");
        return rs.rows.map((row) =>
          mapHoldingsRow(row as Record<string, unknown>, {
            exitRuleEnabled: false,
            stopLossPct: null,
            targetProfitPct: null,
            tradeDeadline: null,
          }),
        );
      } catch (e2) {
        if (!holdingsMissingYahooResearchColumns(e2)) throw e2;
        const rs2 = await db.execute({
          sql: `SELECT id, ticker, provider_symbol, avg_acquisition_price${metaLegacy}${from}`,
          args,
        });
        return rs2.rows.map((row) =>
          mapHoldingsRow(row as Record<string, unknown>, {
            exitRuleEnabled: false,
            stopLossPct: null,
            targetProfitPct: null,
            tradeDeadline: null,
          }),
        );
      }
    }
    if (!holdingsMissingInvestmentMeta(e)) throw e;
    try {
      const rs = await db.execute({
        sql: `SELECT id, ticker, provider_symbol, avg_acquisition_price${shortTerm}${from}`,
        args,
      });
      return rs.rows.map((row) => mapHoldingsRow(row as Record<string, unknown>, shortTermFromRow(row as Record<string, unknown>)));
    } catch (e2) {
      if (!holdingsMissingShortTermRulesColumns(e2)) throw e2;
      const rs = await db.execute({
        sql: `SELECT id, ticker, provider_symbol, avg_acquisition_price${from}`,
        args,
      });
      return rs.rows.map((row) =>
        mapHoldingsRow(row as Record<string, unknown>, {
          exitRuleEnabled: false,
          stopLossPct: null,
          targetProfitPct: null,
          tradeDeadline: null,
        }),
      );
    }
  }
}
