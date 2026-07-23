import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { join } from 'path'
import { mkdirSync, existsSync, rmSync } from 'fs'
import { homedir } from 'os'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getCurrentUser } from '@/services/auth.service'

const PROJECTS_DIR = join(homedir(), 'ShortDrama')

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const db = await getDatabase()
  // Show own projects + other public projects
  const rows = db.exec("SELECT id, name, created_at, status, output_path, aspect_ratio, cover_image, drama_title, is_public, user_id, project_type FROM projects WHERE user_id = ? OR is_public = 1 ORDER BY created_at DESC", [user.id])
  if (!rows.length || !rows[0].values.length) return NextResponse.json([])
  const projects = rows[0].values.map(row => ({
    id: row[0], name: row[1], createdAt: row[2], status: row[3],
    outputPath: row[4], aspectRatio: row[5] || '16:9',
    coverImage: row[6], dramaTitle: row[7], isPublic: !!row[8], isOwner: row[9] === user.id, projectType: row[10] || 'drama'
  }))
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const { name, aspectRatio = '16:9', projectType = 'drama' } = await req.json()
  const normalizedName = typeof name === 'string' ? name.trim() : ''
  if (!normalizedName || normalizedName.length > 80) return NextResponse.json({ error: '项目名称长度应为 1 到 80 个字符' }, { status: 400 })
  if (!existsSync(PROJECTS_DIR)) mkdirSync(PROJECTS_DIR, { recursive: true })

  const db = await getDatabase()
  const id = uuid()
  const outputPath = join(PROJECTS_DIR, user.id, id)
  if (!existsSync(outputPath)) mkdirSync(outputPath, { recursive: true })

  db.run('INSERT INTO projects (id, name, output_path, aspect_ratio, user_id, project_type) VALUES (?, ?, ?, ?, ?, ?)', [id, normalizedName, outputPath, aspectRatio, user.id, projectType])
  saveDatabase()

  return NextResponse.json({ id, name: normalizedName, createdAt: new Date().toISOString(), status: 'active', outputPath, aspectRatio, coverImage: null, dramaTitle: null, isPublic: false, isOwner: true, projectType })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const { id } = await req.json()
  const db = await getDatabase()
  const rows = db.exec('SELECT output_path FROM projects WHERE id = ? AND user_id = ?', [id, user.id])
  if (!rows.length || !rows[0].values.length) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 })
  }
  const outputPath = rows[0].values[0][0] as string
  if (existsSync(outputPath)) rmSync(outputPath, { recursive: true, force: true })
  db.run('DELETE FROM projects WHERE id = ? AND user_id = ?', [id, user.id])
  saveDatabase()
  return NextResponse.json({ success: true })
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const { id, isPublic } = await req.json()
  const db = await getDatabase()

  const check = db.exec('SELECT id FROM projects WHERE id = ? AND user_id = ?', [id, user.id])
  if (!check.length || !check[0].values.length) return NextResponse.json({ error: '项目不存在' }, { status: 404 })

  db.run('UPDATE projects SET is_public = ? WHERE id = ?', [isPublic ? 1 : 0, id])
  saveDatabase()
  return NextResponse.json({ success: true })
}
