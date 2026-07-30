import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { validateRemoteMediaUrl } from '@/services/remote-media.service'
import {
  requireAuth,
  requireProjectAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

async function validateOptionalImage(value: unknown): Promise<string | null> {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new RouteError(400, '图片 URL 无效')
  return validateRemoteMediaUrl(value)
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const {
      projectId,
      outlineContent,
      parsed,
      coverImage,
      characterImages,
      locationImages,
    } = await req.json()
    if (
      typeof projectId !== 'string' ||
      typeof outlineContent !== 'string' ||
      !parsed ||
      !Array.isArray(parsed.characters) ||
      !Array.isArray(parsed.locations) ||
      !Array.isArray(parsed.episodes)
    ) {
      throw new RouteError(400, 'Missing or invalid fields')
    }

    const safeCoverImage = await validateOptionalImage(coverImage)
    const safeCharacterImages = await Promise.all(
      (Array.isArray(characterImages) ? characterImages : []).map(validateOptionalImage),
    )
    const safeLocationImages = await Promise.all(
      (Array.isArray(locationImages) ? locationImages : []).map(validateOptionalImage),
    )

    const db = await getDatabase()
    requireProjectAccess(db, projectId, userId, 'write')

  // Save script
  const scriptId = uuid()
  db.run(
    'INSERT INTO scripts (id, project_id, content, synopsis, outline, total_episodes) VALUES (?, ?, ?, ?, ?, ?)',
    [scriptId, projectId, outlineContent, parsed.synopsis, outlineContent, parsed.totalEpisodes]
  )

  // Update project title
  db.run("UPDATE projects SET drama_title = ? WHERE id = ?", [parsed.title, projectId])

  // Save cover image
  if (safeCoverImage) {
    db.run("UPDATE projects SET cover_image = ? WHERE id = ?", [safeCoverImage, projectId])
  }

  // Create characters
  for (let i = 0; i < parsed.characters.length; i++) {
    const char = parsed.characters[i]
    const charId = uuid()
    const refImage = safeCharacterImages[i] || null
    db.run(
      'INSERT INTO characters (id, project_id, name, description, keywords, voice_id, reference_image) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [charId, projectId, char.name, char.description, char.keywords || '', char.voiceId || '', refImage]
    )
  }

  // Create locations
  for (let i = 0; i < parsed.locations.length; i++) {
    const loc = parsed.locations[i]
    const locId = uuid()
    const refImage = safeLocationImages[i] || null
    db.run(
      'INSERT INTO locations (id, project_id, name, description, keywords, reference_image) VALUES (?, ?, ?, ?, ?, ?)',
      [locId, projectId, loc.name, loc.description, loc.keywords || '', refImage]
    )
  }

  // Create episodes
  const episodes: Array<{
    id: string
    number: number
    title: string
    summary: string
    status: string
  }> = []
  for (const ep of parsed.episodes) {
    const epId = uuid()
    db.run(
      'INSERT INTO episodes (id, script_id, episode_number, title, summary, status) VALUES (?, ?, ?, ?, ?, ?)',
      [epId, scriptId, ep.number, ep.title, ep.summary, 'pending']
    )
    episodes.push({ id: epId, number: ep.number, title: ep.title, summary: ep.summary, status: 'pending' })
  }

  saveDatabase()

    return NextResponse.json({
      scriptId,
      episodes,
      title: parsed.title,
      coverImage: safeCoverImage,
    })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
