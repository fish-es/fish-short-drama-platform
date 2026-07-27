import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { generateImage } from '@/services/agnes.service'
import { fetchRemoteMedia } from '@/services/remote-media.service'
import { getProjectDirectory } from '@/services/storage.service'
import {
  requireAssetAccess,
  requireAssetInProject,
  requireAuth,
  requireProjectAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const projectId = req.nextUrl.searchParams.get('projectId')
    const type = req.nextUrl.searchParams.get('type')
    if (!projectId || !['characters', 'locations'].includes(type || '')) {
      throw new RouteError(400, 'projectId 或资产类型无效')
    }

    const db = await getDatabase()
    requireProjectAccess(db, projectId, userId, 'read')
    if (type === 'characters') {
      const rows = db.exec(
        'SELECT id, name, description, voice_id, reference_image, keywords FROM characters WHERE project_id = ?',
        [projectId],
      )
      if (!rows.length || !rows[0].values.length) return NextResponse.json([])
      return NextResponse.json(rows[0].values.map(row => ({
        id: row[0],
        name: row[1],
        description: row[2],
        voiceId: row[3],
        referenceImage: row[4],
        keywords: row[5],
      })))
    }

    const rows = db.exec(
      'SELECT id, name, description, reference_image, keywords FROM locations WHERE project_id = ?',
      [projectId],
    )
    if (!rows.length || !rows[0].values.length) return NextResponse.json([])
    return NextResponse.json(rows[0].values.map(row => ({
      id: row[0],
      name: row[1],
      description: row[2],
      referenceImage: row[3],
      keywords: row[4],
    })))
  } catch (error) {
    return routeErrorResponse(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, userId } = requireAuth(req)
    const { id, type, keywords, projectId, action } = await req.json()
    if (
      action !== 'regenerate' ||
      typeof id !== 'string' ||
      typeof projectId !== 'string' ||
      !['character', 'location'].includes(type)
    ) {
      throw new RouteError(400, '请求参数无效')
    }

    const assetType = type as 'character' | 'location'
    const safeKeywords = typeof keywords === 'string' ? keywords.trim().slice(0, 2_000) : ''
    if (!safeKeywords) throw new RouteError(400, '关键词不能为空')

    const db = await getDatabase()
    requireProjectAccess(db, projectId, userId, 'write')
    requireAssetInProject(db, id, assetType, projectId, userId)
    const projectPath = getProjectDirectory(userId, projectId)
    mkdirSync(projectPath, { recursive: true })

    const isChar = assetType === 'character'
    const prompt = isChar
      ? `${safeKeywords}，面朝镜头，半身像，中性背景，高质量，细致面部特征`
      : `${safeKeywords}，广角镜头，电影感，高质量，无人物`
    const size = isChar ? '768x1024' : '1024x768'

    const imageUrl = await generateImage(prompt, size, apiKey)
    const media = await fetchRemoteMedia(imageUrl, {
      allowedContentTypes: ['image/'],
      maxBytes: 25 * 1024 * 1024,
    })

    const refDir = join(projectPath, 'references', isChar ? 'characters' : 'locations')
    if (!existsSync(refDir)) mkdirSync(refDir, { recursive: true })
    const filePath = join(refDir, `${id}.png`)
    writeFileSync(filePath, media.buffer)

    if (isChar) {
      db.run('UPDATE characters SET reference_image = ? WHERE id = ?', [filePath, id])
    } else {
      db.run('UPDATE locations SET reference_image = ? WHERE id = ?', [filePath, id])
    }
    saveDatabase()
    return NextResponse.json({ filePath })
  } catch (error) {
    return routeErrorResponse(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const { id, type, keywords } = await req.json()
    if (
      typeof id !== 'string' ||
      !['character', 'location'].includes(type) ||
      typeof keywords !== 'string'
    ) {
      throw new RouteError(400, '请求参数无效')
    }

    const assetType = type as 'character' | 'location'
    const db = await getDatabase()
    requireAssetAccess(db, id, assetType, userId, 'write')
    const table = assetType === 'character' ? 'characters' : 'locations'
    db.run(`UPDATE ${table} SET keywords = ? WHERE id = ?`, [keywords.trim().slice(0, 2_000), id])
    saveDatabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
