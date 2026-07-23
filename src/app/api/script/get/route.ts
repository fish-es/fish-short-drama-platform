import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/services/db.service'
import { getCurrentUser } from '@/services/auth.service'

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const userId = user.id
  const db = await getDatabase()

  const projCheck = db.exec("SELECT id, user_id FROM projects WHERE id = ? AND (user_id = ? OR is_public = 1)", [projectId, userId])
  if (!projCheck.length || !projCheck[0].values.length) return NextResponse.json({ error: '项目不存在' }, { status: 404 })
  const scriptRows = db.exec('SELECT id FROM scripts WHERE project_id = ? ORDER BY created_at DESC LIMIT 1', [projectId])
  if (!scriptRows.length || !scriptRows[0].values.length) return NextResponse.json(null)

  const scriptId = scriptRows[0].values[0][0] as string

  // Only an owner opening the project may recover interrupted generation states.
  if (projCheck[0].values[0][1] === userId) {
    db.run("UPDATE scenes SET state = 'DRAFT' WHERE script_id = ? AND state = 'GENERATING_IMG'", [scriptId])
    db.run("UPDATE scenes SET state = 'IMG_READY' WHERE script_id = ? AND state = 'GENERATING_VIDEO'", [scriptId])
  }

  const epRows = db.exec("SELECT id, episode_number, title, summary, status FROM episodes WHERE script_id = ? ORDER BY episode_number", [scriptId])
  const episodes = epRows.length && epRows[0].values.length
    ? epRows[0].values.map(row => ({ id: row[0], number: row[1], title: row[2], summary: row[3], status: row[4] }))
    : []

  return NextResponse.json({ scriptId, episodes })
}
