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
  const rows = db.exec("SELECT id, content, created_at FROM changelog ORDER BY created_at DESC")
  if (!rows.length || !rows[0].values.length) return NextResponse.json([])
  return NextResponse.json(rows[0].values.map(row => ({
    id: row[0], content: row[1], createdAt: row[2]
  })))
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    if (userId !== ADMIN_USER_ID) throw new RouteError(403, '无权限')

    const { content } = await req.json()
    if (typeof content !== 'string' || !content.trim()) {
      throw new RouteError(400, '内容不能为空')
    }

    const safeContent = content.trim().slice(0, 5_000)
    const db = await getDatabase()
    const id = uuid()
    const createdAt = new Date().toISOString()
    db.run(
      'INSERT INTO changelog (id, content, created_at) VALUES (?, ?, ?)',
      [id, safeContent, createdAt],
    )
    saveDatabase()
    return NextResponse.json({ id, content: safeContent, createdAt })
  } catch (error) {
    return routeErrorResponse(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    if (userId !== ADMIN_USER_ID) throw new RouteError(403, '无权限')

    const { id } = await req.json()
    if (typeof id !== 'string') throw new RouteError(400, 'id required')
    const db = await getDatabase()
    db.run('DELETE FROM changelog WHERE id = ?', [id])
    saveDatabase()
    return NextResponse.json({ success: true })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
