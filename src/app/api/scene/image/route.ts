import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/services/db.service'
import {
  requireAuth,
  requireSceneAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const sceneId = req.nextUrl.searchParams.get('sceneId')
    if (!sceneId) throw new RouteError(400, 'sceneId required')

    const db = await getDatabase()
    requireSceneAccess(db, sceneId, userId, 'read')
    const rows = db.exec(
      'SELECT file_path FROM image_assets WHERE scene_id = ? AND is_current = 1 LIMIT 1',
      [sceneId],
    )

    if (!rows.length || !rows[0].values.length) return NextResponse.json({ filePath: null })
    return NextResponse.json({ filePath: rows[0].values[0][0] })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
