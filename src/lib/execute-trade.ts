import type { Client, Transaction } from "@libsql/core/api";

import { classifyTickerInstrument } from "@/src/lib/alpha-logic";
import { USD_JPY_RATE_FALLBACK } from "@/src/lib/fx-constants";
import { fetchUsdJpyRate } from "@/src/lib/price-service";
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
  /** 円建て手数料 */
  feesJpy: number;
  /** YYYY-MM-DD */
  tradeDate: string;
  /** 新規 BUY で holdings を作るときのみ使用 */
  categoryForNewHolding: "Core" | "Satellite";
  /** `structure_tags` の [0]=テーマ、[1]=セクター として保存 */
  structureTheme: string;
  structureSector: string;
};

export type ExecuteTradeResult =
  | { ok: true; holdingId: string; tradeId: string }
  | { ok: false; message: string };

function normalizeTicker(raw: string): string {
  const t = raw.trim();
  if (t.length === 0) return t;
  return classifyTickerInstrument(t) === "JP_INVESTMENT_TRUST" ? t : t.toUpperCase();
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
};

async function selectHolding(tx: Transaction, userId: string, ticker: string): Promise<HoldingRow | null> {
  const rs = await tx.execute({
    sql: `SELECT id, quantity, avg_acquisition_price, name, account_type FROM holdings WHERE user_id = ? AND ticker = ? LIMIT 1`,
    args: [userId, ticker],
  });
  if (rs.rows.length === 0) return null;
  const r = rs.rows[0]!;
  return {
    id: String(r.id),
    quantity: Number(r.quantity),
    avgAcquisitionPrice:
      r.avg_acquisition_price != null && Number.isFinite(Number(r.avg_acquisition_price))
        ? Number(r.avg_acquisition_price)
        : null,
    name: r.name != null ? String(r.name) : null,
    accountType: r.account_type != null ? String(r.account_type) : null,
  };
}

async function resolveSignalsForHolding(tx: Transaction, holdingId: string): Promise<void> {
  await tx.execute({
    sql: `UPDATE signals SET is_resolved = 1 WHERE holding_id = ? AND is_resolved = 0`,
    args: [holdingId],
  });
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
  const feesJpy = Number.isFinite(p.feesJpy) && p.feesJpy >= 0 ? Math.round(p.feesJpy) : 0;

  const market = isUsTicker(ticker) ? "US" : "JP";
  const displayName = (p.name && p.name.trim().length > 0 ? p.name.trim() : ticker) as string;

  const gJpy = grossJpy(qty, unit, ticker, fxUsdJpy);
  if (!Number.isFinite(gJpy) || gJpy <= 0) {
    return { ok: false, message: "金額の計算に失敗しました。単価・数量を確認してください。" };
  }

  const structureTagsJson = structureTagsJsonFromThemeSector(p.structureTheme ?? "", p.structureSector ?? "");
  const sectorColumn =
    p.structureSector != null && String(p.structureSector).trim().length > 0
      ? String(p.structureSector).trim()
      : null;

  if (p.side === "BUY") {
    const existing = await selectHolding(tx, p.userId, ticker);
    const tradeId = crypto.randomUUID();
    const costJpy = gJpy + feesJpy;
    const proceedsJpy = 0;
    const realizedPnlJpy = 0;

    let holdingId: string;
    let newQty: number;
    let newAvg: number | null;

    if (existing == null) {
      holdingId = crypto.randomUUID();
      newQty = qty;
      newAvg = unit;
      await tx.execute({
        sql: `INSERT INTO holdings (
                id, user_id, ticker, name, quantity, avg_acquisition_price, structure_tags, sector, category,
                provider_symbol, valuation_factor, account_type, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, datetime('now'))`,
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
        ],
      });
    } else {
      holdingId = existing.id;
      const oldQ = Number.isFinite(existing.quantity) ? existing.quantity : 0;
      const oldAvg = existing.avgAcquisitionPrice;
      newQty = oldQ + qty;
      if (newQty <= 0) return { ok: false, message: "保有数量の更新が無効です。" };
      if (oldQ <= 0 || oldAvg == null || !Number.isFinite(oldAvg) || oldAvg <= 0) {
        newAvg = unit;
      } else {
        newAvg = (oldQ * oldAvg + qty * unit) / newQty;
      }
      await tx.execute({
        sql: `UPDATE holdings
              SET quantity = ?, avg_acquisition_price = ?, name = ?, structure_tags = ?, sector = ?
              WHERE id = ? AND user_id = ?`,
        args: [newQty, newAvg, displayName, structureTagsJson, sectorColumn, holdingId, p.userId],
      });
    }

    await tx.execute({
      sql: `INSERT INTO trade_history (
              id, user_id, trade_date, ticker, name, market, account_name, side,
              quantity, cost_jpy, proceeds_jpy, fees_jpy, realized_pnl_jpy, provider_symbol
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'BUY', ?, ?, ?, ?, ?, NULL)`,
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
        feesJpy,
        realizedPnlJpy,
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
            quantity, cost_jpy, proceeds_jpy, fees_jpy, realized_pnl_jpy, provider_symbol
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SELL', ?, ?, ?, ?, ?, NULL)`,
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
      feesJpy,
      Math.round(realizedPnlJpy),
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
    return { ok: false, message: msg };
  } finally {
    tx.close();
  }
}
