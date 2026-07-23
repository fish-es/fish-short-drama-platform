import { createHash } from 'crypto'

// Kept only for migrating data created before account-based authentication.
export function getLegacyUserId(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex').slice(0, 16)
}
