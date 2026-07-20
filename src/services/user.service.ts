import { createHash } from 'crypto'

export function getUserId(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex').slice(0, 16)
}
