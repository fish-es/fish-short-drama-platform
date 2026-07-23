import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/services/db.service'
import { getCurrentUser } from '@/services/auth.service'
import { parseOutlineResponse } from '@/services/script.service'

export async function GET(req: NextRequest) {
  const episodeId = req.nextUrl.searchParams.get('episodeId')
  if (!episodeId) return NextResponse.json({ error: 'episodeId required' }, { status: 400 })

  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const userId = user.id
  const db = await getDatabase()

  // Verify ownership
  const projCheck = db.exec(
    "SELECT p.id FROM projects p JOIN scripts s ON s.project_id = p.id JOIN episodes e ON e.script_id = s.id WHERE e.id = ? AND p.user_id = ?",
    [episodeId, userId]
  )
  if (!projCheck.length || !projCheck[0].values.length) return NextResponse.json({ error: '项目不存在' }, { status: 404 })

  const epRows = db.exec("SELECT episode_number, title, summary, script_id FROM episodes WHERE id = ?", [episodeId])
  if (!epRows.length || !epRows[0].values.length) return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
  const epNumber = epRows[0].values[0][0] as number
  const scriptId = epRows[0].values[0][3] as string

  const scriptRows = db.exec("SELECT outline FROM scripts WHERE id = ?", [scriptId])
  if (!scriptRows.length) return NextResponse.json({ error: 'Script not found' }, { status: 404 })
  const outlineContent = scriptRows[0].values[0][0] as string

  const prevRows = db.exec(
    "SELECT summary FROM episodes WHERE script_id = ? AND episode_number < ? ORDER BY episode_number",
    [scriptId, epNumber]
  )
  const previousSummary = prevRows.length && prevRows[0].values.length
    ? prevRows[0].values.map((r: any) => r[0]).join(' → ')
    : ''

  return NextResponse.json({ episodeId, scriptId, epNumber, outlineContent, previousSummary })
}
