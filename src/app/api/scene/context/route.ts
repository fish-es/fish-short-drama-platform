import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/services/db.service'
import { validateRemoteMediaUrl } from '@/services/remote-media.service'
import {
  requireAuth,
  requireSceneAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const sceneId = req.nextUrl.searchParams.get('sceneId')
    if (!sceneId) throw new RouteError(400, 'sceneId required')

    const db = await getDatabase()
    requireSceneAccess(db, sceneId, userId, 'write')
    const rows = db.exec(
      `SELECT sc.description, p.id, p.aspect_ratio
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

    const sizeMap: Record<string, string> = { '9:16': '768x1024', '16:9': '1024x768', '1:1': '1024x1024' }
    const size = sizeMap[aspectRatio] || '1024x768'

    const referenceImages: string[] = []
    const sceneData = db.exec('SELECT characters, location FROM scenes WHERE id = ?', [sceneId])
    let enhancedPrompt = description

    if (sceneData.length && sceneData[0].values.length) {
      const charNames: string[] = JSON.parse(sceneData[0].values[0][0] as string || '[]')
      const locationName = sceneData[0].values[0][1] as string || ''
      const parts: string[] = []

      for (const name of charNames) {
        const charRows = db.exec(
          'SELECT reference_image, keywords FROM characters WHERE project_id = ? AND name = ?',
          [projectId, name],
        )
        if (charRows.length && charRows[0].values.length) {
          const ref = charRows[0].values[0][0] as string | null
          if (ref?.startsWith('http')) {
            try {
              referenceImages.push(await validateRemoteMediaUrl(ref))
            } catch {}
          }
          const keywords = charRows[0].values[0][1] as string
          if (keywords) parts.push(keywords)
        }
      }
      if (locationName) {
        const locRows = db.exec(
          'SELECT reference_image, keywords FROM locations WHERE project_id = ? AND name = ?',
          [projectId, locationName],
        )
        if (locRows.length && locRows[0].values.length) {
          const ref = locRows[0].values[0][0] as string | null
          if (ref?.startsWith('http')) {
            try {
              referenceImages.push(await validateRemoteMediaUrl(ref))
            } catch {}
          }
          const keywords = locRows[0].values[0][1] as string
          if (keywords) parts.push(keywords)
        }
      }
      if (parts.length > 0) enhancedPrompt = `${description}, ${parts.join(', ')}`
    }

    return NextResponse.json({ sceneId, prompt: enhancedPrompt, size, referenceImages })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
