import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { validateRemoteMediaUrl } from '@/services/remote-media.service'
import {
  requireAuth,
  requireSceneAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const { sceneId, imageUrl, prompt, size } = await req.json()
    if (typeof sceneId !== 'string' || typeof imageUrl !== 'string') {
      throw new RouteError(400, 'sceneId and imageUrl required')
    }

    const safeImageUrl = await validateRemoteMediaUrl(imageUrl)
    const db = await getDatabase()
    requireSceneAccess(db, sceneId, userId, 'write')

    const imageId = uuid()
    db.run('UPDATE image_assets SET is_current = 0 WHERE scene_id = ?', [sceneId])
    db.run(
      'INSERT INTO image_assets (id, scene_id, prompt, file_path, size, is_current) VALUES (?, ?, ?, ?, ?, 1)',
      [
        imageId,
        sceneId,
        typeof prompt === 'string' ? prompt.slice(0, 10_000) : '',
        safeImageUrl,
        typeof size === 'string' ? size : '1024x768',
      ],
    )
    db.run("UPDATE scenes SET state = 'IMG_READY', error_message = NULL WHERE id = ?", [sceneId])
    saveDatabase()

    return NextResponse.json({ id: imageId, filePath: safeImageUrl })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
