import { randomUUID } from "crypto";

import type { Client } from "@libsql/client";

import { normalizeEcosystemMemberField } from "@/src/lib/ecosystem-field-meta";
import { EARNINGS_SUMMARY_NOTE_MAX_LEN } from "@/src/lib/earnings-summary-note-meta";
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
  /** DB `field`（分類タグ）。未指定・空は NULL */
  ecosystemField?: string | null;
};

export type UpdateEcosystemMemberInput = {
  userId: string;
  themeId: string;
  memberId: string;
  role?: string | null;
  isMajorPlayer?: boolean;
  companyName?: string | null;
  /** DB `memo`（短文）。空文字は NULL */
  memo?: string | null;
  /** DB `listing_date`（上場日・YYYY-MM-DD）。undefined=変更なし null=クリア */
  listingDate?: string | null;
  /** DB `market_cap`。undefined=変更なし null=クリア */
  marketCap?: number | null;
  /** DB `listing_price`（創業来％算出用）。undefined=変更なし null=クリア */
  listingPrice?: number | null;
  /** DB `field`（分類タグ）。undefined=変更なし null=クリア */
  ecosystemField?: string | null;
  /** DB `earnings_summary_note`。undefined=変更なし null=クリア */
  earningsSummaryNote?: string | null;
  /** DB `lynch_drivers_narrative`（Story パネル永続化 JSON+叙述）。undefined=変更なし null=クリア */
  lynchDriversNarrative?: string | null;
  /** DB `lynch_story_text`。undefined=変更なし null=クリア */
  lynchStoryText?: string | null;
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

  const fieldDb = normalizeEcosystemMemberField(input.ecosystemField);

  const isUnlisted = ecosystemTickerShouldBeUnlisted(ticker) ? 1 : 0;

  try {
    await db.execute({
      sql: `INSERT INTO theme_ecosystem_members (
        id, theme_id, ticker,
        is_unlisted, proxy_ticker, estimated_ipo_date, estimated_valuation, observation_notes,
        company_name, field, role, is_major_player, observation_started_at,
        earnings_summary_note
      ) VALUES (
        ?, ?, ?,
        ?, NULL, NULL, NULL, NULL,
        ?, ?, ?, ?, ?,
        NULL
      )`,
      args: [
        randomUUID(),
        input.themeId,
        ticker,
        isUnlisted,
        companyName,
        fieldDb,
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
  const nextMemo =
    input.memo === undefined
      ? undefined
      : input.memo != null && String(input.memo).trim().length > 0
        ? String(input.memo).trim()
        : null;

  const nextListingDate =
    input.listingDate === undefined
      ? undefined
      : input.listingDate != null && String(input.listingDate).trim().length >= 10
        ? String(input.listingDate).trim().slice(0, 10)
        : null;

  const nextMarketCap =
    input.marketCap === undefined
      ? undefined
      : input.marketCap != null && Number.isFinite(input.marketCap)
        ? input.marketCap
        : null;

  const nextListingPrice =
    input.listingPrice === undefined
      ? undefined
      : input.listingPrice != null && Number.isFinite(input.listingPrice)
        ? input.listingPrice
        : null;

  const nextField =
    input.ecosystemField === undefined ? undefined : normalizeEcosystemMemberField(input.ecosystemField);

  const nextEarningsSummary =
    input.earningsSummaryNote === undefined
      ? undefined
      : input.earningsSummaryNote != null && String(input.earningsSummaryNote).trim().length > 0
        ? String(input.earningsSummaryNote).trim().slice(0, EARNINGS_SUMMARY_NOTE_MAX_LEN)
        : null;

  const nextLynchDriversNarrative =
    input.lynchDriversNarrative === undefined
      ? undefined
      : input.lynchDriversNarrative != null && String(input.lynchDriversNarrative).trim().length > 0
        ? String(input.lynchDriversNarrative).trim()
        : null;

  const nextLynchStoryText =
    input.lynchStoryText === undefined
      ? undefined
      : input.lynchStoryText != null && String(input.lynchStoryText).trim().length > 0
        ? String(input.lynchStoryText).trim()
        : null;

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
  if (nextMemo !== undefined) {
    sets.push(`memo = ?`);
    args.push(nextMemo);
  }
  if (nextListingDate !== undefined) {
    sets.push(`listing_date = ?`);
    args.push(nextListingDate);
  }
  if (nextMarketCap !== undefined) {
    sets.push(`market_cap = ?`);
    args.push(nextMarketCap);
  }
  if (nextListingPrice !== undefined) {
    sets.push(`listing_price = ?`);
    args.push(nextListingPrice);
  }
  if (nextField !== undefined) {
    sets.push(`field = ?`);
    args.push(nextField);
  }
  if (nextEarningsSummary !== undefined) {
    sets.push(`earnings_summary_note = ?`);
    args.push(nextEarningsSummary);
  }
  if (nextLynchDriversNarrative !== undefined) {
    sets.push(`lynch_drivers_narrative = ?`);
    args.push(nextLynchDriversNarrative);
  }
  if (nextLynchStoryText !== undefined) {
    sets.push(`lynch_story_text = ?`);
    args.push(nextLynchStoryText);
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
