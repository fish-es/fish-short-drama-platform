import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { routeErrorResponse } from '@/services/security.service'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-session-token')?.trim()
    if (token) {
      const db = await getDatabase()
      db.run('DELETE FROM sessions WHERE token = ?', [token])
      saveDatabase()
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return routeErrorResponse(err)
  }
}
