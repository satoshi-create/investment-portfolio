/**
 * POST/GET signal generation: require Bearer token in production when secrets are set.
 * - SIGNALS_GENERATE_SECRET: manual calls (e.g. dashboard button, curl)
 * - CRON_SECRET: Vercel Cron sends Authorization: Bearer CRON_SECRET
 */
export function authorizeSignalsRequest(request: Request): boolean {
  const manual = process.env.SIGNALS_GENERATE_SECRET;
  const cron = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";

  if (manual && auth === `Bearer ${manual}`) return true;
  if (cron && auth === `Bearer ${cron}`) return true;

  if (!manual && !cron && process.env.NODE_ENV !== "production") {
    return true;
  }

  return false;
}

/** 既定プロフィール ID（`.env` の `NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID`。未設定時は `user-satoshi`）。 */
export function defaultProfileUserId(): string {
  const v = process.env.NEXT_PUBLIC_DEFAULT_PROFILE_USER_ID?.trim();
  return v && v.length > 0 ? v : "user-satoshi";
}
