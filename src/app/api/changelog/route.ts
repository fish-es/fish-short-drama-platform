import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getCurrentUser } from '@/services/auth.service'

export async function GET() {
  const db = await getDatabase()
  const rows = db.exec("SELECT id, content, created_at FROM changelog ORDER BY created_at DESC")
  if (!rows.length || !rows[0].values.length) return NextResponse.json([])
  return NextResponse.json(rows[0].values.map(row => ({
    id: row[0], content: row[1], createdAt: row[2]
  })))
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { content } = await req.json()
  if (!content || !content.trim()) return NextResponse.json({ error: '内容不能为空' }, { status: 400 })

  const db = await getDatabase()
  const id = uuid()
  db.run("INSERT INTO changelog (id, content, created_at) VALUES (?, ?, ?)", [id, content.trim(), new Date().toISOString()])
  saveDatabase()

  return NextResponse.json({ id, content: content.trim(), createdAt: new Date().toISOString() })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { id } = await req.json()
  const db = await getDatabase()
  db.run("DELETE FROM changelog WHERE id = ?", [id])
  saveDatabase()

  return NextResponse.json({ success: true })
}
