import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { verifyPassword, generateToken, hoursFromNow } from '@/services/auth.service'
import { routeErrorResponse, RouteError } from '@/services/security.service'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      throw new RouteError(400, '用户名和密码不能为空')
    }

    const cleanUsername = username.trim().toLowerCase()
    const db = await getDatabase()

    const rows = db.exec(
      'SELECT id, password_hash FROM users WHERE username = ?',
      [cleanUsername],
    )

    // Deliberately vague error to avoid username enumeration
    if (!rows.length || !rows[0].values.length) {
      throw new RouteError(401, '用户名或密码不正确')
    }

    const [userId, passwordHash] = rows[0].values[0] as string[]
    if (!verifyPassword(password, passwordHash)) {
      throw new RouteError(401, '用户名或密码不正确')
    }

    const sessionId = uuid()
    const token = generateToken()
    db.run(
      'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [sessionId, userId, token, hoursFromNow(24 * 30)],
    )

    saveDatabase()
    return NextResponse.json({ token, username: cleanUsername })
  } catch (err) {
    return routeErrorResponse(err)
  }
}
