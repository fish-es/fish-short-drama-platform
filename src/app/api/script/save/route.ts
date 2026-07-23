import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getCurrentUser } from '@/services/auth.service'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })

  const { projectId, outlineContent, parsed, coverImage, characterImages, locationImages } = await req.json()
  if (!projectId || !parsed) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const userId = user.id
  const db = await getDatabase()

  const projCheck = db.exec("SELECT id FROM projects WHERE id = ? AND user_id = ?", [projectId, userId])
  if (!projCheck.length || !projCheck[0].values.length) return NextResponse.json({ error: '项目不存在' }, { status: 404 })

  // Save script
  const scriptId = uuid()
  db.run(
    'INSERT INTO scripts (id, project_id, content, synopsis, outline, total_episodes) VALUES (?, ?, ?, ?, ?, ?)',
    [scriptId, projectId, outlineContent, parsed.synopsis, outlineContent, parsed.totalEpisodes]
  )

  // Update project title
  db.run("UPDATE projects SET drama_title = ? WHERE id = ?", [parsed.title, projectId])

  // Save cover image
  if (coverImage) {
    db.run("UPDATE projects SET cover_image = ? WHERE id = ?", [coverImage, projectId])
  }

  // Create characters
  for (let i = 0; i < parsed.characters.length; i++) {
    const char = parsed.characters[i]
    const charId = uuid()
    const refImage = characterImages?.[i] || null
    db.run(
      'INSERT INTO characters (id, project_id, name, description, keywords, voice_id, reference_image) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [charId, projectId, char.name, char.description, char.keywords || '', char.voiceId || '', refImage]
    )
  }

  // Create locations
  for (let i = 0; i < parsed.locations.length; i++) {
    const loc = parsed.locations[i]
    const locId = uuid()
    const refImage = locationImages?.[i] || null
    db.run(
      'INSERT INTO locations (id, project_id, name, description, keywords, reference_image) VALUES (?, ?, ?, ?, ?, ?)',
      [locId, projectId, loc.name, loc.description, loc.keywords || '', refImage]
    )
  }

  // Create episodes
  const episodes: any[] = []
  for (const ep of parsed.episodes) {
    const epId = uuid()
    db.run(
      'INSERT INTO episodes (id, script_id, episode_number, title, summary, status) VALUES (?, ?, ?, ?, ?, ?)',
      [epId, scriptId, ep.number, ep.title, ep.summary, 'pending']
    )
    episodes.push({ id: epId, number: ep.number, title: ep.title, summary: ep.summary, status: 'pending' })
  }

  saveDatabase()

  return NextResponse.json({ scriptId, episodes, title: parsed.title, coverImage })
}
