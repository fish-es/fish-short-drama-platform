import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getUserId } from '@/services/user.service'

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: '请先设置 API Key' }, { status: 401 })

  const { projectId, type, name, imageUrl } = await req.json()
  if (!projectId || !type || !imageUrl) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const userId = getUserId(apiKey)
  const db = await getDatabase()

  const projCheck = db.exec("SELECT id FROM projects WHERE id = ? AND user_id = ?", [projectId, userId])
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
