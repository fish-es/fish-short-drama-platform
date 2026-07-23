import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getCurrentUser } from '@/services/auth.service'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })

  const { episodeId, scriptId, scenes } = await req.json()
  if (!episodeId || !scriptId || !scenes) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const userId = user.id
  const db = await getDatabase()

  const projCheck = db.exec(
    "SELECT p.id FROM projects p JOIN scripts s ON s.project_id = p.id JOIN episodes e ON e.script_id = s.id WHERE e.id = ? AND p.user_id = ?",
    [episodeId, userId]
  )
  if (!projCheck.length || !projCheck[0].values.length) return NextResponse.json({ error: '项目不存在' }, { status: 404 })

  const savedScenes: any[] = []
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i]
    const sceneId = uuid()
    db.run(
      'INSERT INTO scenes (id, episode_id, script_id, description, dialogue, characters, location, duration, scene_order, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [sceneId, episodeId, scriptId, s.description, s.dialogue, JSON.stringify(s.characters), s.location || '', s.duration, i, 'DRAFT']
    )
    savedScenes.push({
      id: sceneId, scriptId, description: s.description, dialogue: s.dialogue,
      characters: s.characters, duration: s.duration, order: i, state: 'DRAFT',
      errorMessage: null, retryCount: 0
    })
  }

  db.run("UPDATE episodes SET status = 'generated' WHERE id = ?", [episodeId])
  saveDatabase()

  return NextResponse.json({ scenes: savedScenes })
}
