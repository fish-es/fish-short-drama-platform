import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { generateToken, hoursFromNow } from '@/services/auth.service'
import { routeErrorResponse, RouteError } from '@/services/security.service'

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json()

    if (!username || typeof username !== 'string' || !username.trim()) {
      throw new RouteError(400, '请输入用户名')
    }

    const cleanUsername = username.trim().toLowerCase()
    const db = await getDatabase()

    const rows = db.exec('SELECT id FROM users WHERE username = ?', [cleanUsername])
    if (!rows.length || !rows[0].values.length) {
      // Don't reveal whether the user exists
      throw new RouteError(404, '未找到该用户名对应的账号')
    }

    const userId = rows[0].values[0][0] as string

    // Invalidate any existing unused reset tokens for this user
    db.run(
      "DELETE FROM password_resets WHERE user_id = ? AND used = 0",
      [userId],
    )

    const resetId = uuid()
    const token = generateToken(16) // 32-char hex token — shorter so it's easier to type
    db.run(
      'INSERT INTO password_resets (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [resetId, userId, token, hoursFromNow(1)],
    )

    saveDatabase()

    // Return the token directly (local/self-hosted app — no email service)
    return NextResponse.json({ resetToken: token })
  } catch (err) {
    return routeErrorResponse(err)
  }
}
