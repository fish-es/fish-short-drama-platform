import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { generateImage } from '@/services/agnes.service'
import { generateOutline, parseOutlineResponse } from '@/services/script.service'
import { validateRemoteMediaUrl } from '@/services/remote-media.service'
import {
  requireAuth,
  requireProjectAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

export async function POST(req: NextRequest) {
  try {
    const { apiKey, userId } = requireAuth(req)
    const { prompt, projectId } = await req.json()
    if (typeof projectId !== 'string' || typeof prompt !== 'string' || !prompt.trim()) {
      throw new RouteError(400, '请求参数无效')
    }

    const db = await getDatabase()
    requireProjectAccess(db, projectId, userId, 'write')

    const projRows = db.exec('SELECT aspect_ratio FROM projects WHERE id = ?', [projectId])
    if (!projRows.length || !projRows[0].values.length) {
      throw new RouteError(404, 'Project not found')
    }
    const aspectRatio = (projRows[0].values[0][0] as string) || '16:9'

  // Generate outline with retry
  let parsed: ReturnType<typeof parseOutlineResponse> | null = null
  let outlineContent = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    outlineContent = await generateOutline(prompt, apiKey)
    try {
      parsed = parseOutlineResponse(outlineContent)
      break
    } catch {
      if (attempt >= 2) return NextResponse.json({ error: '大纲生成失败，请重试' }, { status: 500 })
    }
  }
  if (!parsed) return NextResponse.json({ error: '大纲生成失败' }, { status: 500 })

  // Save script
  const scriptId = uuid()
  db.run(
    'INSERT INTO scripts (id, project_id, content, synopsis, outline, total_episodes) VALUES (?, ?, ?, ?, ?, ?)',
    [scriptId, projectId, outlineContent, parsed.synopsis, outlineContent, parsed.totalEpisodes]
  )

  // Update project title
  db.run("UPDATE projects SET drama_title = ? WHERE id = ?", [parsed.title, projectId])

  // Create characters
  for (const char of parsed.characters) {
    const charId = uuid()
    db.run(
      'INSERT INTO characters (id, project_id, name, description, keywords, voice_id) VALUES (?, ?, ?, ?, ?, ?)',
      [charId, projectId, char.name, char.description, char.keywords || '', char.voiceId || '']
    )
  }

  // Create locations
  for (const loc of parsed.locations) {
    const locId = uuid()
    db.run(
      'INSERT INTO locations (id, project_id, name, description, keywords) VALUES (?, ?, ?, ?, ?)',
      [locId, projectId, loc.name, loc.description, loc.keywords || '']
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

  // Generate cover image
  let coverImage: string | null = null
  try {
    const coverSize = aspectRatio === '9:16' ? '768x1024' : aspectRatio === '1:1' ? '1024x1024' : '1024x768'
    const coverPrompt = `${parsed.title}，短剧封面海报，电影感，精美构图，主角特写，戏剧性光影`
    const coverUrl = await validateRemoteMediaUrl(
      await generateImage(coverPrompt, coverSize, apiKey),
    )
    db.run("UPDATE projects SET cover_image = ? WHERE id = ?", [coverUrl, projectId])
    saveDatabase()
    coverImage = coverUrl
  } catch {}

  // Generate character reference images (store URLs directly)
  for (const char of parsed.characters) {
    try {
      const charRows = db.exec("SELECT id FROM characters WHERE project_id = ? AND name = ?", [projectId, char.name])
      if (!charRows.length || !charRows[0].values.length) continue
      const charId = charRows[0].values[0][0] as string
      const charPrompt = `${char.keywords}，面朝镜头，半身像，中性背景，高质量，细致面部特征`
      const charUrl = await validateRemoteMediaUrl(
        await generateImage(charPrompt, '768x1024', apiKey),
      )
      db.run("UPDATE characters SET reference_image = ? WHERE id = ?", [charUrl, charId])
    } catch {}
  }

  // Generate location reference images (store URLs directly)
  for (const loc of parsed.locations) {
    try {
      const locRows = db.exec("SELECT id FROM locations WHERE project_id = ? AND name = ?", [projectId, loc.name])
      if (!locRows.length || !locRows[0].values.length) continue
      const locId = locRows[0].values[0][0] as string
      const locPrompt = `${loc.keywords}，广角镜头，电影感，高质量，无人物`
      const locUrl = await validateRemoteMediaUrl(
        await generateImage(locPrompt, '1024x768', apiKey),
      )
      db.run("UPDATE locations SET reference_image = ? WHERE id = ?", [locUrl, locId])
    } catch {}
  }

  saveDatabase()

    return NextResponse.json({ scriptId, episodes, title: parsed.title, coverImage })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
