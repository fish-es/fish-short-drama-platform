import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, saveDatabase } from '@/services/db.service'
import {
  requireAuth,
  requireProjectAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const { id } = await req.json()
    if (typeof id !== 'string') throw new RouteError(400, '项目 ID 无效')

    const db = await getDatabase()
    requireProjectAccess(db, id, userId, 'write')

    db.run("UPDATE projects SET status = 'active', deleted_at = NULL WHERE id = ?", [id])
    saveDatabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
