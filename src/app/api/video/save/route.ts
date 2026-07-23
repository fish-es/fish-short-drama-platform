import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getCurrentUser } from '@/services/auth.service'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })

  const { sceneId, videoUrl, videoId } = await req.json()
  if (!sceneId || !videoUrl) return NextResponse.json({ error: 'sceneId and videoUrl required' }, { status: 400 })

  const userId = user.id
  const db = await getDatabase()

  const check = db.exec(
    "SELECT sc.id FROM scenes sc JOIN scripts s ON sc.script_id = s.id JOIN projects p ON s.project_id = p.id WHERE sc.id = ? AND p.user_id = ?",
    [sceneId, userId]
  )
  if (!check.length || !check[0].values.length) return NextResponse.json({ error: 'Scene not found' }, { status: 404 })

  const clipId = uuid()
  db.run("INSERT INTO video_clips (id, scene_id, video_id, status, file_path) VALUES (?, ?, ?, 'completed', ?)",
    [clipId, sceneId, videoId || '', videoUrl])
  db.run("UPDATE scenes SET state = 'VIDEO_READY', error_message = NULL WHERE id = ?", [sceneId])
  saveDatabase()

  return NextResponse.json({ id: clipId, filePath: videoUrl })
}
