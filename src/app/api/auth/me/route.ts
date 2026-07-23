import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  }
  return NextResponse.json({ user })
}
