import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }
const KEY_LEN = 64

/** Hash a plaintext password, returning "salt:hash" */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS).toString('hex')
  return `${salt}:${hash}`
}

/** Constant-time comparison of a plaintext password against a stored "salt:hash" */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, storedHash] = stored.split(':')
  if (!salt || !storedHash) return false
  const derived = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS)
  const storedBuf = Buffer.from(storedHash, 'hex')
  if (derived.length !== storedBuf.length) return false
  return timingSafeEqual(derived, storedBuf)
}

/** Generate a cryptographically random token string */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

/** Return an ISO datetime string offset by `hours` from now */
export function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString()
}
