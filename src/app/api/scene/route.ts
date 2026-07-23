import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { join } from 'path'
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { generateImage } from '@/services/agnes.service'
import { getCurrentUser } from '@/services/auth.service'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const episodeId = req.nextUrl.searchParams.get('episodeId')
  if (!episodeId) return NextResponse.json({ error: 'episodeId required' }, { status: 400 })

  const db = await getDatabase()
  const rows = db.exec(
    `SELECT sc.id, sc.script_id, sc.description, sc.dialogue, sc.characters, sc.duration, sc.scene_order, sc.state, sc.error_message, sc.retry_count
     FROM scenes sc JOIN scripts s ON s.id = sc.script_id JOIN projects p ON p.id = s.project_id
     WHERE sc.episode_id = ? AND (p.user_id = ? OR p.is_public = 1) ORDER BY sc.scene_order`,
    [episodeId, user.id]
  )
  if (!rows.length || !rows[0].values.length) return NextResponse.json([])
  return NextResponse.json(rows[0].values.map(row => ({
    id: row[0], scriptId: row[1], description: row[2], dialogue: row[3],
    characters: JSON.parse(row[4] as string), duration: row[5], order: row[6],
    state: row[7], errorMessage: row[8], retryCount: row[9]
  })))
}

// Generate image for a scene
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const { sceneId, action } = await req.json()
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: '请先设置 API Key' }, { status: 400 })

  const db = await getDatabase()

  if (action === 'generateImage') {
    const userId = user.id
    const rows = db.exec(
      "SELECT sc.description, p.output_path, p.id, p.aspect_ratio FROM scenes sc JOIN scripts s ON sc.script_id = s.id JOIN projects p ON s.project_id = p.id WHERE sc.id = ? AND p.user_id = ?",
      [sceneId, userId]
    )
    if (!rows.length || !rows[0].values.length) return NextResponse.json({ error: 'Scene not found' }, { status: 404 })

    const description = rows[0].values[0][0] as string
    const projectPath = rows[0].values[0][1] as string
    const projectId = rows[0].values[0][2] as string
    const aspectRatio = (rows[0].values[0][3] as string) || '16:9'
    const sizeMap: Record<string, string> = { '9:16': '768x1024', '16:9': '1024x768', '1:1': '1024x1024' }
    const size = sizeMap[aspectRatio] || '1024x768'

    // Collect reference images
    const referenceImages: string[] = []
    const sceneData = db.exec("SELECT characters, location FROM scenes WHERE id = ?", [sceneId])
    if (sceneData.length && sceneData[0].values.length) {
      const charNames: string[] = JSON.parse(sceneData[0].values[0][0] as string || '[]')
      const locationName = sceneData[0].values[0][1] as string || ''

      for (const name of charNames) {
        const charRows = db.exec("SELECT reference_image FROM characters WHERE project_id = ? AND name = ?", [projectId, name])
        if (charRows.length && charRows[0].values.length) {
          const ref = charRows[0].values[0][0] as string | null
          if (ref && existsSync(ref)) {
            referenceImages.push(`data:image/png;base64,${readFileSync(ref).toString('base64')}`)
          }
        }
      }
      if (locationName) {
        const locRows = db.exec("SELECT reference_image FROM locations WHERE project_id = ? AND name = ?", [projectId, locationName])
        if (locRows.length && locRows[0].values.length) {
          const ref = locRows[0].values[0][0] as string | null
          if (ref && existsSync(ref)) {
            referenceImages.push(`data:image/png;base64,${readFileSync(ref).toString('base64')}`)
          }
        }
      }
    }

    // Build enhanced prompt with keywords
    let enhancedPrompt = description
    const sceneInfo = db.exec("SELECT characters, location FROM scenes WHERE id = ?", [sceneId])
    if (sceneInfo.length && sceneInfo[0].values.length) {
      const charNames: string[] = JSON.parse(sceneInfo[0].values[0][0] as string || '[]')
      const locName = sceneInfo[0].values[0][1] as string || ''
      const parts: string[] = []
      for (const name of charNames) {
        const kw = db.exec("SELECT keywords FROM characters WHERE project_id = ? AND name = ?", [projectId, name])
        if (kw.length && kw[0].values.length && kw[0].values[0][0]) parts.push(kw[0].values[0][0] as string)
      }
      if (locName) {
        const kw = db.exec("SELECT keywords FROM locations WHERE project_id = ? AND name = ?", [projectId, locName])
        if (kw.length && kw[0].values.length && kw[0].values[0][0]) parts.push(kw[0].values[0][0] as string)
      }
      if (parts.length > 0) enhancedPrompt = `${description}, ${parts.join(', ')}`
    }

    db.run("UPDATE scenes SET state = 'GENERATING_IMG', error_message = NULL WHERE id = ?", [sceneId])
    saveDatabase()

    try {
      const imageUrl = await generateImage(enhancedPrompt, size, apiKey, referenceImages.length > 0 ? referenceImages : undefined)

      const imageId = uuid()
      // Store URL directly, no server download
      db.run("UPDATE image_assets SET is_current = 0 WHERE scene_id = ?", [sceneId])
      db.run("INSERT INTO image_assets (id, scene_id, prompt, file_path, size, is_current) VALUES (?, ?, ?, ?, ?, 1)",
        [imageId, sceneId, enhancedPrompt, imageUrl, size])
      db.run("UPDATE scenes SET state = 'IMG_READY', error_message = NULL WHERE id = ?", [sceneId])
      saveDatabase()

      return NextResponse.json({ id: imageId, filePath: imageUrl, prompt: enhancedPrompt, size })
    } catch (e: any) {
      db.run("UPDATE scenes SET state = 'ERROR', error_message = ? WHERE id = ?", [e.message, sceneId])
      saveDatabase()
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
