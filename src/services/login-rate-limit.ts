const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 5

interface AttemptWindow {
  count: number
  resetAt: number
}

const globalForRateLimit = globalThis as typeof globalThis & {
  __loginAttempts?: Map<string, AttemptWindow>
}

const attempts = globalForRateLimit.__loginAttempts || new Map<string, AttemptWindow>()
globalForRateLimit.__loginAttempts = attempts

export function getLoginRetryAfter(key: string): number | null {
  const entry = attempts.get(key)
  if (!entry) return null
  if (entry.resetAt <= Date.now()) {
    attempts.delete(key)
    return null
  }
  return entry.count >= MAX_FAILURES ? Math.ceil((entry.resetAt - Date.now()) / 1000) : null
}

export function recordLoginFailure(key: string): void {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  entry.count += 1
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key)
}
