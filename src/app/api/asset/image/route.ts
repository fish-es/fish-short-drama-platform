import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getCurrentUser } from '@/services/auth.service'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })

  const { projectId, type, name, imageUrl } = await req.json()
  if (!projectId || !type || !imageUrl) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const db = await getDatabase()

  const projCheck = db.exec("SELECT id FROM projects WHERE id = ? AND user_id = ?", [projectId, user.id])
  if (!projCheck.length || !projCheck[0].values.length) return NextResponse.json({ error: '项目不存在' }, { status: 404 })

  if (type === 'cover') {
    db.run("UPDATE projects SET cover_image = ? WHERE id = ?", [imageUrl, projectId])
  } else if (type === 'character') {
    db.run("UPDATE characters SET reference_image = ? WHERE project_id = ? AND name = ?", [imageUrl, projectId, name])
  } else if (type === 'location') {
    db.run("UPDATE locations SET reference_image = ? WHERE project_id = ? AND name = ?", [imageUrl, projectId, name])
  }
  saveDatabase()

  return NextResponse.json({ success: true })
}
