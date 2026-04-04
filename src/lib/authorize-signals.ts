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

export function defaultProfileUserId(): string {
  return process.env.DEFAULT_PROFILE_USER_ID ?? "user-satoshi";
}
