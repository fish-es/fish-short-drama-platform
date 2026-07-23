import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/services/db.service'
import { getCurrentUser } from '@/services/auth.service'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const sceneId = req.nextUrl.searchParams.get('sceneId')
  if (!sceneId) return NextResponse.json({ error: 'sceneId required' }, { status: 400 })

  const db = await getDatabase()
  const rows = db.exec(
    `SELECT vc.file_path FROM video_clips vc
     JOIN scenes sc ON sc.id = vc.scene_id JOIN scripts s ON s.id = sc.script_id JOIN projects p ON p.id = s.project_id
     WHERE vc.scene_id = ? AND vc.status = 'completed' AND (p.user_id = ? OR p.is_public = 1)
     ORDER BY vc.created_at DESC LIMIT 1`,
    [sceneId, user.id]
  )

  if (!rows.length || !rows[0].values.length) return NextResponse.json({ filePath: null })
  return NextResponse.json({ filePath: rows[0].values[0][0] })
}
