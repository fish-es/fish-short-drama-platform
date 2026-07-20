// Universal retry utility with exponential backoff

export interface RetryOptions {
  maxAttempts?: number
  backoff?: number[]
  jitter?: number
  retryOn?: number[]
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  backoff: [2000, 5000, 10000, 20000, 30000],
  jitter: 1000,
  retryOn: [429, 500, 502, 503, 504]
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const { maxAttempts, backoff, jitter, retryOn } = opts
  let lastError: any

  for (let attempt = 0; attempt < maxAttempts!; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      // Check if error is retryable
      const status = error.status || error.statusCode
      const isRetryable = status
        ? retryOn!.includes(status)
        : /ETIMEDOUT|ECONNRESET|ECONNREFUSED|fetch failed/i.test(error.message || '')

      if (!isRetryable || attempt >= maxAttempts! - 1) {
        throw error
      }

      // Wait with backoff + jitter
      const delay = backoff![Math.min(attempt, backoff!.length - 1)]
      const jitterMs = Math.random() * jitter! * 2 - jitter!
      await sleep(delay + jitterMs)
    }
  }

  throw lastError
}
