import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { generateEpisodeScenes, parseEpisodeScenesResponse, parseOutlineResponse } from '@/services/script.service'
import {
  requireAuth,
  requireEpisodeAccess,
  requireScriptAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const scriptId = req.nextUrl.searchParams.get('scriptId')
    if (!scriptId) throw new RouteError(400, 'scriptId required')

    const db = await getDatabase()
    requireScriptAccess(db, scriptId, userId, 'read')
    const rows = db.exec(
      'SELECT id, episode_number, title, summary, status FROM episodes WHERE script_id = ? ORDER BY episode_number',
      [scriptId],
    )
    if (!rows.length || !rows[0].values.length) return NextResponse.json([])
    return NextResponse.json(rows[0].values.map(row => ({
      id: row[0],
      number: row[1],
      title: row[2],
      summary: row[3],
      status: row[4],
    })))
  } catch (error) {
    return routeErrorResponse(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, userId } = requireAuth(req)
    const { episodeId } = await req.json()
    if (typeof episodeId !== 'string') throw new RouteError(400, 'episodeId required')

    const db = await getDatabase()
    requireEpisodeAccess(db, episodeId, userId, 'write')

    const epRows = db.exec(
      'SELECT episode_number, title, summary, script_id FROM episodes WHERE id = ?',
      [episodeId],
    )
    if (!epRows.length || !epRows[0].values.length) throw new RouteError(404, 'Episode not found')
    const epNumber = epRows[0].values[0][0] as number
    const scriptId = epRows[0].values[0][3] as string

    const scriptRows = db.exec('SELECT outline FROM scripts WHERE id = ?', [scriptId])
    if (!scriptRows.length || !scriptRows[0].values.length) {
      throw new RouteError(404, 'Script not found')
    }
    const outlineContent = scriptRows[0].values[0][0] as string
    const outline = parseOutlineResponse(outlineContent)

    const prevRows = db.exec(
      'SELECT summary FROM episodes WHERE script_id = ? AND episode_number < ? ORDER BY episode_number',
      [scriptId, epNumber],
    )
    const previousSummary = prevRows.length && prevRows[0].values.length
      ? prevRows[0].values.map(row => String(row[0])).join(' → ')
      : ''

    let parsed: ReturnType<typeof parseEpisodeScenesResponse> | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const content = await generateEpisodeScenes(outline, epNumber, previousSummary, apiKey)
      try {
        parsed = parseEpisodeScenesResponse(content)
        break
      } catch {
        if (attempt >= 2) throw new RouteError(500, `第 ${epNumber} 集生成失败`)
      }
    }
    if (!parsed) throw new RouteError(500, '生成失败')

    const scenes: Array<{
      id: string
      scriptId: string
      description: string
      dialogue: string
      characters: string[]
      duration: number
      order: number
      state: string
      errorMessage: null
      retryCount: number
    }> = []
    for (let i = 0; i < parsed.scenes.length; i++) {
      const scene = parsed.scenes[i]
      const sceneId = uuid()
      db.run(
        'INSERT INTO scenes (id, episode_id, script_id, description, dialogue, characters, location, duration, scene_order, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [sceneId, episodeId, scriptId, scene.description, scene.dialogue, JSON.stringify(scene.characters), scene.location || '', scene.duration, i, 'DRAFT'],
      )
      scenes.push({
        id: sceneId,
        scriptId,
        description: scene.description,
        dialogue: scene.dialogue,
        characters: scene.characters,
        duration: scene.duration,
        order: i,
        state: 'DRAFT',
        errorMessage: null,
        retryCount: 0,
      })
    }

    db.run("UPDATE episodes SET status = 'generated' WHERE id = ?", [episodeId])
    saveDatabase()

    return NextResponse.json({ scenes })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
