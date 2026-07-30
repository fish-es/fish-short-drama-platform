import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/services/db.service'
import {
  requireAuth,
  requireEpisodeAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireAuth(req)
    const episodeId = req.nextUrl.searchParams.get('episodeId')
    if (!episodeId) throw new RouteError(400, 'episodeId required')

    const db = await getDatabase()
    requireEpisodeAccess(db, episodeId, userId, 'write')

    const epRows = db.exec(
      'SELECT episode_number, title, summary, script_id FROM episodes WHERE id = ?',
      [episodeId],
    )
    if (!epRows.length || !epRows[0].values.length) throw new RouteError(404, 'Episode not found')
    const epNumber = epRows[0].values[0][0] as number
    const scriptId = epRows[0].values[0][3] as string

    const scriptRows = db.exec('SELECT outline FROM scripts WHERE id = ?', [scriptId])
    if (!scriptRows.length || !scriptRows[0].values.length) {
      throw new RouteError(404, 'Script not found')
    }
    const outlineContent = scriptRows[0].values[0][0] as string

    const prevRows = db.exec(
      'SELECT summary FROM episodes WHERE script_id = ? AND episode_number < ? ORDER BY episode_number',
      [scriptId, epNumber],
    )
    const previousSummary = prevRows.length && prevRows[0].values.length
      ? prevRows[0].values.map(row => String(row[0])).join(' → ')
      : ''

    return NextResponse.json({ episodeId, scriptId, epNumber, outlineContent, previousSummary })
  } catch (error) {
    return routeErrorResponse(error)
  }
}
