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
    const { sceneId, videoUrl, videoId } = await req.json()
    if (typeof sceneId !== 'string' || typeof videoUrl !== 'string') {
      throw new RouteError(400, 'sceneId and videoUrl required')
    }

    const safeVideoUrl = await validateRemoteMediaUrl(videoUrl)
    const db = await getDatabase()
    requireSceneAccess(db, sceneId, userId, 'write')

    const clipId = uuid()
    db.run(
      "INSERT INTO video_clips (id, scene_id, video_id, status, file_path) VALUES (?, ?, ?, 'completed', ?)",
      [clipId, sceneId, typeof videoId === 'string' ? videoId : '', safeVideoUrl],
    )
    db.run("UPDATE scenes SET state = 'VIDEO_READY', error_message = NULL WHERE id = ?", [sceneId])
    saveDatabase()

    return NextResponse.json({ id: clipId, filePath: safeVideoUrl })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
