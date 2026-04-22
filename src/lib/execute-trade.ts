import type { Client, Transaction } from "@libsql/core/api";

import { classifyTickerInstrument } from "@/src/lib/alpha-logic";
import { USD_JPY_RATE_FALLBACK } from "@/src/lib/fx-constants";
import { fetchUsdJpyRate } from "@/src/lib/price-service";
import { parseExpectationCategory } from "@/src/lib/expectation-category";
import { structureTagsJsonFromThemeSector } from "@/src/lib/structure-tags";

export type ExecuteTradeParams = {
  userId: string;
  ticker: string;
  name: string;
  accountName: string;
  side: "BUY" | "SELL";
  quantity: number;
  /** 1 株（口）あたりの単価。米国株は USD、数字ティッカーは JPY。 */
  unitPriceLocal: number;
  /** 現地通貨建て手数料（米国株は USD、数字ティッカーは JPY） */
  feeLocal: number;
  /** `feeLocal` の通貨。米国株は USD、それ以外は JPY。 */
  feeCurrency: "JPY" | "USD";
  /** 円建て手数料 */
  feesJpy: number;
  /** YYYY-MM-DD */
  tradeDate: string;
  /** 新規 BUY で holdings を作るときのみ使用 */
  categoryForNewHolding: "Core" | "Satellite";
  /** `structure_tags` の [0]=テーマ、[1]=セクター として保存 */
  structureTheme: string;
  structureSector: string;
  /** `investment_themes.id`（任意・`trade_history.theme_id`） */
  themeId?: string | null;
  /** 取引理由・反省（任意・DB `trade_history.reason`） */
  reason?: string;
  /**
   * `holdings.expectation_category`。undefined のときは買い増しで既存値を維持、新規買いは NULL。
   * 空文字は NULL にクリア。
   */
  expectationCategory?: string;
  /** 短期売買ルール（BUY 時のみ DB に保存。省略時は新規 NULL/0・買い増しは既存維持） */
  shortTermExitRules?: ShortTermExitRulesInput;
};

export type ShortTermExitRulesInput = {
  stopLossPct: number | null;
  targetProfitPct: number | null;
  tradeDeadline: string | null;
  exitRuleEnabled: boolean;
};

export type ExecuteTradeResult =
  | { ok: true; holdingId: string; tradeId: string }
  | { ok: false; message: string };

function normalizeTicker(raw: string): string {
  const t = raw.trim();
  if (t.length === 0) return t;
  return classifyTickerInstrument(t) === "US_EQUITY" ? t.toUpperCase() : t;
}

function assertYmd(d: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error(`tradeDate は YYYY-MM-DD 形式にしてください: ${d}`);
  }
}

function isUsTicker(ticker: string): boolean {
  return classifyTickerInstrument(ticker) === "US_EQUITY";
}

/** 数量×単価（現地）を円換算したグロス（手数料前）。米株は `JPY=X` 取得レート（失敗時フォールバック）。 */
function grossJpy(qty: number, unitLocal: number, ticker: string, fxUsdJpy: number): number {
  const base = qty * unitLocal;
  if (!Number.isFinite(base) || base <= 0) return NaN;
  const fx = Number.isFinite(fxUsdJpy) && fxUsdJpy > 0 ? fxUsdJpy : USD_JPY_RATE_FALLBACK;
  return isUsTicker(ticker) ? Math.round(base * fx) : Math.round(base);
}

/** 売却数量ぶんの簿価（円） */
function costBasisJpySold(qtySold: number, avgLocal: number | null, ticker: string, fxUsdJpy: number): number {
  if (qtySold <= 0 || avgLocal == null || !Number.isFinite(avgLocal) || avgLocal <= 0) return 0;
  const base = qtySold * avgLocal;
  const fx = Number.isFinite(fxUsdJpy) && fxUsdJpy > 0 ? fxUsdJpy : USD_JPY_RATE_FALLBACK;
  return isUsTicker(ticker) ? Math.round(base * fx) : Math.round(base);
}

type HoldingRow = {
  id: string;
  quantity: number;
  avgAcquisitionPrice: number | null;
  name: string | null;
  accountType: string | null;
  expectationCategoryDb: string | null;
  stopLossPctDb: number | null;
  targetProfitPctDb: number | null;
  tradeDeadlineDb: string | null;
  exitRuleEnabledDb: number;
};

function normalizeExpectationCategoryInput(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  return parseExpectationCategory(t) != null ? t : null;
}

function normalizeOptionalPositivePctForDb(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

function normalizeTradeDeadlineForDb(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

async function selectHolding(tx: Transaction, userId: string, ticker: string): Promise<HoldingRow | null> {
  let rs;
  let hasShortTermColumns = true;
  try {
    rs = await tx.execute({
      sql: `SELECT id, quantity, avg_acquisition_price, name, account_type, expectation_category,
                   stop_loss_pct, target_profit_pct, trade_deadline, exit_rule_enabled
            FROM holdings WHERE user_id = ? AND ticker = ? LIMIT 1`,
      args: [userId, ticker],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("no such column") && msg.toLowerCase().includes("stop_loss_pct")) {
      hasShortTermColumns = false;
      rs = await tx.execute({
        sql: `SELECT id, quantity, avg_acquisition_price, name, account_type, expectation_category FROM holdings WHERE user_id = ? AND ticker = ? LIMIT 1`,
        args: [userId, ticker],
      });
    } else {
      throw e;
    }
  }
  if (rs.rows.length === 0) return null;
  const r = rs.rows[0]!;
  const expRaw = r.expectation_category != null ? String(r.expectation_category).trim() : "";
  const hasShortTerm = hasShortTermColumns;
  return {
    id: String(r.id),
    quantity: Number(r.quantity),
    avgAcquisitionPrice:
      r.avg_acquisition_price != null && Number.isFinite(Number(r.avg_acquisition_price))
        ? Number(r.avg_acquisition_price)
        : null,
    name: r.name != null ? String(r.name) : null,
    accountType: r.account_type != null ? String(r.account_type) : null,
    expectationCategoryDb: expRaw.length > 0 ? expRaw : null,
    stopLossPctDb:
      hasShortTerm && r.stop_loss_pct != null
        ? normalizeOptionalPositivePctForDb(Number(r.stop_loss_pct))
        : null,
    targetProfitPctDb:
      hasShortTerm && r.target_profit_pct != null
        ? normalizeOptionalPositivePctForDb(Number(r.target_profit_pct))
        : null,
    tradeDeadlineDb: hasShortTerm ? normalizeTradeDeadlineForDb(r.trade_deadline != null ? String(r.trade_deadline) : null) : null,
    exitRuleEnabledDb: hasShortTerm && r.exit_rule_enabled != null && Number(r.exit_rule_enabled) === 1 ? 1 : 0,
  };
}

const TRADE_REASON_MAX_LEN = 4000;

function normalizeTradeReason(raw: string | undefined): string | null {
  const t = (raw ?? "").trim().slice(0, TRADE_REASON_MAX_LEN);
  return t.length > 0 ? t : null;
}

function resolveShortTermExitForBuy(
  p: ExecuteTradeParams,
  existing: HoldingRow | null,
): { stopLossPct: number | null; targetProfitPct: number | null; tradeDeadline: string | null; exitRuleEnabled: number } {
  if (p.shortTermExitRules === undefined) {
    if (existing == null) {
      return { stopLossPct: null, targetProfitPct: null, tradeDeadline: null, exitRuleEnabled: 0 };
    }
    return {
      stopLossPct: existing.stopLossPctDb,
      targetProfitPct: existing.targetProfitPctDb,
      tradeDeadline: existing.tradeDeadlineDb,
      exitRuleEnabled: existing.exitRuleEnabledDb,
    };
  }
  const r = p.shortTermExitRules;
  return {
    stopLossPct: normalizeOptionalPositivePctForDb(r.stopLossPct),
    targetProfitPct: normalizeOptionalPositivePctForDb(r.targetProfitPct),
    tradeDeadline: normalizeTradeDeadlineForDb(r.tradeDeadline),
    exitRuleEnabled: r.exitRuleEnabled ? 1 : 0,
  };
}

async function resolveSignalsForHolding(tx: Transaction, holdingId: string): Promise<void> {
  await tx.execute({
    sql: `UPDATE signals SET is_resolved = 1 WHERE holding_id = ? AND is_resolved = 0`,
    args: [holdingId],
  });
}

async function resolveThemeBinding(
  tx: Transaction,
  userId: string,
  themeId: string | null | undefined,
  structureThemeFallback: string,
): Promise<{ ok: true; themeId: string | null; themeNameForTags: string } | { ok: false; message: string }> {
  const tid = themeId != null && String(themeId).trim().length > 0 ? String(themeId).trim() : null;
  if (tid == null) {
    return { ok: true, themeId: null, themeNameForTags: structureThemeFallback.trim() };
  }
  const rs = await tx.execute({
    sql: `SELECT id, name FROM investment_themes WHERE id = ? AND user_id = ? LIMIT 1`,
    args: [tid, userId],
  });
  if (rs.rows.length === 0) {
    return { ok: false, message: "選択した構造投資テーマが見つかりません。" };
  }
  const name = String(rs.rows[0]!.name);
  return { ok: true, themeId: tid, themeNameForTags: name };
}

export async function executeTradeInTransaction(
  tx: Transaction,
  p: ExecuteTradeParams,
  fxUsdJpy: number,
): Promise<ExecuteTradeResult> {
  assertYmd(p.tradeDate);
  const ticker = normalizeTicker(p.ticker);
  if (!ticker) return { ok: false, message: "ティッカーを入力してください。" };
  const qty = p.quantity;
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, message: "数量は正の数にしてください。" };
  const unit = p.unitPriceLocal;
  if (!Number.isFinite(unit) || unit <= 0) return { ok: false, message: "単価は正の数にしてください。" };
  const feeLocal = Number.isFinite(p.feeLocal) && p.feeLocal >= 0 ? Number(p.feeLocal) : 0;
  const feeCurrency: "JPY" | "USD" = p.feeCurrency === "USD" ? "USD" : "JPY";
  const fx = Number.isFinite(fxUsdJpy) && fxUsdJpy > 0 ? fxUsdJpy : USD_JPY_RATE_FALLBACK;
  const feesJpy =
    feeCurrency === "USD"
      ? Math.round(feeLocal * fx)
      : Number.isFinite(p.feesJpy) && p.feesJpy >= 0
        ? Math.round(p.feesJpy)
        : Math.round(feeLocal);

  const market = isUsTicker(ticker) ? "US" : "JP";
  const displayName = (p.name && p.name.trim().length > 0 ? p.name.trim() : ticker) as string;

  const gJpy = grossJpy(qty, unit, ticker, fxUsdJpy);
  if (!Number.isFinite(gJpy) || gJpy <= 0) {
    return { ok: false, message: "金額の計算に失敗しました。単価・数量を確認してください。" };
  }

  const themeBind = await resolveThemeBinding(tx, p.userId, p.themeId, p.structureTheme ?? "");
  if (!themeBind.ok) return { ok: false, message: themeBind.message };
  const structureTagsJson = structureTagsJsonFromThemeSector(
    themeBind.themeNameForTags,
    p.structureSector ?? "",
  );
  const sectorColumn =
    p.structureSector != null && String(p.structureSector).trim().length > 0
      ? String(p.structureSector).trim()
      : null;
  const reasonStored = normalizeTradeReason(p.reason);
  const tradeThemeId = themeBind.themeId;

  if (p.side === "BUY") {
    const existing = await selectHolding(tx, p.userId, ticker);
    const tradeId = crypto.randomUUID();
    const costJpy = gJpy + feesJpy;
    const proceedsJpy = 0;
    const realizedPnlJpy = 0;

    let holdingId: string;
    let newQty: number;
    let newAvg: number | null;

    const expectationForNew =
      p.expectationCategory === undefined ? null : normalizeExpectationCategoryInput(p.expectationCategory);
    const expectationForExisting =
      p.expectationCategory === undefined
        ? existing?.expectationCategoryDb ?? null
        : normalizeExpectationCategoryInput(p.expectationCategory);

    const shortTermResolved = resolveShortTermExitForBuy(p, existing);

    if (existing == null) {
      holdingId = crypto.randomUUID();
      newQty = qty;
      newAvg = (qty * unit + feeLocal) / qty;
      await tx.execute({
        sql: `INSERT INTO holdings (
                id, user_id, ticker, name, quantity, avg_acquisition_price, structure_tags, sector, category,
                provider_symbol, valuation_factor, account_type, expectation_category,
                stop_loss_pct, target_profit_pct, trade_deadline, exit_rule_enabled,
                created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          holdingId,
          p.userId,
          ticker,
          displayName,
          newQty,
          newAvg,
          structureTagsJson,
          sectorColumn,
          p.categoryForNewHolding,
          p.accountName,
          expectationForNew,
          shortTermResolved.stopLossPct,
          shortTermResolved.targetProfitPct,
          shortTermResolved.tradeDeadline,
          shortTermResolved.exitRuleEnabled,
        ],
      });
    } else {
      holdingId = existing.id;
      const oldQ = Number.isFinite(existing.quantity) ? existing.quantity : 0;
      const oldAvg = existing.avgAcquisitionPrice;
      newQty = oldQ + qty;
      if (newQty <= 0) return { ok: false, message: "保有数量の更新が無効です。" };
      if (oldQ <= 0 || oldAvg == null || !Number.isFinite(oldAvg) || oldAvg <= 0) {
        newAvg = (qty * unit + feeLocal) / qty;
      } else {
        newAvg = (oldQ * oldAvg + qty * unit + feeLocal) / newQty;
      }
      await tx.execute({
        sql: `UPDATE holdings
              SET quantity = ?, avg_acquisition_price = ?, name = ?, structure_tags = ?, sector = ?, expectation_category = ?,
                  stop_loss_pct = ?, target_profit_pct = ?, trade_deadline = ?, exit_rule_enabled = ?
              WHERE id = ? AND user_id = ?`,
        args: [
          newQty,
          newAvg,
          displayName,
          structureTagsJson,
          sectorColumn,
          expectationForExisting,
          shortTermResolved.stopLossPct,
          shortTermResolved.targetProfitPct,
          shortTermResolved.tradeDeadline,
          shortTermResolved.exitRuleEnabled,
          holdingId,
          p.userId,
        ],
      });
    }

    await tx.execute({
      sql: `INSERT INTO trade_history (
              id, user_id, trade_date, ticker, name, market, account_name, side,
              quantity, cost_jpy, proceeds_jpy, fee, fee_currency, fees_jpy, realized_pnl_jpy, reason, theme_id, provider_symbol
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'BUY', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      args: [
        tradeId,
        p.userId,
        p.tradeDate,
        ticker,
        displayName,
        market,
        p.accountName,
        qty,
        costJpy,
        proceedsJpy,
        feeLocal,
        feeCurrency,
        feesJpy,
        realizedPnlJpy,
        reasonStored,
        tradeThemeId,
      ],
    });

    await resolveSignalsForHolding(tx, holdingId);
    return { ok: true, holdingId, tradeId };
  }

  /* SELL */
  const existing = await selectHolding(tx, p.userId, ticker);
  if (existing == null) {
    return { ok: false, message: "このティッカーの保有がありません。売却できません。" };
  }
  const oldQ = Number.isFinite(existing.quantity) ? existing.quantity : 0;
  if (oldQ + 1e-9 < qty) {
    return { ok: false, message: `売却数量が保有数量（${oldQ}）を超えています。` };
  }
  if (existing.avgAcquisitionPrice == null || !Number.isFinite(existing.avgAcquisitionPrice)) {
    return { ok: false, message: "平均取得単価が未設定のため、簿価ベースの確定損益を計算できません。" };
  }

  const costBasis = costBasisJpySold(qty, existing.avgAcquisitionPrice, ticker, fxUsdJpy);
  const proceedsGrossJpy = gJpy;
  const realizedPnlJpy = proceedsGrossJpy - feesJpy - costBasis;

  const newQty = oldQ - qty;
  const newAvg = newQty <= 1e-9 ? null : existing.avgAcquisitionPrice;

  const tradeId = crypto.randomUUID();
  await tx.execute({
    sql: `INSERT INTO trade_history (
            id, user_id, trade_date, ticker, name, market, account_name, side,
            quantity, cost_jpy, proceeds_jpy, fee, fee_currency, fees_jpy, realized_pnl_jpy, reason, theme_id, provider_symbol
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SELL', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    args: [
      tradeId,
      p.userId,
      p.tradeDate,
      ticker,
      displayName,
      market,
      p.accountName,
      qty,
      costBasis,
      proceedsGrossJpy,
      feeLocal,
      feeCurrency,
      feesJpy,
      Math.round(realizedPnlJpy),
      reasonStored,
      tradeThemeId,
    ],
  });

  await tx.execute({
    sql: `UPDATE holdings SET quantity = ?, avg_acquisition_price = ?, structure_tags = ?, sector = ? WHERE id = ? AND user_id = ?`,
    args: [Math.max(0, newQty), newAvg, structureTagsJson, sectorColumn, existing.id, p.userId],
  });

  await resolveSignalsForHolding(tx, existing.id);
  return { ok: true, holdingId: existing.id, tradeId };
}

export async function executeTradeWithClient(db: Client, p: ExecuteTradeParams): Promise<ExecuteTradeResult> {
  let fxUsdJpy = USD_JPY_RATE_FALLBACK;
  try {
    const snap = await fetchUsdJpyRate();
    if (snap != null && Number.isFinite(snap.rate) && snap.rate > 0) fxUsdJpy = snap.rate;
  } catch {
    /* keep fallback */
  }

  const tx = await db.transaction("write");
  try {
    const out = await executeTradeInTransaction(tx, p, fxUsdJpy);
    if (!out.ok) {
      await tx.rollback();
      return out;
    }
    await tx.commit();
    return out;
  } catch (e) {
    await tx.rollback();
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table") || msg.toLowerCase().includes("trade_history")) {
      return {
        ok: false,
        message: "trade_history テーブルがありません。migrations/005_trade_history.sql を適用してください。",
      };
    }
    if (msg.toLowerCase().includes("no such column") && msg.toLowerCase().includes("reason")) {
      return {
        ok: false,
        message: "trade_history に reason 列がありません。migrations/016_trade_history_reason.sql を適用してください。",
      };
    }
    if (msg.toLowerCase().includes("no such column") && msg.toLowerCase().includes("theme_id")) {
      return {
        ok: false,
        message:
          "trade_history に theme_id 列がありません。migrations/018_trade_history_theme_id.sql を適用してください。",
      };
    }
    if (msg.toLowerCase().includes("no such column") && msg.toLowerCase().includes("expectation_category")) {
      return {
        ok: false,
        message:
          "holdings に expectation_category 列がありません。migrations/020_expectation_category.sql を適用してください。",
      };
    }
    if (msg.toLowerCase().includes("no such column") && msg.toLowerCase().includes("stop_loss_pct")) {
      return {
        ok: false,
        message:
          "holdings に短期ルール列がありません。migrations/044_add_short_term_trade_rules.sql を適用してください。",
      };
    }
    return { ok: false, message: msg };
  } finally {
    tx.close();
  }
}
