import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { readFileSync } from 'fs'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { generateImage } from '@/services/agnes.service'
import { validateRemoteMediaUrl } from '@/services/remote-media.service'
import { requireExistingProjectFile } from '@/services/storage.service'
import {
  requireAuth,
  requireEpisodeAccess,
  requireSceneAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const episodeId = req.nextUrl.searchParams.get('episodeId')
    if (!episodeId) throw new RouteError(400, 'episodeId required')

    const db = await getDatabase()
    requireEpisodeAccess(db, episodeId, userId, 'read')
    const rows = db.exec(
      'SELECT id, script_id, description, dialogue, characters, duration, scene_order, state, error_message, retry_count FROM scenes WHERE episode_id = ? ORDER BY scene_order',
      [episodeId],
    )
    if (!rows.length || !rows[0].values.length) return NextResponse.json([])
    return NextResponse.json(rows[0].values.map(row => ({
      id: row[0],
      scriptId: row[1],
      description: row[2],
      dialogue: row[3],
      characters: JSON.parse(row[4] as string),
      duration: row[5],
      order: row[6],
      state: row[7],
      errorMessage: row[8],
      retryCount: row[9],
    })))
  } catch (error) {
    return routeErrorResponse(error)
  }
}

// Generate image for a scene
export async function POST(req: NextRequest) {
  try {
    const { apiKey, userId } = requireAuth(req)
    const { sceneId, action } = await req.json()
    if (typeof sceneId !== 'string' || action !== 'generateImage') {
      throw new RouteError(400, '请求参数无效')
    }

    const db = await getDatabase()
    requireSceneAccess(db, sceneId, userId, 'write')
    const rows = db.exec(
      `SELECT sc.description, p.id, p.aspect_ratio, p.user_id, p.output_path
       FROM scenes sc
       JOIN scripts s ON sc.script_id = s.id
       JOIN projects p ON s.project_id = p.id
       WHERE sc.id = ?`,
      [sceneId],
    )
    if (!rows.length || !rows[0].values.length) throw new RouteError(404, 'Scene not found')

    const description = rows[0].values[0][0] as string
    const projectId = rows[0].values[0][1] as string
    const aspectRatio = (rows[0].values[0][2] as string) || '16:9'
    const ownerUserId = rows[0].values[0][3] as string
    const legacyProjectPath = rows[0].values[0][4] as string
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
          if (ref?.startsWith('http')) {
            referenceImages.push(ref)
          } else if (ref) {
            try {
              const safePath = requireExistingProjectFile(
                ref,
                ownerUserId,
                projectId,
                legacyProjectPath,
              )
              referenceImages.push(`data:image/png;base64,${readFileSync(safePath).toString('base64')}`)
            } catch {}
          }
        }
      }
      if (locationName) {
        const locRows = db.exec("SELECT reference_image FROM locations WHERE project_id = ? AND name = ?", [projectId, locationName])
        if (locRows.length && locRows[0].values.length) {
          const ref = locRows[0].values[0][0] as string | null
          if (ref?.startsWith('http')) {
            referenceImages.push(ref)
          } else if (ref) {
            try {
              const safePath = requireExistingProjectFile(
                ref,
                ownerUserId,
                projectId,
                legacyProjectPath,
              )
              referenceImages.push(`data:image/png;base64,${readFileSync(safePath).toString('base64')}`)
            } catch {}
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
      const generatedUrl = await generateImage(
        enhancedPrompt,
        size,
        apiKey,
        referenceImages.length > 0 ? referenceImages : undefined,
      )
      const imageUrl = await validateRemoteMediaUrl(generatedUrl)

      const imageId = uuid()
      // Store URL directly, no server download
      db.run("UPDATE image_assets SET is_current = 0 WHERE scene_id = ?", [sceneId])
      db.run("INSERT INTO image_assets (id, scene_id, prompt, file_path, size, is_current) VALUES (?, ?, ?, ?, ?, 1)",
        [imageId, sceneId, enhancedPrompt, imageUrl, size])
      db.run("UPDATE scenes SET state = 'IMG_READY', error_message = NULL WHERE id = ?", [sceneId])
      saveDatabase()

      return NextResponse.json({ id: imageId, filePath: imageUrl, prompt: enhancedPrompt, size })
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片生成失败'
      db.run("UPDATE scenes SET state = 'ERROR', error_message = ? WHERE id = ?", [message, sceneId])
      saveDatabase()
      throw new RouteError(500, message)
    }
  } catch (error) {
    return routeErrorResponse(error)
  }
}
