import { randomUUID } from "crypto";

import type { Client } from "@libsql/client";

export class EcosystemMemberAuthError extends Error {
  readonly code = "THEME_NOT_FOUND" as const;
}

export class EcosystemMemberDuplicateError extends Error {
  readonly code = "DUPLICATE_TICKER" as const;
}

export type AddEcosystemMemberInput = {
  userId: string;
  themeId: string;
  ticker: string;
  role: string | null;
  isMajorPlayer: boolean;
  companyName?: string | null;
};

/**
 * Inserts a row into `theme_ecosystem_members`. Caller must ensure DB is configured.
 */
export async function addMemberToEcosystem(db: Client, input: AddEcosystemMemberInput): Promise<void> {
  const ticker = input.ticker.trim();
  if (!ticker) {
    throw new Error("Ticker is required");
  }

  const themeCheck = await db.execute({
    sql: `SELECT 1 AS ok FROM investment_themes WHERE id = ? AND user_id = ? LIMIT 1`,
    args: [input.themeId, input.userId],
  });
  if (themeCheck.rows.length === 0) {
    throw new EcosystemMemberAuthError("Theme not found for this user");
  }

  const role = input.role != null && input.role.trim().length > 0 ? input.role.trim() : null;
  const companyName =
    input.companyName != null && String(input.companyName).trim().length > 0 ? String(input.companyName).trim() : null;

  try {
    await db.execute({
      sql: `INSERT INTO theme_ecosystem_members (
        id, theme_id, ticker,
        is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation, observation_notes,
        company_name, field, role, is_major_player, observation_started_at
      ) VALUES (
        ?, ?, ?,
        0, NULL, NULL, NULL, NULL,
        ?, NULL, ?, ?, NULL
      )`,
      args: [randomUUID(), input.themeId, ticker, companyName, role, input.isMajorPlayer ? 1 : 0],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const lower = msg.toLowerCase();
    if (lower.includes("unique") || lower.includes("constraint")) {
      throw new EcosystemMemberDuplicateError("This ticker is already registered for this theme");
    }
    throw e;
  }
}
