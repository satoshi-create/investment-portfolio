"use server";

import { revalidatePath } from "next/cache";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { generateSignalsForUser } from "@/src/lib/generate-signals";
import { resolveSignal } from "@/src/lib/db-operations";
import { getDb, isDbConfigured } from "@/src/lib/db";

export type GenerateSignalsActionResult = {
  ok: boolean;
  message: string;
  inserted?: number;
};

/** Dashboard manual run: server-only, no Bearer token in the browser. */
export async function generateSignalsAction(userId?: string): Promise<GenerateSignalsActionResult> {
  if (!isDbConfigured()) {
    return {
      ok: false,
      message: "Database not configured (set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN).",
    };
  }
  const uid = userId && userId.length > 0 ? userId : defaultProfileUserId();
  try {
    const { inserted } = await generateSignalsForUser(uid, getDb());
    return {
      ok: true,
      message: inserted === 0 ? "No new signals (rules already satisfied or deduped)." : `Inserted ${inserted} signal(s).`,
      inserted,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Signal generation failed.",
    };
  }
}

export type ResolveSignalActionResult = {
  ok: boolean;
  message: string;
};

/** Patrol: mark signal resolved after user acknowledges (scoped to profile). */
export async function resolveSignalAction(
  signalId: string,
  userId?: string,
): Promise<ResolveSignalActionResult> {
  if (!signalId || signalId.trim().length === 0) {
    return { ok: false, message: "Missing signal id." };
  }
  if (!isDbConfigured()) {
    return {
      ok: false,
      message: "Database not configured (set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN).",
    };
  }
  const uid = userId && userId.length > 0 ? userId : defaultProfileUserId();
  const db = getDb();
  try {
    const check = await db.execute({
      sql: `SELECT 1 AS ok FROM signals s
            JOIN holdings h ON h.id = s.holding_id
            WHERE s.id = ? AND s.is_resolved = 0 AND h.user_id = ?
            LIMIT 1`,
      args: [signalId, uid],
    });
    if (check.rows.length === 0) {
      return { ok: false, message: "Signal not found or already resolved." };
    }
    await resolveSignal(db, signalId);
    revalidatePath("/");
    return { ok: true, message: "Signal marked as reviewed." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not resolve signal.",
    };
  }
}
