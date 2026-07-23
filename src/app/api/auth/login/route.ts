import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, claimLegacyData, createSession, normalizeEmail, validateLogin } from '@/services/auth.service'
import { clearLoginFailures, getLoginRetryAfter, recordLoginFailure } from '@/services/login-rate-limit'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const legacyApiKey = typeof body?.legacyApiKey === 'string' ? body.legacyApiKey : undefined
  const clientAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  const attemptKey = `${clientAddress}:${normalizeEmail(email)}`

  const validationError = validateLogin({ email, password })
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const retryAfter = getLoginRetryAfter(attemptKey)
  if (retryAfter) {
    return NextResponse.json(
      { error: `登录尝试过多，请在 ${Math.ceil(retryAfter / 60)} 分钟后重试` },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const user = await authenticateUser(email, password)
  if (!user) {
    recordLoginFailure(attemptKey)
    return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 })
  }

  clearLoginFailures(attemptKey)
  await claimLegacyData(user.id, legacyApiKey)
  await createSession(user.id)
  return NextResponse.json({ user })
}
