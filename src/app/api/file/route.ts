import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get('path')
  if (!filePath) return NextResponse.json({ error: 'path required' }, { status: 400 })

  if (!existsSync(filePath)) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const buffer = readFileSync(filePath)
  const ext = filePath.split('.').pop()?.toLowerCase()

  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    mp4: 'video/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', webp: 'image/webp'
  }

  return new NextResponse(buffer, {
    headers: { 'Content-Type': mimeMap[ext || ''] || 'application/octet-stream' }
  })
}
