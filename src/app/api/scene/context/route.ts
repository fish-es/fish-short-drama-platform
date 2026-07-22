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
    "SELECT sc.description, p.id, p.aspect_ratio FROM scenes sc JOIN scripts s ON sc.script_id = s.id JOIN projects p ON s.project_id = p.id WHERE sc.id = ? AND p.user_id = ?",
    [sceneId, userId]
  )
  if (!rows.length || !rows[0].values.length) return NextResponse.json({ error: 'Scene not found' }, { status: 404 })

  const description = rows[0].values[0][0] as string
  const projectId = rows[0].values[0][1] as string
  const aspectRatio = (rows[0].values[0][2] as string) || '16:9'

  const sizeMap: Record<string, string> = { '9:16': '768x1024', '16:9': '1024x768', '1:1': '1024x1024' }
  const size = sizeMap[aspectRatio] || '1024x768'

  // Collect reference image URLs and keywords
  const referenceImages: string[] = []
  const sceneData = db.exec("SELECT characters, location FROM scenes WHERE id = ?", [sceneId])
  let enhancedPrompt = description

  if (sceneData.length && sceneData[0].values.length) {
    const charNames: string[] = JSON.parse(sceneData[0].values[0][0] as string || '[]')
    const locationName = sceneData[0].values[0][1] as string || ''
    const parts: string[] = []

    for (const name of charNames) {
      const charRows = db.exec("SELECT reference_image, keywords FROM characters WHERE project_id = ? AND name = ?", [projectId, name])
      if (charRows.length && charRows[0].values.length) {
        const ref = charRows[0].values[0][0] as string | null
        if (ref && ref.startsWith('http')) referenceImages.push(ref)
        const kw = charRows[0].values[0][1] as string
        if (kw) parts.push(kw)
      }
    }
    if (locationName) {
      const locRows = db.exec("SELECT reference_image, keywords FROM locations WHERE project_id = ? AND name = ?", [projectId, locationName])
      if (locRows.length && locRows[0].values.length) {
        const ref = locRows[0].values[0][0] as string | null
        if (ref && ref.startsWith('http')) referenceImages.push(ref)
        const kw = locRows[0].values[0][1] as string
        if (kw) parts.push(kw)
      }
    }
    if (parts.length > 0) enhancedPrompt = `${description}, ${parts.join(', ')}`
  }

  return NextResponse.json({ sceneId, prompt: enhancedPrompt, size, referenceImages })
}
