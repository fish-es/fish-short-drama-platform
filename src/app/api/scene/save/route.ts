import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getCurrentUser } from '@/services/auth.service'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })

  const { sceneId, imageUrl, prompt, size } = await req.json()
  if (!sceneId || !imageUrl) return NextResponse.json({ error: 'sceneId and imageUrl required' }, { status: 400 })

  const userId = user.id
  const db = await getDatabase()

  const check = db.exec(
    "SELECT sc.id FROM scenes sc JOIN scripts s ON sc.script_id = s.id JOIN projects p ON s.project_id = p.id WHERE sc.id = ? AND p.user_id = ?",
    [sceneId, userId]
  )
  if (!check.length || !check[0].values.length) return NextResponse.json({ error: 'Scene not found' }, { status: 404 })

  const imageId = uuid()
  db.run("UPDATE image_assets SET is_current = 0 WHERE scene_id = ?", [sceneId])
  db.run("INSERT INTO image_assets (id, scene_id, prompt, file_path, size, is_current) VALUES (?, ?, ?, ?, ?, 1)",
    [imageId, sceneId, prompt || '', imageUrl, size || '1024x768'])
  db.run("UPDATE scenes SET state = 'IMG_READY', error_message = NULL WHERE id = ?", [sceneId])
  saveDatabase()

  return NextResponse.json({ id: imageId, filePath: imageUrl })
}
