import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { resolve, sep } from 'path'
import { getDatabase } from '@/services/db.service'
import { getCurrentUser } from '@/services/auth.service'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const filePath = req.nextUrl.searchParams.get('path')
  if (!filePath) return NextResponse.json({ error: 'path required' }, { status: 400 })

  const candidate = resolve(filePath)
  const db = await getDatabase()
  const projects = db.exec('SELECT output_path FROM projects WHERE user_id = ? OR is_public = 1', [user.id])
  const allowed = projects.length && projects[0].values.some(row => {
    const root = resolve(String(row[0]))
    return candidate === root || candidate.startsWith(root + sep)
  })

  if (!allowed || !existsSync(candidate)) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const buffer = readFileSync(candidate)
  const ext = candidate.split('.').pop()?.toLowerCase()

  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    mp4: 'video/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', webp: 'image/webp'
  }

  return new NextResponse(buffer, {
    headers: { 'Content-Type': mimeMap[ext || ''] || 'application/octet-stream' }
  })
}
