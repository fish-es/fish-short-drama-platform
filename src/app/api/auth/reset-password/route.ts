import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { hashPassword, generateToken, hoursFromNow } from '@/services/auth.service'
import { routeErrorResponse, RouteError } from '@/services/security.service'

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json()

    if (!token || typeof token !== 'string') {
      throw new RouteError(400, '重置令牌无效')
    }
    if (!newPassword || typeof newPassword !== 'string') {
      throw new RouteError(400, '请输入新密码')
    }
    if (newPassword.length < 12) {
      throw new RouteError(400, '新密码长度不能少于12位')
    }

    const db = await getDatabase()

    const rows = db.exec(
      `SELECT id, user_id FROM password_resets
       WHERE token = ? AND used = 0 AND expires_at > datetime('now')`,
      [token],
    )

    if (!rows.length || !rows[0].values.length) {
      throw new RouteError(400, '重置令牌无效或已过期')
    }

    const [resetId, userId] = rows[0].values[0] as string[]

    // Update password
    const newHash = hashPassword(newPassword)
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId])

    // Mark token as used
    db.run('UPDATE password_resets SET used = 1 WHERE id = ?', [resetId])

    // Invalidate all existing sessions for this user
    db.run('DELETE FROM sessions WHERE user_id = ?', [userId])

    // Create a new session so the user is logged in immediately
    const sessionId = uuid()
    const sessionToken = generateToken()
    db.run(
      'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [sessionId, userId, sessionToken, hoursFromNow(24 * 30)],
    )

    // Retrieve username for convenience
    const userRows = db.exec('SELECT username FROM users WHERE id = ?', [userId])
    const username = (userRows[0]?.values[0]?.[0] as string) ?? ''

    saveDatabase()
    return NextResponse.json({ token: sessionToken, username })
  } catch (err) {
    return routeErrorResponse(err)
  }
}
