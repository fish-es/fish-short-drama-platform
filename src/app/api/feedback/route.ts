import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getCurrentUser } from '@/services/auth.service'

export async function GET() {
  const db = await getDatabase()
  const rows = db.exec("SELECT id, nickname, content, created_at FROM feedback ORDER BY created_at DESC")
  if (!rows.length || !rows[0].values.length) return NextResponse.json([])
  return NextResponse.json(rows[0].values.map(row => ({
    id: row[0], nickname: row[1], content: row[2], createdAt: row[3]
  })))
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })

  const { content, nickname = '匿名用户' } = await req.json()
  if (!content || !content.trim()) return NextResponse.json({ error: '内容不能为空' }, { status: 400 })

  const db = await getDatabase()
  const id = uuid()
  const displayName = nickname.trim() || user.name
  db.run("INSERT INTO feedback (id, user_id, nickname, content, created_at) VALUES (?, ?, ?, ?, ?)", [id, user.id, displayName, content.trim(), new Date().toISOString()])
  saveDatabase()

  return NextResponse.json({ id, nickname: displayName, content: content.trim(), createdAt: new Date().toISOString() })
}
