"use server";

import { revalidatePath } from "next/cache";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { executeTradeWithClient, type ExecuteTradeParams } from "@/src/lib/execute-trade";
import { getDb, isDbConfigured } from "@/src/lib/db";

export type ExecuteTradeActionInput = {
  userId?: string;
  ticker: string;
  name?: string;
  accountName?: string;
  side: "BUY" | "SELL";
  quantity: number;
  unitPriceLocal: number;
  feeLocal?: number;
  feeCurrency?: "JPY" | "USD";
  feesJpy?: number;
  tradeDate: string;
  categoryForNewHolding?: "Core" | "Satellite";
  /** `structure_tags` 先頭（テーマ） */
  structureTheme?: string;
  /** `structure_tags` 2 番目および `holdings.sector` */
  structureSector?: string;
  /** `investment_themes.id`（任意、`trade_history.theme_id`） */
  themeId?: string | null;
  /** 取引理由・反省（任意、`trade_history.reason`） */
  reason?: string;
};

export type ExecuteTradeActionResult = {
  ok: boolean;
  message: string;
  tradeId?: string;
  holdingId?: string;
};

/** 取引入力用: ユーザーの `investment_themes` 一覧（名前順） */
export async function listInvestmentThemesForUser(userId?: string): Promise<{ id: string; name: string }[]> {
  if (!isDbConfigured()) return [];
  try {
    const uid = userId && userId.length > 0 ? userId : defaultProfileUserId();
    const db = getDb();
    const rs = await db.execute({
      sql: `SELECT id, name FROM investment_themes WHERE user_id = ? ORDER BY name ASC`,
      args: [uid],
    });
    return rs.rows.map((row) => ({ id: String(row.id), name: String(row.name) }));
  } catch {
    return [];
  }
}

function normalizeAccount(raw: string | undefined): string {
  const t = (raw ?? "特定").trim();
  return t.length > 0 ? t : "特定";
}

export async function executeTradeAction(input: ExecuteTradeActionInput): Promise<ExecuteTradeActionResult> {
  if (!isDbConfigured()) {
    return {
      ok: false,
      message: "Database not configured (set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN).",
    };
  }

  const uid = input.userId && input.userId.length > 0 ? input.userId : defaultProfileUserId();
  const side = input.side === "BUY" ? "BUY" : "SELL";
  const category = input.categoryForNewHolding === "Core" ? "Core" : "Satellite";

  const reasonRaw = input.reason?.trim().slice(0, 4000) ?? "";

  const params: ExecuteTradeParams = {
    userId: uid,
    ticker: input.ticker,
    name: input.name ?? "",
    accountName: normalizeAccount(input.accountName),
    side,
    quantity: Number(input.quantity),
    unitPriceLocal: Number(input.unitPriceLocal),
    feeLocal: input.feeLocal != null ? Number(input.feeLocal) : 0,
    feeCurrency: input.feeCurrency === "USD" ? "USD" : "JPY",
    feesJpy: input.feesJpy != null ? Number(input.feesJpy) : 0,
    tradeDate: input.tradeDate.trim(),
    categoryForNewHolding: category,
    structureTheme: input.structureTheme?.trim() ?? "",
    structureSector: input.structureSector?.trim() ?? "",
    themeId: input.themeId != null && String(input.themeId).trim().length > 0 ? String(input.themeId).trim() : null,
    reason: reasonRaw.length > 0 ? reasonRaw : undefined,
  };

  const db = getDb();
  const out = await executeTradeWithClient(db, params);
  if (!out.ok) {
    return { ok: false, message: out.message };
  }

  revalidatePath("/");
  revalidatePath("/logs");
  revalidatePath("/themes", "layout");
  return {
    ok: true,
    message: side === "BUY" ? "買い注文を記録し、保有を更新しました。" : "売却を記録し、保有を更新しました。",
    tradeId: out.tradeId,
    holdingId: out.holdingId,
  };
}
