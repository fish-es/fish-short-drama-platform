import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { join } from 'path'
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { generateVideo, pollVideoStatus } from '@/services/agnes.service'
import { getCurrentUser } from '@/services/auth.service'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const { sceneId } = await req.json()
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: '请先设置 API Key' }, { status: 400 })

  const db = await getDatabase()
  const userId = user.id
  const rows = db.exec(
    "SELECT sc.description, sc.dialogue, sc.duration, p.output_path, p.aspect_ratio FROM scenes sc JOIN scripts s ON sc.script_id = s.id JOIN projects p ON s.project_id = p.id WHERE sc.id = ? AND p.user_id = ?",
    [sceneId, userId]
  )
  if (!rows.length || !rows[0].values.length) return NextResponse.json({ error: 'Scene not found' }, { status: 404 })

  const description = rows[0].values[0][0] as string
  const dialogue = rows[0].values[0][1] as string || ''
  const duration = rows[0].values[0][2] as number || 5
  const projectPath = rows[0].values[0][3] as string
  const aspectRatio = (rows[0].values[0][4] as string) || '16:9'

  // Get current image
  const imgRows = db.exec("SELECT file_path FROM image_assets WHERE scene_id = ? AND is_current = 1", [sceneId])
  if (!imgRows.length || !imgRows[0].values.length) {
    return NextResponse.json({ error: '场景没有可用图片' }, { status: 400 })
  }
  const imagePath = imgRows[0].values[0][0] as string

  // Convert image to base64 - handle both URLs and local files
  let imageBase64: string
  if (imagePath.startsWith('http')) {
    const imgResp = await fetch(imagePath)
    const buffer = Buffer.from(await imgResp.arrayBuffer())
    imageBase64 = `data:image/png;base64,${buffer.toString('base64')}`
  } else {
    imageBase64 = `data:image/png;base64,${readFileSync(imagePath).toString('base64')}`
  }

  // Calculate frames
  const cleanDialogue = dialogue.replace(/^[一-龥\w]+[：:]\s*/gm, '').trim()
  const dialogueLength = cleanDialogue.length
  const minSeconds = Math.max(duration, dialogueLength > 0 ? Math.ceil(dialogueLength / 3) + 1 : 5)
  const targetFrames = minSeconds * 24
  const numFrames = Math.min(441, Math.floor((targetFrames - 1) / 8) * 8 + 1)

  // Build prompt
  const langPrefix = '[语言要求：本视频中所有角色必须且只能说中文普通话，禁止出现任何英文对话] '
  const videoPrompt = cleanDialogue
    ? `${langPrefix}${description}。角色正在用中文普通话说："${cleanDialogue}"。注意：角色说的每一个字都必须是中文，绝对不能说英文。`
    : `${langPrefix}${description}。注意：如果角色有任何发声，必须是中文普通话，禁止英文。`

  // Video dimensions
  const dims: Record<string, { width: number; height: number }> = {
    '9:16': { width: 768, height: 1152 },
    '16:9': { width: 1152, height: 768 },
    '1:1': { width: 1024, height: 1024 }
  }
  const { width, height } = dims[aspectRatio] || dims['16:9']

  db.run("UPDATE scenes SET state = 'GENERATING_VIDEO', error_message = NULL WHERE id = ?", [sceneId])
  saveDatabase()

  try {
    const { videoId } = await generateVideo(videoPrompt, imageBase64, width, height, numFrames, apiKey)

    const clipId = uuid()
    db.run("INSERT INTO video_clips (id, scene_id, video_id, status) VALUES (?, ?, ?, 'in_progress')", [clipId, sceneId, videoId])
    saveDatabase()

    // Poll for completion
    const maxPollTime = 5 * 60 * 1000
    const pollInterval = 5000
    const startTime = Date.now()

    while (Date.now() - startTime < maxPollTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      const result = await pollVideoStatus(videoId, apiKey)
      if (result.status === 'completed' && result.url) {
        // Store URL directly, no server download
        db.run("UPDATE video_clips SET status = 'completed', file_path = ? WHERE id = ?", [result.url, clipId])
        db.run("UPDATE scenes SET state = 'VIDEO_READY', error_message = NULL WHERE id = ?", [sceneId])
        saveDatabase()
        return NextResponse.json({ id: clipId, filePath: result.url, videoId })
      }
      if (result.status === 'failed') {
        throw new Error('视频生成失败')
      }
    }

    throw new Error('视频生成超时')
  } catch (e: any) {
    db.run("UPDATE scenes SET state = 'ERROR', error_message = ? WHERE id = ?", [e.message, sceneId])
    saveDatabase()
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
