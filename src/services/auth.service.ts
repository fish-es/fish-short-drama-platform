import 'server-only'

import { randomBytes, scrypt as nodeScrypt, timingSafeEqual, createHash } from 'crypto'
import { promisify } from 'util'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getLegacyUserId } from '@/services/user.service'
import { meetsPasswordRequirements, PASSWORD_REQUIREMENT_MESSAGE } from '@/services/password-policy'

const scrypt = promisify(nodeScrypt)

export const SESSION_COOKIE = 'fish_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30

const LEGACY_ADMIN_USER_ID = '90af35f948de349b'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
}

interface StoredUser extends AuthUser {
  passwordHash: string
  passwordSalt: string
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function rowToUser(row: unknown[]): AuthUser {
  return {
    id: String(row[0]),
    name: String(row[1]),
    email: String(row[2]),
    role: row[3] === 'admin' ? 'admin' : 'user',
  }
}

function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function validateRegistration(input: { name: string; email: string; password: string }): string | null {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)

  if (name.length < 2 || name.length > 40) return '昵称长度应为 2 到 40 个字符'
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '请输入有效的邮箱地址'
  if (input.password.length > 128) return '密码长度不能超过 128 个字符'
  if (!meetsPasswordRequirements(input.password)) return PASSWORD_REQUIREMENT_MESSAGE
  return null
}

export function validateLogin(input: { email: string; password: string }): string | null {
  const email = normalizeEmail(input.email)
  if (!email || !input.password) return '请输入邮箱和密码'
  if (email.length > 254 || input.password.length > 128) return '邮箱或密码错误'
  return null
}

async function hashPassword(password: string, salt = randomBytes(16).toString('hex')): Promise<{ hash: string; salt: string }> {
  const derived = await scrypt(password, salt, 64) as Buffer
  return { hash: derived.toString('hex'), salt }
}

async function verifyPassword(password: string, storedHash: string, salt: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt)
  const expected = Buffer.from(storedHash, 'hex')
  const actual = Buffer.from(hash, 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

async function findStoredUser(email: string): Promise<StoredUser | null> {
  const db = await getDatabase()
  const result = db.exec(
    'SELECT id, name, email, role, password_hash, password_salt FROM users WHERE email = ? COLLATE NOCASE LIMIT 1',
    [normalizeEmail(email)]
  )
  if (!result.length || !result[0].values.length) return null
  const row = result[0].values[0]
  return {
    ...rowToUser(row),
    passwordHash: String(row[4]),
    passwordSalt: String(row[5]),
  }
}

export async function createUser(input: { name: string; email: string; password: string }): Promise<AuthUser | null> {
  const email = normalizeEmail(input.email)
  if (await findStoredUser(email)) return null

  const db = await getDatabase()
  const id = uuid()
  const { hash, salt } = await hashPassword(input.password)
  const role = getAdminEmails().has(email) ? 'admin' : 'user'

  db.run(
    'INSERT INTO users (id, name, email, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, input.name.trim(), email, hash, salt, role, new Date().toISOString()]
  )
  saveDatabase()
  return { id, name: input.name.trim(), email, role }
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const stored = await findStoredUser(email)
  if (!stored || !await verifyPassword(password, stored.passwordHash, stored.passwordSalt)) return null

  if (stored.role !== 'admin' && getAdminEmails().has(stored.email)) {
    const db = await getDatabase()
    db.run("UPDATE users SET role = 'admin' WHERE id = ?", [stored.id])
    saveDatabase()
    stored.role = 'admin'
  }

  return { id: stored.id, name: stored.name, email: stored.email, role: stored.role }
}

export async function createSession(userId: string): Promise<void> {
  const db = await getDatabase()
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000)

  db.run('DELETE FROM sessions WHERE expires_at <= ?', [new Date().toISOString()])
  db.run(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    [hashSessionToken(token), userId, expiresAt.toISOString(), new Date().toISOString()]
  )
  saveDatabase()

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.AUTH_COOKIE_SECURE !== 'false',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    priority: 'high',
  })
}

function tokenFromRequest(request?: NextRequest): Promise<string | undefined> | string | undefined {
  if (request) return request.cookies.get(SESSION_COOKIE)?.value
  return cookies().then(store => store.get(SESSION_COOKIE)?.value)
}

export async function getCurrentUser(request?: NextRequest): Promise<AuthUser | null> {
  const token = await tokenFromRequest(request)
  if (!token) return null

  const db = await getDatabase()
  const result = db.exec(
    `SELECT u.id, u.name, u.email, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1`,
    [hashSessionToken(token), new Date().toISOString()]
  )
  if (!result.length || !result[0].values.length) return null
  return rowToUser(result[0].values[0])
}

export async function deleteCurrentSession(request?: NextRequest): Promise<void> {
  const token = await tokenFromRequest(request)
  if (token) {
    const db = await getDatabase()
    db.run('DELETE FROM sessions WHERE token_hash = ?', [hashSessionToken(token)])
    saveDatabase()
  }
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function claimLegacyData(userId: string, apiKey?: string): Promise<void> {
  const key = apiKey?.trim()
  if (!key) return

  const legacyUserId = getLegacyUserId(key)
  const db = await getDatabase()
  db.run('UPDATE projects SET user_id = ? WHERE user_id = ?', [userId, legacyUserId])
  db.run('UPDATE feedback SET user_id = ? WHERE user_id = ?', [userId, legacyUserId])
  if (legacyUserId === LEGACY_ADMIN_USER_ID) {
    db.run("UPDATE users SET role = 'admin' WHERE id = ?", [userId])
  }
  saveDatabase()
}
