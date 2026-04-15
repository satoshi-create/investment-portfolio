export type FetchWithTimeoutOptions = {
  /** Timeout in milliseconds. Default: 8000 */
  timeoutMs?: number;
};

function abortError(): Error {
  // DOMException is the canonical AbortError, but it may not exist in some JS runtimes.
  // Client components will have it; this keeps typing consistent.
  try {
    return new DOMException("The operation was aborted.", "AbortError");
  } catch {
    const e = new Error("The operation was aborted.");
    (e as Error & { name: string }).name = "AbortError";
    return e;
  }
}

/**
 * `fetch` with AbortController timeout.
 * - If `init.signal` aborts, we propagate cancellation.
 * - If timeout elapses first, we abort and throw an AbortError.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: FetchWithTimeoutOptions,
): Promise<Response> {
  const timeoutMs = Math.max(0, Math.floor(options?.timeoutMs ?? 8000));
  const upstream = init?.signal ?? null;

  // If caller already aborted, mirror fetch behavior.
  if (upstream?.aborted) throw abortError();

  const ac = new AbortController();
  const onUpstreamAbort = () => ac.abort();
  if (upstream) upstream.addEventListener("abort", onUpstreamAbort, { once: true });

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      ac.abort();
    }, timeoutMs);
  }

  try {
    return await fetch(input, { ...(init ?? {}), signal: ac.signal });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (upstream) upstream.removeEventListener("abort", onUpstreamAbort);
  }
}

