import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/services/db.service'
import {
  requireAuth,
  requireProjectAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const projectId = req.nextUrl.searchParams.get('projectId')
    if (!projectId) throw new RouteError(400, 'projectId required')

    const db = await getDatabase()
    requireProjectAccess(db, projectId, userId, 'read')
    const projectRows = db.exec('SELECT user_id FROM projects WHERE id = ?', [projectId])
    const isOwner = projectRows.length > 0 &&
      projectRows[0].values.length > 0 &&
      projectRows[0].values[0][0] === userId

    const scriptRows = db.exec(
      'SELECT id FROM scripts WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
      [projectId],
    )
    if (!scriptRows.length || !scriptRows[0].values.length) return NextResponse.json(null)

    const scriptId = scriptRows[0].values[0][0] as string
    if (isOwner) {
      db.run(
        "UPDATE scenes SET state = 'DRAFT' WHERE script_id = ? AND state = 'GENERATING_IMG'",
        [scriptId],
      )
      db.run(
        "UPDATE scenes SET state = 'IMG_READY' WHERE script_id = ? AND state = 'GENERATING_VIDEO'",
        [scriptId],
      )
    }

    const epRows = db.exec(
      'SELECT id, episode_number, title, summary, status FROM episodes WHERE script_id = ? ORDER BY episode_number',
      [scriptId],
    )
    const episodes = epRows.length && epRows[0].values.length
      ? epRows[0].values.map(row => ({
          id: row[0],
          number: row[1],
          title: row[2],
          summary: row[3],
          status: row[4],
        }))
      : []

    return NextResponse.json({ scriptId, episodes })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
