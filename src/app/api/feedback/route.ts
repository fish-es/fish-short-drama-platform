import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import {
  requireAuth,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

export async function GET() {
  const db = await getDatabase()
  const rows = db.exec("SELECT id, nickname, content, created_at FROM feedback ORDER BY created_at DESC")
  if (!rows.length || !rows[0].values.length) return NextResponse.json([])
  return NextResponse.json(rows[0].values.map(row => ({
    id: row[0], nickname: row[1], content: row[2], createdAt: row[3]
  })))
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const { content, nickname = '匿名用户' } = await req.json()
    if (typeof content !== 'string' || !content.trim()) {
      throw new RouteError(400, '内容不能为空')
    }

    const safeContent = content.trim().slice(0, 5_000)
    const safeNickname = typeof nickname === 'string'
      ? nickname.trim().slice(0, 100) || '匿名用户'
      : '匿名用户'
    const createdAt = new Date().toISOString()
    const db = await getDatabase()
    const id = uuid()
    db.run(
      'INSERT INTO feedback (id, user_id, nickname, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, userId, safeNickname, safeContent, createdAt],
    )
    saveDatabase()
    return NextResponse.json({ id, nickname: safeNickname, content: safeContent, createdAt })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
