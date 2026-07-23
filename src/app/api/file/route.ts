import { createReadStream, statSync } from 'fs'
import { extname, join } from 'path'
import { Readable } from 'stream'
import { NextRequest } from 'next/server'
import { getDatabase } from '@/services/db.service'
import {
  requireAssetAccess,
  requireAuth,
  requireEpisodeInProject,
  requireProjectAccess,
  requireSceneAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'
import {
  getProjectDirectory,
  requireExistingProjectFile,
  sanitizeFilename,
} from '@/services/storage.service'

type FileKind =
  | 'project-cover'
  | 'character'
  | 'location'
  | 'scene-image'
  | 'scene-video'
  | 'output'

interface FileDescriptor {
  filePath: string
  ownerUserId: string
  projectId: string
  downloadName: string
  attachment: boolean
}

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
}

function requireId(req: NextRequest): string {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) throw new RouteError(400, 'id required')
  return id
}

function firstRow(
  rows: Array<{ values: Array<Array<string | number | null | Uint8Array>> }>,
): Array<string | number | null | Uint8Array> {
  if (!rows.length || !rows[0].values.length) throw new RouteError(404, '文件不存在')
  return rows[0].values[0]
}

async function resolveFileDescriptor(req: NextRequest): Promise<FileDescriptor> {
  const { userId } = requireAuth(req)
  const kind = req.nextUrl.searchParams.get('kind') as FileKind | null
  const db = await getDatabase()

  if (kind === 'project-cover') {
    const projectId = requireId(req)
    requireProjectAccess(db, projectId, userId, 'read')
    const row = firstRow(db.exec(
      'SELECT cover_image, user_id, name FROM projects WHERE id = ?',
      [projectId],
    ))
    return {
      filePath: String(row[0] || ''),
      ownerUserId: String(row[1]),
      projectId,
      downloadName: `${String(row[2])}_封面.png`,
      attachment: false,
    }
  }

  if (kind === 'character' || kind === 'location') {
    const assetId = requireId(req)
    requireAssetAccess(db, assetId, kind, userId, 'read')
    const table = kind === 'character' ? 'characters' : 'locations'
    const row = firstRow(db.exec(
      `SELECT a.reference_image, p.user_id, p.id, a.name
       FROM ${table} a
       JOIN projects p ON p.id = a.project_id
       WHERE a.id = ?`,
      [assetId],
    ))
    return {
      filePath: String(row[0] || ''),
      ownerUserId: String(row[1]),
      projectId: String(row[2]),
      downloadName: `${String(row[3])}.png`,
      attachment: false,
    }
  }

  if (kind === 'scene-image' || kind === 'scene-video') {
    const sceneId = requireId(req)
    requireSceneAccess(db, sceneId, userId, 'read')
    const mediaJoin = kind === 'scene-image'
      ? `JOIN image_assets media ON media.scene_id = sc.id AND media.is_current = 1`
      : `JOIN video_clips media ON media.scene_id = sc.id AND media.status = 'completed'`
    const ordering = kind === 'scene-image' ? '' : 'ORDER BY media.created_at DESC'
    const row = firstRow(db.exec(
      `SELECT media.file_path, p.user_id, p.id, e.episode_number, sc.scene_order
       FROM scenes sc
       JOIN episodes e ON e.id = sc.episode_id
       JOIN scripts s ON s.id = sc.script_id
       JOIN projects p ON p.id = s.project_id
       ${mediaJoin}
       WHERE sc.id = ?
       ${ordering}
       LIMIT 1`,
      [sceneId],
    ))
    const extension = kind === 'scene-image' ? 'png' : 'mp4'
    return {
      filePath: String(row[0] || ''),
      ownerUserId: String(row[1]),
      projectId: String(row[2]),
      downloadName: `第${String(row[3])}集_场景${Number(row[4]) + 1}.${extension}`,
      attachment: false,
    }
  }

  if (kind === 'output') {
    const projectId = req.nextUrl.searchParams.get('projectId')
    const episodeId = req.nextUrl.searchParams.get('episodeId')
    if (!projectId || !episodeId) throw new RouteError(400, 'projectId and episodeId required')
    requireEpisodeInProject(db, episodeId, projectId, userId)
    const row = firstRow(db.exec(
      `SELECT p.user_id, p.name, e.episode_number
       FROM projects p
       JOIN scripts s ON s.project_id = p.id
       JOIN episodes e ON e.script_id = s.id
       WHERE p.id = ? AND e.id = ?`,
      [projectId, episodeId],
    ))
    const ownerUserId = String(row[0])
    const downloadName = sanitizeFilename(
      `${String(row[1])}_第${String(row[2])}集_final.mp4`,
      'short-drama.mp4',
    )
    return {
      filePath: join(getProjectDirectory(ownerUserId, projectId), 'output', downloadName),
      ownerUserId,
      projectId,
      downloadName,
      attachment: true,
    }
  }

  throw new RouteError(400, '不支持的文件类型')
}

export async function GET(req: NextRequest) {
  try {
    const descriptor = await resolveFileDescriptor(req)
    if (!descriptor.filePath || descriptor.filePath.startsWith('http')) {
      throw new RouteError(404, '本地文件不存在')
    }

    let safePath: string
    try {
      safePath = requireExistingProjectFile(
        descriptor.filePath,
        descriptor.ownerUserId,
        descriptor.projectId,
      )
    } catch {
      throw new RouteError(404, '文件不存在')
    }

    const stat = statSync(safePath)
    const body = Readable.toWeb(createReadStream(safePath)) as ReadableStream<Uint8Array>
    const disposition = descriptor.attachment ? 'attachment' : 'inline'
    const filename = encodeURIComponent(sanitizeFilename(descriptor.downloadName))

    return new Response(body, {
      headers: {
        'Content-Type': MIME_TYPES[extname(safePath).toLowerCase()] || 'application/octet-stream',
        'Content-Length': String(stat.size),
        'Content-Disposition': `${disposition}; filename*=UTF-8''${filename}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
