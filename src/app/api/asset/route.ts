import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { generateImage } from '@/services/agnes.service'
import { getUserId } from '@/services/user.service'

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  const type = req.nextUrl.searchParams.get('type')
  if (!projectId || !type) return NextResponse.json({ error: 'projectId and type required' }, { status: 400 })

  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: '请先设置 API Key' }, { status: 401 })

  const userId = getUserId(apiKey)
  const db = await getDatabase()

  const projCheck = db.exec("SELECT id FROM projects WHERE id = ? AND (user_id = ? OR is_public = 1)", [projectId, userId])
  if (!projCheck.length || !projCheck[0].values.length) return NextResponse.json({ error: '项目不存在' }, { status: 404 })
  if (type === 'characters') {
    const rows = db.exec("SELECT id, name, description, voice_id, reference_image, keywords FROM characters WHERE project_id = ?", [projectId])
    if (!rows.length || !rows[0].values.length) return NextResponse.json([])
    return NextResponse.json(rows[0].values.map(r => ({
      id: r[0], name: r[1], description: r[2], voiceId: r[3], referenceImage: r[4], keywords: r[5]
    })))
  } else {
    const rows = db.exec("SELECT id, name, description, reference_image, keywords FROM locations WHERE project_id = ?", [projectId])
    if (!rows.length || !rows[0].values.length) return NextResponse.json([])
    return NextResponse.json(rows[0].values.map(r => ({
      id: r[0], name: r[1], description: r[2], referenceImage: r[3], keywords: r[4]
    })))
  }
}

export async function POST(req: NextRequest) {
  const { id, type, keywords, projectId, action } = await req.json()
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: '请先设置 API Key' }, { status: 401 })

  if (action === 'regenerate') {
    const db = await getDatabase()
    const userId = getUserId(apiKey)
    const projRows = db.exec("SELECT output_path FROM projects WHERE id = ? AND user_id = ?", [projectId, userId])
    if (!projRows.length) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    const projectPath = projRows[0].values[0][0] as string

    const isChar = type === 'character'
    const prompt = isChar
      ? `${keywords}，面朝镜头，半身像，中性背景，高质量，细致面部特征`
      : `${keywords}，广角镜头，电影感，高质量，无人物`
    const size = isChar ? '768x1024' : '1024x768'

    try {
      const imageUrl = await generateImage(prompt, size, apiKey)
      const imgResp = await fetch(imageUrl)
      const buffer = Buffer.from(await imgResp.arrayBuffer())

      const refDir = join(projectPath, 'references', isChar ? 'characters' : 'locations')
      if (!existsSync(refDir)) mkdirSync(refDir, { recursive: true })
      const filePath = join(refDir, `${id}.png`)
      writeFileSync(filePath, buffer)

      if (isChar) {
        db.run("UPDATE characters SET reference_image = ? WHERE id = ?", [filePath, id])
      } else {
        db.run("UPDATE locations SET reference_image = ? WHERE id = ?", [filePath, id])
      }
      saveDatabase()
      return NextResponse.json({ filePath })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function PUT(req: NextRequest) {
  const { id, type, keywords } = await req.json()
  const db = await getDatabase()

  if (type === 'character') {
    db.run("UPDATE characters SET keywords = ? WHERE id = ?", [keywords, id])
  } else {
    db.run("UPDATE locations SET keywords = ? WHERE id = ?", [keywords, id])
  }
  saveDatabase()
  return NextResponse.json({ success: true })
}
