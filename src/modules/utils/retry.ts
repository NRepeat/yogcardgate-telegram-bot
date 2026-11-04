/** Transient network failure: connection reset/timeout, `fetch failed`, HTTP 5xx. */
export function isTransientError(e: unknown): boolean {
  const err = e as { message?: string; code?: string; cause?: { code?: string }; status?: number };
  if (typeof err?.status === 'number') return err.status >= 500;
  const text = `${err?.message ?? ''} ${err?.code ?? ''} ${err?.cause?.code ?? ''}`;
  return /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|UND_ERR|fetch failed|timeout|aborted/i.test(text);
}

/** Run `fn`, retrying transient errors up to `attempts` times with a growing backoff. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 300,
): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || !isTransientError(e)) throw e;
      await new Promise((r) => setTimeout(r, delayMs * i));
    }
  }
}
