import { randomUUID } from "crypto";

import type { Client } from "@libsql/client";

import { ecosystemTickerShouldBeUnlisted } from "@/src/lib/ecosystem-ticker-hygiene";

export class EcosystemMemberAuthError extends Error {
  readonly code = "THEME_NOT_FOUND" as const;
}

export class EcosystemMemberDuplicateError extends Error {
  readonly code = "DUPLICATE_TICKER" as const;
}

export class EcosystemMemberNotFoundError extends Error {
  readonly code = "MEMBER_NOT_FOUND" as const;
}

export type AddEcosystemMemberInput = {
  userId: string;
  themeId: string;
  ticker: string;
  role: string | null;
  isMajorPlayer: boolean;
  companyName?: string | null;
  /** `theme_ecosystem_members.observation_started_at`（YYYY-MM-DD）。未指定は NULL */
  observationStartedAt?: string | null;
};

export type UpdateEcosystemMemberInput = {
  userId: string;
  themeId: string;
  memberId: string;
  role?: string | null;
  isMajorPlayer?: boolean;
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
  const observationStartedAt =
    input.observationStartedAt != null && String(input.observationStartedAt).trim().length > 0
      ? String(input.observationStartedAt).trim()
      : null;

  const isUnlisted = ecosystemTickerShouldBeUnlisted(ticker) ? 1 : 0;

  try {
    await db.execute({
      sql: `INSERT INTO theme_ecosystem_members (
        id, theme_id, ticker,
        is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation, observation_notes,
        company_name, field, role, is_major_player, observation_started_at
      ) VALUES (
        ?, ?, ?,
        ?, NULL, NULL, NULL, NULL,
        ?, NULL, ?, ?, ?
      )`,
      args: [
        randomUUID(),
        input.themeId,
        ticker,
        isUnlisted,
        companyName,
        role,
        input.isMajorPlayer ? 1 : 0,
        observationStartedAt,
      ],
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

export async function updateEcosystemMember(db: Client, input: UpdateEcosystemMemberInput): Promise<void> {
  const memberId = input.memberId.trim();
  if (!memberId) throw new Error("memberId is required");

  const themeCheck = await db.execute({
    sql: `SELECT 1 AS ok FROM investment_themes WHERE id = ? AND user_id = ? LIMIT 1`,
    args: [input.themeId, input.userId],
  });
  if (themeCheck.rows.length === 0) {
    throw new EcosystemMemberAuthError("Theme not found for this user");
  }

  const memberCheck = await db.execute({
    sql: `SELECT 1 AS ok FROM theme_ecosystem_members WHERE id = ? AND theme_id = ? LIMIT 1`,
    args: [memberId, input.themeId],
  });
  if (memberCheck.rows.length === 0) {
    throw new EcosystemMemberNotFoundError("Ecosystem member not found");
  }

  const nextRole =
    input.role === undefined ? undefined : input.role != null && input.role.trim().length > 0 ? input.role.trim() : null;
  const nextCompanyName =
    input.companyName === undefined
      ? undefined
      : input.companyName != null && String(input.companyName).trim().length > 0
        ? String(input.companyName).trim()
        : null;
  const nextMajor = input.isMajorPlayer === undefined ? undefined : input.isMajorPlayer === true ? 1 : 0;

  // Only update the fields that were provided.
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (nextRole !== undefined) {
    sets.push(`role = ?`);
    args.push(nextRole);
  }
  if (nextCompanyName !== undefined) {
    sets.push(`company_name = ?`);
    args.push(nextCompanyName);
  }
  if (nextMajor !== undefined) {
    sets.push(`is_major_player = ?`);
    args.push(nextMajor);
  }
  if (sets.length === 0) return;

  await db.execute({
    sql: `UPDATE theme_ecosystem_members SET ${sets.join(", ")} WHERE id = ? AND theme_id = ?`,
    args: [...args, memberId, input.themeId],
  });
}

export async function deleteEcosystemMember(
  db: Client,
  input: { userId: string; themeId: string; memberId: string },
): Promise<void> {
  const memberId = input.memberId.trim();
  if (!memberId) throw new Error("memberId is required");

  const themeCheck = await db.execute({
    sql: `SELECT 1 AS ok FROM investment_themes WHERE id = ? AND user_id = ? LIMIT 1`,
    args: [input.themeId, input.userId],
  });
  if (themeCheck.rows.length === 0) {
    throw new EcosystemMemberAuthError("Theme not found for this user");
  }

  await db.execute({
    sql: `DELETE FROM theme_ecosystem_members WHERE id = ? AND theme_id = ?`,
    args: [memberId, input.themeId],
  });
}
