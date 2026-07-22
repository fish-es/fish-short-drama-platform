import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/services/db.service'
import { getUserId } from '@/services/user.service'

export async function GET(req: NextRequest) {
  const sceneId = req.nextUrl.searchParams.get('sceneId')
  if (!sceneId) return NextResponse.json({ error: 'sceneId required' }, { status: 400 })

  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: '请先设置 API Key' }, { status: 401 })

  const userId = getUserId(apiKey)
  const db = await getDatabase()

  const rows = db.exec(
    "SELECT sc.description, sc.dialogue, sc.duration, p.aspect_ratio FROM scenes sc JOIN scripts s ON sc.script_id = s.id JOIN projects p ON s.project_id = p.id WHERE sc.id = ? AND p.user_id = ?",
    [sceneId, userId]
  )
  if (!rows.length || !rows[0].values.length) return NextResponse.json({ error: 'Scene not found' }, { status: 404 })

  const description = rows[0].values[0][0] as string
  const dialogue = rows[0].values[0][1] as string || ''
  const duration = rows[0].values[0][2] as number || 5
  const aspectRatio = (rows[0].values[0][3] as string) || '16:9'

  // Get current image URL
  const imgRows = db.exec("SELECT file_path FROM image_assets WHERE scene_id = ? AND is_current = 1", [sceneId])
  if (!imgRows.length || !imgRows[0].values.length) {
    return NextResponse.json({ error: '场景没有可用图片' }, { status: 400 })
  }
  const imageUrl = imgRows[0].values[0][0] as string

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

  // Convert image to base64 on server (avoids CORS issues in browser)
  let imageBase64 = ''
  try {
    const imgResp = await fetch(imageUrl)
    const buffer = Buffer.from(await imgResp.arrayBuffer())
    imageBase64 = `data:image/png;base64,${buffer.toString('base64')}`
  } catch (e: any) {
    return NextResponse.json({ error: '无法获取场景图片: ' + e.message }, { status: 500 })
  }

  return NextResponse.json({ sceneId, imageBase64, prompt: videoPrompt, width, height, numFrames })
}
