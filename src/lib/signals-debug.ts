/**
 * Opt-in server logs for signal generation / alpha_history reconcile.
 * Set `DEBUG_SIGNALS=1` (or `true` / `yes`) in the environment, restart the dev server, then run Generate signals.
 */
export function isSignalsDebugEnabled(): boolean {
  const v = process.env.DEBUG_SIGNALS?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function signalsDebug(...parts: unknown[]): void {
  if (!isSignalsDebugEnabled()) return;
  console.log("[signals-debug]", ...parts);
}
