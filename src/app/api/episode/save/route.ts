import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import {
  requireAuth,
  requireEpisodeAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const { episodeId, scriptId, scenes } = await req.json()
    if (
      typeof episodeId !== 'string' ||
      typeof scriptId !== 'string' ||
      !Array.isArray(scenes) ||
      scenes.length === 0 ||
      scenes.length > 100
    ) {
      throw new RouteError(400, '请求参数无效')
    }

    const db = await getDatabase()
    requireEpisodeAccess(db, episodeId, userId, 'write')
    const episodeRows = db.exec('SELECT script_id FROM episodes WHERE id = ?', [episodeId])
    if (
      !episodeRows.length ||
      !episodeRows[0].values.length ||
      episodeRows[0].values[0][0] !== scriptId
    ) {
      throw new RouteError(400, '剧集与剧本不匹配')
    }

    const savedScenes: Array<{
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
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i] as Record<string, unknown>
      const description = typeof scene.description === 'string' ? scene.description.slice(0, 10_000) : ''
      const dialogue = typeof scene.dialogue === 'string' ? scene.dialogue.slice(0, 5_000) : ''
      const characters = Array.isArray(scene.characters)
        ? scene.characters.filter(value => typeof value === 'string').slice(0, 50)
        : []
      const location = typeof scene.location === 'string' ? scene.location.slice(0, 500) : ''
      const duration = typeof scene.duration === 'number'
        ? Math.min(60, Math.max(1, scene.duration))
        : 5
      const sceneId = uuid()
      db.run(
        'INSERT INTO scenes (id, episode_id, script_id, description, dialogue, characters, location, duration, scene_order, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [sceneId, episodeId, scriptId, description, dialogue, JSON.stringify(characters), location, duration, i, 'DRAFT'],
      )
      savedScenes.push({
        id: sceneId,
        scriptId,
        description,
        dialogue,
        characters,
        duration,
        order: i,
        state: 'DRAFT',
        errorMessage: null,
        retryCount: 0,
      })
    }

    db.run("UPDATE episodes SET status = 'generated' WHERE id = ?", [episodeId])
    saveDatabase()
    return NextResponse.json({ scenes: savedScenes })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
