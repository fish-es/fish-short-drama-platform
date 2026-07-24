import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { hashPassword, generateToken, hoursFromNow } from '@/services/auth.service'
import { routeErrorResponse, RouteError } from '@/services/security.service'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || typeof username !== 'string' || !username.trim()) {
      throw new RouteError(400, '用户名不能为空')
    }
    if (!password || typeof password !== 'string') {
      throw new RouteError(400, '密码不能为空')
    }
    if (password.length < 12) {
      throw new RouteError(400, '密码长度不能少于12位')
    }

    const cleanUsername = username.trim().toLowerCase()
    if (cleanUsername.length > 32) {
      throw new RouteError(400, '用户名不能超过32个字符')
    }
    if (!/^[a-z0-9_一-龥]+$/.test(cleanUsername)) {
      throw new RouteError(400, '用户名只能包含字母、数字、下划线或中文')
    }

    const db = await getDatabase()

    // Check if username already taken
    const existing = db.exec('SELECT id FROM users WHERE username = ?', [cleanUsername])
    if (existing.length > 0 && existing[0].values.length > 0) {
      throw new RouteError(409, '用户名已被占用')
    }

    const userId = uuid()
    const passwordHash = hashPassword(password)
    db.run(
      'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
      [userId, cleanUsername, passwordHash],
    )

    // Create session
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
