import { readFileSync } from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/services/db.service'
import { fetchRemoteMedia } from '@/services/remote-media.service'
import { requireExistingProjectFile } from '@/services/storage.service'
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
      `SELECT sc.description, sc.dialogue, sc.duration, p.aspect_ratio, p.id, p.user_id,
              p.output_path
       FROM scenes sc
       JOIN scripts s ON sc.script_id = s.id
       JOIN projects p ON s.project_id = p.id
       WHERE sc.id = ?`,
      [sceneId],
    )
    if (!rows.length || !rows[0].values.length) throw new RouteError(404, 'Scene not found')

    const description = rows[0].values[0][0] as string
    const dialogue = rows[0].values[0][1] as string || ''
    const duration = rows[0].values[0][2] as number || 5
    const aspectRatio = (rows[0].values[0][3] as string) || '16:9'
    const projectId = rows[0].values[0][4] as string
    const ownerUserId = rows[0].values[0][5] as string
    const legacyProjectPath = rows[0].values[0][6] as string

    const imgRows = db.exec(
      'SELECT file_path FROM image_assets WHERE scene_id = ? AND is_current = 1',
      [sceneId],
    )
    if (!imgRows.length || !imgRows[0].values.length) {
      throw new RouteError(400, '场景没有可用图片')
    }
    const imagePath = imgRows[0].values[0][0] as string

    const cleanDialogue = dialogue.replace(/^[一-龥\w]+[：:]\s*/gm, '').trim()
    const dialogueLength = cleanDialogue.length
    const minSeconds = Math.max(duration, dialogueLength > 0 ? Math.ceil(dialogueLength / 3) + 1 : 5)
    const targetFrames = minSeconds * 24
    const numFrames = Math.min(441, Math.floor((targetFrames - 1) / 8) * 8 + 1)

    const langPrefix = '[语言要求：本视频中所有角色必须且只能说中文普通话，禁止出现任何英文对话] '
    const videoPrompt = cleanDialogue
      ? `${langPrefix}${description}。角色正在用中文普通话说："${cleanDialogue}"。注意：角色说的每一个字都必须是中文，绝对不能说英文。`
      : `${langPrefix}${description}。注意：如果角色有任何发声，必须是中文普通话，禁止英文。`

    const dims: Record<string, { width: number; height: number }> = {
      '9:16': { width: 768, height: 1152 },
      '16:9': { width: 1152, height: 768 },
      '1:1': { width: 1024, height: 1024 },
    }
    const { width, height } = dims[aspectRatio] || dims['16:9']

    let imageBuffer: Buffer
    if (imagePath.startsWith('http')) {
      const media = await fetchRemoteMedia(imagePath, {
        allowedContentTypes: ['image/'],
        maxBytes: 25 * 1024 * 1024,
      })
      imageBuffer = media.buffer
    } else {
      const safePath = requireExistingProjectFile(
        imagePath,
        ownerUserId,
        projectId,
        legacyProjectPath,
      )
      imageBuffer = readFileSync(safePath)
    }

    return NextResponse.json({
      sceneId,
      imageBase64: `data:image/png;base64,${imageBuffer.toString('base64')}`,
      prompt: videoPrompt,
      width,
      height,
      numFrames,
    })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
