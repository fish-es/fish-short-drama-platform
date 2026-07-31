import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { mkdirSync, existsSync, rmSync } from 'fs'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getProjectDirectory, PROJECTS_DIR } from '@/services/storage.service'
import {
  requireAuth,
  requireProjectAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

// Permanently delete a project and all its associated data (cascade + rmSync).
function permanentlyDeleteProject(db: any, projectId: string, outputPath: string): void {
  db.run('BEGIN')
  try {
    db.run('DELETE FROM image_assets WHERE scene_id IN (SELECT id FROM scenes WHERE script_id IN (SELECT id FROM scripts WHERE project_id = ?))', [projectId])
    db.run('DELETE FROM video_clips WHERE scene_id IN (SELECT id FROM scenes WHERE script_id IN (SELECT id FROM scripts WHERE project_id = ?))', [projectId])
    db.run('DELETE FROM voice_tracks WHERE scene_id IN (SELECT id FROM scenes WHERE script_id IN (SELECT id FROM scripts WHERE project_id = ?))', [projectId])
    db.run('DELETE FROM scenes WHERE script_id IN (SELECT id FROM scripts WHERE project_id = ?)', [projectId])
    db.run('DELETE FROM episodes WHERE script_id IN (SELECT id FROM scripts WHERE project_id = ?)', [projectId])
    db.run('DELETE FROM characters WHERE project_id = ?', [projectId])
    db.run('DELETE FROM locations WHERE project_id = ?', [projectId])
    db.run('DELETE FROM scripts WHERE project_id = ?', [projectId])
    db.run('DELETE FROM projects WHERE id = ?', [projectId])
    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
  if (existsSync(outputPath)) rmSync(outputPath, { recursive: true, force: true })
}

// Auto-cleanup: permanently delete projects that have been in the recycle bin for over 30 days.
// Returns the number of projects cleaned up.
function cleanupRecycleBin(db: any): number {
  const r = db.exec("SELECT id, output_path FROM projects WHERE status = 'deleted' AND deleted_at IS NOT NULL AND deleted_at < datetime('now', '-30 days')")
  if (!r.length) return 0
  const rows = r[0].values
  rows.forEach((row: any) => {
    permanentlyDeleteProject(db, String(row[0]), String(row[1]))
  })
  return rows.length
}

export async function GET(req: NextRequest) {
  try {
    // Auth optional: no key → only public projects visible.
    const apiKey = req.headers.get('x-api-key')?.trim() || ''
    const userId = apiKey ? requireAuth(req).userId : ''
    const db = await getDatabase()

    // Auto-cleanup expired recycle bin items before listing.
    const cleaned = cleanupRecycleBin(db)
    if (cleaned > 0) saveDatabase()

    const isDeletedView = req.nextUrl.searchParams.get('deleted') === '1'

    if (isDeletedView) {
      const rows = db.exec(
        `SELECT id, name, created_at, status, aspect_ratio, cover_image,
                drama_title, is_public, user_id, project_type, target_duration, deleted_at
         FROM projects
         WHERE status = 'deleted' AND user_id = ?
         ORDER BY deleted_at DESC`,
        [userId],
      )
      if (!rows.length || !rows[0].values.length) return NextResponse.json([])
      const projects = rows[0].values.map(row => ({
        id: row[0],
        name: row[1],
        createdAt: row[2],
        status: row[3],
        outputPath: '',
        aspectRatio: row[4] || '16:9',
        coverImage: row[5],
        dramaTitle: row[6],
        isPublic: !!row[7],
        isOwner: row[8] === userId,
        projectType: row[9] || 'drama',
        targetDuration: row[10] || 0,
        deletedAt: row[11],
      }))
      return NextResponse.json(projects)
    }

    const rows = db.exec(
      `SELECT id, name, created_at, status, aspect_ratio, cover_image,
              drama_title, is_public, user_id, project_type, target_duration
       FROM projects
       WHERE (user_id = ? OR is_public = 1) AND status != 'deleted'
       ORDER BY created_at DESC`,
      [userId],
    )
    if (!rows.length || !rows[0].values.length) return NextResponse.json([])
    const projects = rows[0].values.map(row => ({
      id: row[0],
      name: row[1],
      createdAt: row[2],
      status: row[3],
      outputPath: '',
      aspectRatio: row[4] || '16:9',
      coverImage: row[5],
      dramaTitle: row[6],
      isPublic: !!row[7],
      isOwner: row[8] === userId,
      projectType: row[9] || 'drama',
      targetDuration: row[10] || 0,
    }))
    return NextResponse.json(projects)
  } catch (error) {
    return routeErrorResponse(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const aspectRatio = ['9:16', '16:9', '1:1'].includes(body.aspectRatio) ? body.aspectRatio : '16:9'
    const projectType = ['drama', 'video'].includes(body.projectType) ? body.projectType : 'drama'
    const targetDuration = projectType === 'video'
      ? Math.min(600, Math.max(0, Math.floor(Number(body.targetDuration) || 0)))
      : 0
    if (!name || name.length > 100) throw new RouteError(400, '项目名称长度必须为 1-100 个字符')

    if (!existsSync(PROJECTS_DIR)) mkdirSync(PROJECTS_DIR, { recursive: true })
    const id = uuid()
    const outputPath = getProjectDirectory(userId, id)
    mkdirSync(outputPath, { recursive: true })

    const db = await getDatabase()
    db.run(
      'INSERT INTO projects (id, name, output_path, aspect_ratio, user_id, project_type, target_duration) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, outputPath, aspectRatio, userId, projectType, targetDuration],
    )
    saveDatabase()

    return NextResponse.json({
      id,
      name,
      createdAt: new Date().toISOString(),
      status: 'active',
      outputPath: '',
      aspectRatio,
      coverImage: null,
      dramaTitle: null,
      projectType,
      targetDuration,
      isOwner: true,
      isPublic: false,
    })
  } catch (error) {
    return routeErrorResponse(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const body = await req.json()
    const { id, permanent } = body
    if (typeof id !== 'string') throw new RouteError(400, '项目 ID 无效')

    const db = await getDatabase()
    requireProjectAccess(db, id, userId, 'write')

    if (permanent === true) {
      // Permanently delete: cascade + rmSync.
      permanentlyDeleteProject(db, id, getProjectDirectory(userId, id))
      saveDatabase()
      return NextResponse.json({ success: true })
    }

    // Soft delete: move to recycle bin. No cascade, no rmSync.
    db.run("UPDATE projects SET status = 'deleted', deleted_at = datetime('now') WHERE id = ? AND user_id = ?", [id, userId])
    cleanupRecycleBin(db)
    saveDatabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeErrorResponse(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const { id, isPublic, dramaTitle } = await req.json()
    if (typeof id !== 'string') {
      throw new RouteError(400, '请求参数无效')
    }

    const db = await getDatabase()
    requireProjectAccess(db, id, userId, 'write')
    if (typeof isPublic === 'boolean') {
      db.run('UPDATE projects SET is_public = ? WHERE id = ?', [isPublic ? 1 : 0, id])
    }
    if (typeof dramaTitle === 'string') {
      const t = dramaTitle.trim().slice(0, 100)
      if (t) db.run('UPDATE projects SET drama_title = ? WHERE id = ?', [t, id])
    }
    saveDatabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
