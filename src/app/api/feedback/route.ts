import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import {
  requireAuth,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

const ADMIN_USER_ID = '90af35f948de349b'

export async function GET() {
  const db = await getDatabase()
  const rows = db.exec("SELECT id, nickname, content, created_at, reply, status FROM feedback ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, created_at DESC")
  if (!rows.length || !rows[0].values.length) return NextResponse.json([])
  return NextResponse.json(rows[0].values.map(row => ({
    id: row[0], nickname: row[1], content: row[2], createdAt: row[3], reply: row[4], status: row[5] || 'open'
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
      'INSERT INTO feedback (id, user_id, nickname, content, created_at, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, safeNickname, safeContent, createdAt, 'open'],
    )
    saveDatabase()
    return NextResponse.json({ id, nickname: safeNickname, content: safeContent, createdAt, reply: null, status: 'open' })
  } catch (error) {
    return routeErrorResponse(error)
  }
}

// 管理员：回复 / 标记已完成
export async function PUT(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    if (userId !== ADMIN_USER_ID) throw new RouteError(403, '无权限')
    const { id, reply, status } = await req.json()
    if (typeof id !== 'string') throw new RouteError(400, 'ID 无效')
    const db = await getDatabase()
    if (typeof reply === 'string') {
      db.run("UPDATE feedback SET reply = ? WHERE id = ?", [reply.trim().slice(0, 2000), id])
    }
    if (status === 'open' || status === 'done') {
      db.run("UPDATE feedback SET status = ? WHERE id = ?", [status, id])
    }
    saveDatabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeErrorResponse(error)
  }
}

// 管理员：删除反馈
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    if (userId !== ADMIN_USER_ID) throw new RouteError(403, '无权限')
    const { id } = await req.json()
    if (typeof id !== 'string') throw new RouteError(400, 'ID 无效')
    const db = await getDatabase()
    db.run("DELETE FROM feedback WHERE id = ?", [id])
    saveDatabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
