import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getUserId } from '@/services/user.service'

export async function GET() {
  const db = await getDatabase()
  const rows = db.exec("SELECT id, nickname, content, created_at FROM feedback ORDER BY created_at DESC")
  if (!rows.length || !rows[0].values.length) return NextResponse.json([])
  return NextResponse.json(rows[0].values.map(row => ({
    id: row[0], nickname: row[1], content: row[2], createdAt: row[3]
  })))
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: '请先设置 API Key' }, { status: 401 })

  const { content, nickname = '匿名用户' } = await req.json()
  if (!content || !content.trim()) return NextResponse.json({ error: '内容不能为空' }, { status: 400 })

  const userId = getUserId(apiKey)
  const db = await getDatabase()
  const id = uuid()
  db.run("INSERT INTO feedback (id, user_id, nickname, content, created_at) VALUES (?, ?, ?, ?, ?)", [id, userId, nickname.trim() || '匿名用户', content.trim(), new Date().toISOString()])
  saveDatabase()

  return NextResponse.json({ id, nickname: nickname.trim() || '匿名用户', content: content.trim(), createdAt: new Date().toISOString() })
}
