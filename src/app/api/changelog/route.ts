import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getUserId } from '@/services/user.service'

const ADMIN_USER_ID = '90af35f948de349b'

export async function GET() {
  const db = await getDatabase()
  const rows = db.exec("SELECT id, content, created_at FROM changelog ORDER BY created_at DESC")
  if (!rows.length || !rows[0].values.length) return NextResponse.json([])
  return NextResponse.json(rows[0].values.map(row => ({
    id: row[0], content: row[1], createdAt: row[2]
  })))
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: '请先设置 API Key' }, { status: 401 })

  const userId = getUserId(apiKey)
  if (userId !== ADMIN_USER_ID) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { content } = await req.json()
  if (!content || !content.trim()) return NextResponse.json({ error: '内容不能为空' }, { status: 400 })

  const db = await getDatabase()
  const id = uuid()
  db.run("INSERT INTO changelog (id, content, created_at) VALUES (?, ?, ?)", [id, content.trim(), new Date().toISOString()])
  saveDatabase()

  return NextResponse.json({ id, content: content.trim(), createdAt: new Date().toISOString() })
}

export async function DELETE(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: '请先设置 API Key' }, { status: 401 })

  const userId = getUserId(apiKey)
  if (userId !== ADMIN_USER_ID) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { id } = await req.json()
  const db = await getDatabase()
  db.run("DELETE FROM changelog WHERE id = ?", [id])
  saveDatabase()

  return NextResponse.json({ success: true })
}
