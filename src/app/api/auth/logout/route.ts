import { NextRequest, NextResponse } from 'next/server'
import { deleteCurrentSession } from '@/services/auth.service'

export async function POST(request: NextRequest) {
  await deleteCurrentSession(request)
  return NextResponse.json({ success: true })
}
