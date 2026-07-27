import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { validateRemoteMediaUrl } from '@/services/remote-media.service'
import {
  requireAuth,
  requireProjectAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const { projectId, type, name, imageUrl } = await req.json()
    if (
      typeof projectId !== 'string' ||
      !['cover', 'character', 'location'].includes(type) ||
      typeof imageUrl !== 'string'
    ) {
      throw new RouteError(400, '请求参数无效')
    }

    const safeImageUrl = await validateRemoteMediaUrl(imageUrl)
    const db = await getDatabase()
    requireProjectAccess(db, projectId, userId, 'write')

    if (type === 'cover') {
      db.run('UPDATE projects SET cover_image = ? WHERE id = ?', [safeImageUrl, projectId])
    } else if (type === 'character' && typeof name === 'string') {
      db.run(
        'UPDATE characters SET reference_image = ? WHERE project_id = ? AND name = ?',
        [safeImageUrl, projectId, name],
      )
    } else if (type === 'location' && typeof name === 'string') {
      db.run(
        'UPDATE locations SET reference_image = ? WHERE project_id = ? AND name = ?',
        [safeImageUrl, projectId, name],
      )
    } else {
      throw new RouteError(400, '资产名称无效')
    }
    saveDatabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
