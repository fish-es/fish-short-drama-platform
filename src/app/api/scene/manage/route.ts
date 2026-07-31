import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, saveDatabase } from '@/services/db.service'
import {
  requireAuth,
  requireSceneAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

// 更新场景文字（描述/台词）
export async function PUT(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const { sceneId, description, dialogue } = await req.json()
    if (typeof sceneId !== 'string') throw new RouteError(400, 'sceneId required')

    const db = await getDatabase()
    requireSceneAccess(db, sceneId, userId, 'write')
    if (typeof description === 'string') {
      db.run('UPDATE scenes SET description = ? WHERE id = ?', [description.slice(0, 5000), sceneId])
    }
    if (typeof dialogue === 'string') {
      db.run('UPDATE scenes SET dialogue = ? WHERE id = ?', [dialogue.slice(0, 2000), sceneId])
    }
    saveDatabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeErrorResponse(error)
  }
}

// 删除场景（连带图片/视频）
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const { sceneId } = await req.json()
    if (typeof sceneId !== 'string') throw new RouteError(400, 'sceneId required')

    const db = await getDatabase()
    requireSceneAccess(db, sceneId, userId, 'write')
    db.run('DELETE FROM image_assets WHERE scene_id = ?', [sceneId])
    db.run('DELETE FROM video_clips WHERE scene_id = ?', [sceneId])
    db.run('DELETE FROM voice_tracks WHERE scene_id = ?', [sceneId])
    db.run('DELETE FROM scenes WHERE id = ?', [sceneId])
    saveDatabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeErrorResponse(error)
  }
}

// 重排场景顺序：传 orderedIds（同一 episode 内的场景 id 数组）
export async function POST(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const { orderedIds } = await req.json()
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) throw new RouteError(400, 'orderedIds required')

    const db = await getDatabase()
    orderedIds.forEach((sceneId: string, i: number) => {
      requireSceneAccess(db, sceneId, userId, 'write')
      db.run('UPDATE scenes SET scene_order = ? WHERE id = ?', [i, sceneId])
    })
    saveDatabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
