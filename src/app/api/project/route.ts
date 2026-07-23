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

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const db = await getDatabase()
    const rows = db.exec(
      `SELECT id, name, created_at, status, aspect_ratio, cover_image,
              drama_title, is_public, user_id, project_type
       FROM projects
       WHERE user_id = ? OR is_public = 1
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
    if (!name || name.length > 100) throw new RouteError(400, '项目名称长度必须为 1-100 个字符')

    if (!existsSync(PROJECTS_DIR)) mkdirSync(PROJECTS_DIR, { recursive: true })
    const id = uuid()
    const outputPath = getProjectDirectory(userId, id)
    mkdirSync(outputPath, { recursive: true })

    const db = await getDatabase()
    db.run(
      'INSERT INTO projects (id, name, output_path, aspect_ratio, user_id, project_type) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, outputPath, aspectRatio, userId, projectType],
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
    const { id } = await req.json()
    if (typeof id !== 'string') throw new RouteError(400, '项目 ID 无效')

    const db = await getDatabase()
    requireProjectAccess(db, id, userId, 'write')
    const outputPath = getProjectDirectory(userId, id)

    db.run('BEGIN')
    try {
      db.run('DELETE FROM image_assets WHERE scene_id IN (SELECT id FROM scenes WHERE script_id IN (SELECT id FROM scripts WHERE project_id = ?))', [id])
      db.run('DELETE FROM video_clips WHERE scene_id IN (SELECT id FROM scenes WHERE script_id IN (SELECT id FROM scripts WHERE project_id = ?))', [id])
      db.run('DELETE FROM voice_tracks WHERE scene_id IN (SELECT id FROM scenes WHERE script_id IN (SELECT id FROM scripts WHERE project_id = ?))', [id])
      db.run('DELETE FROM scenes WHERE script_id IN (SELECT id FROM scripts WHERE project_id = ?)', [id])
      db.run('DELETE FROM episodes WHERE script_id IN (SELECT id FROM scripts WHERE project_id = ?)', [id])
      db.run('DELETE FROM characters WHERE project_id = ?', [id])
      db.run('DELETE FROM locations WHERE project_id = ?', [id])
      db.run('DELETE FROM scripts WHERE project_id = ?', [id])
      db.run('DELETE FROM projects WHERE id = ? AND user_id = ?', [id, userId])
      db.run('COMMIT')
    } catch (error) {
      db.run('ROLLBACK')
      throw error
    }
    saveDatabase()

    if (existsSync(outputPath)) rmSync(outputPath, { recursive: true, force: true })
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeErrorResponse(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const { id, isPublic } = await req.json()
    if (typeof id !== 'string' || typeof isPublic !== 'boolean') {
      throw new RouteError(400, '请求参数无效')
    }

    const db = await getDatabase()
    requireProjectAccess(db, id, userId, 'write')
    db.run('UPDATE projects SET is_public = ? WHERE id = ?', [isPublic ? 1 : 0, id])
    saveDatabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
