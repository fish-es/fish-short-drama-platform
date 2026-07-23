import { NextRequest, NextResponse } from 'next/server'
import { claimLegacyData, createSession, createUser, validateRegistration } from '@/services/auth.service'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name : ''
  const email = typeof body?.email === 'string' ? body.email : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const legacyApiKey = typeof body?.legacyApiKey === 'string' ? body.legacyApiKey : undefined

  const validationError = validateRegistration({ name, email, password })
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const user = await createUser({ name, email, password })
  if (!user) return NextResponse.json({ error: '该邮箱已注册，请直接登录' }, { status: 409 })

  await claimLegacyData(user.id, legacyApiKey)
  await createSession(user.id)
  return NextResponse.json({ user }, { status: 201 })
}
