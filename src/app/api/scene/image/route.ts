import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/services/db.service'

export async function GET(req: NextRequest) {
  const sceneId = req.nextUrl.searchParams.get('sceneId')
  if (!sceneId) return NextResponse.json({ error: 'sceneId required' }, { status: 400 })

  const db = await getDatabase()
  const rows = db.exec(
    "SELECT file_path FROM image_assets WHERE scene_id = ? AND is_current = 1 LIMIT 1",
    [sceneId]
  )

  if (!rows.length || !rows[0].values.length) return NextResponse.json({ filePath: null })
  return NextResponse.json({ filePath: rows[0].values[0][0] })
}
