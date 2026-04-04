"use server";

import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { generateSignalsForUser } from "@/src/lib/generate-signals";
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
