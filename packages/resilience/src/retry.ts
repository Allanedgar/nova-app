export interface RetryOptions {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitter: number;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 10_000, jitter: 0.1 },
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: unknown) {
      lastError = e;
      if (attempt >= opts.maxRetries) break;
      const delay = Math.min(opts.baseDelayMs * Math.pow(2, attempt), opts.maxDelayMs);
      const jitterAmt = delay * opts.jitter * (Math.random() * 2 - 1);
      await new Promise((r) => setTimeout(r, delay + jitterAmt));
    }
  }
  throw lastError;
}