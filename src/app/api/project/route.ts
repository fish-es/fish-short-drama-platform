import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { join } from 'path'
import { mkdirSync, existsSync, rmSync } from 'fs'
import { homedir } from 'os'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getUserId } from '@/services/user.service'

const PROJECTS_DIR = join(homedir(), 'ShortDrama')

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: '请先设置 API Key' }, { status: 401 })

  const userId = getUserId(apiKey)
  const db = await getDatabase()
  const rows = db.exec("SELECT id, name, created_at, status, output_path, aspect_ratio, cover_image, drama_title FROM projects WHERE user_id = ? ORDER BY created_at DESC", [userId])
  if (!rows.length || !rows[0].values.length) return NextResponse.json([])
  const projects = rows[0].values.map(row => ({
    id: row[0], name: row[1], createdAt: row[2], status: row[3],
    outputPath: row[4], aspectRatio: row[5] || '16:9',
    coverImage: row[6], dramaTitle: row[7]
  }))
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: '请先设置 API Key' }, { status: 401 })

  const userId = getUserId(apiKey)
  const { name, aspectRatio = '16:9' } = await req.json()
  if (!existsSync(PROJECTS_DIR)) mkdirSync(PROJECTS_DIR, { recursive: true })

  const db = await getDatabase()
  const id = uuid()
  const outputPath = join(PROJECTS_DIR, name)
  if (!existsSync(outputPath)) mkdirSync(outputPath, { recursive: true })

  db.run('INSERT INTO projects (id, name, output_path, aspect_ratio, user_id) VALUES (?, ?, ?, ?, ?)', [id, name, outputPath, aspectRatio, userId])
  saveDatabase()

  return NextResponse.json({ id, name, createdAt: new Date().toISOString(), status: 'active', outputPath, aspectRatio, coverImage: null, dramaTitle: null })
}

export async function DELETE(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: '请先设置 API Key' }, { status: 401 })

  const userId = getUserId(apiKey)
  const { id } = await req.json()
  const db = await getDatabase()
  const rows = db.exec('SELECT output_path FROM projects WHERE id = ? AND user_id = ?', [id, userId])
  if (!rows.length || !rows[0].values.length) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 })
  }
  const outputPath = rows[0].values[0][0] as string
  if (existsSync(outputPath)) rmSync(outputPath, { recursive: true, force: true })
  db.run('DELETE FROM projects WHERE id = ? AND user_id = ?', [id, userId])
  saveDatabase()
  return NextResponse.json({ success: true })
}
