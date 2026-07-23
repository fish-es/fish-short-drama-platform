import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { generateEpisodeScenes, parseEpisodeScenesResponse, parseOutlineResponse } from '@/services/script.service'
import { getCurrentUser } from '@/services/auth.service'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const scriptId = req.nextUrl.searchParams.get('scriptId')
  if (!scriptId) return NextResponse.json({ error: 'scriptId required' }, { status: 400 })

  const db = await getDatabase()
  const rows = db.exec(
    `SELECT e.id, e.episode_number, e.title, e.summary, e.status
     FROM episodes e JOIN scripts s ON s.id = e.script_id JOIN projects p ON p.id = s.project_id
     WHERE e.script_id = ? AND (p.user_id = ? OR p.is_public = 1) ORDER BY e.episode_number`,
    [scriptId, user.id]
  )
  if (!rows.length || !rows[0].values.length) return NextResponse.json([])
  return NextResponse.json(rows[0].values.map((row: any) => ({
    id: row[0], number: row[1], title: row[2], summary: row[3], status: row[4]
  })))
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const { episodeId, projectId } = await req.json()
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: '请先设置 API Key' }, { status: 400 })

  const db = await getDatabase()

  // Verify ownership
  const userId = user.id
  const projCheck = db.exec(
    "SELECT p.id FROM projects p JOIN scripts s ON s.project_id = p.id JOIN episodes e ON e.script_id = s.id WHERE e.id = ? AND p.user_id = ?",
    [episodeId, userId]
  )
  if (!projCheck.length || !projCheck[0].values.length) return NextResponse.json({ error: '项目不存在' }, { status: 404 })

  const epRows = db.exec("SELECT episode_number, title, summary, script_id FROM episodes WHERE id = ?", [episodeId])
  if (!epRows.length || !epRows[0].values.length) return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
  const epNumber = epRows[0].values[0][0] as number
  const scriptId = epRows[0].values[0][3] as string

  const scriptRows = db.exec("SELECT outline FROM scripts WHERE id = ?", [scriptId])
  if (!scriptRows.length) return NextResponse.json({ error: 'Script not found' }, { status: 404 })
  const outlineContent = scriptRows[0].values[0][0] as string
  const outline = parseOutlineResponse(outlineContent)

  const prevRows = db.exec(
    "SELECT summary FROM episodes WHERE script_id = ? AND episode_number < ? ORDER BY episode_number",
    [scriptId, epNumber]
  )
  const previousSummary = prevRows.length && prevRows[0].values.length
    ? prevRows[0].values.map((r: any) => r[0]).join(' → ')
    : ''

  // Generate with retry
  let parsed: ReturnType<typeof parseEpisodeScenesResponse> | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const content = await generateEpisodeScenes(outline, epNumber, previousSummary, apiKey)
    try {
      parsed = parseEpisodeScenesResponse(content)
      break
    } catch {
      if (attempt >= 2) return NextResponse.json({ error: `第 ${epNumber} 集生成失败` }, { status: 500 })
    }
  }
  if (!parsed) return NextResponse.json({ error: '生成失败' }, { status: 500 })

  const scenes: any[] = []
  for (let i = 0; i < parsed.scenes.length; i++) {
    const s = parsed.scenes[i]
    const sceneId = uuid()
    db.run(
      'INSERT INTO scenes (id, episode_id, script_id, description, dialogue, characters, location, duration, scene_order, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [sceneId, episodeId, scriptId, s.description, s.dialogue, JSON.stringify(s.characters), s.location || '', s.duration, i, 'DRAFT']
    )
    scenes.push({
      id: sceneId, scriptId, description: s.description, dialogue: s.dialogue,
      characters: s.characters, duration: s.duration, order: i, state: 'DRAFT',
      errorMessage: null, retryCount: 0
    })
  }

  db.run("UPDATE episodes SET status = 'generated' WHERE id = ?", [episodeId])
  saveDatabase()

  return NextResponse.json({ scenes })
}
