'use client'

// 默认走 Cloudflare Worker 代理（国内免梯子）。
// 高级用户可在 localStorage 设 agnes_proxy_url 覆盖（留空 'direct' 则直连）。
const DEFAULT_PROXY = 'https://agnes.h537.xyz'
const DIRECT_HOST = 'https://apihub.agnes-ai.com'

function getHost(): string {
  if (typeof window === 'undefined') return DEFAULT_PROXY
  const override = (localStorage.getItem('agnes_proxy_url') || '').trim().replace(/\/$/, '')
  if (override === 'direct') return DIRECT_HOST
  if (override) return override
  return DEFAULT_PROXY
}

const BASE_URL = () => `${getHost()}/v1`

const RETRY_DELAYS = [2000, 5000, 10000, 20000, 30000]
const RETRY_STATUS = [429, 500, 502, 503, 504]

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e: any) {
      const status = e?.status || 0
      if (attempt >= maxAttempts - 1 || !RETRY_STATUS.includes(status)) throw e
      const delay = RETRY_DELAYS[attempt] + Math.random() * 1000
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

export async function chatCompletion(messages: any[], apiKey: string): Promise<string> {
  return withRetry(async () => {
    const response = await fetch(`${BASE_URL()}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'agnes-2.0-flash', messages, temperature: 0.7 })
    })
    if (!response.ok) {
      const err: any = new Error(`Chat API error: ${response.status}`)
      err.status = response.status
      throw err
    }
    const data = await response.json()
    return data.choices[0].message.content
  })
}

export async function generateImage(prompt: string, size: string, apiKey: string, referenceImages?: string[]): Promise<string> {
  return withRetry(async () => {
    const extraBody: any = { response_format: 'url' }
    if (referenceImages && referenceImages.length > 0) {
      extraBody.image = referenceImages
    }
    const response = await fetch(`${BASE_URL()}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'agnes-image-2.0-flash', prompt, size, extra_body: extraBody })
    })
    if (!response.ok) {
      const err: any = new Error(`Image API error: ${response.status}`)
      err.status = response.status
      throw err
    }
    const data = await response.json()
    return data.data[0].url
  })
}

export async function generateVideo(
  prompt: string, imageBase64: string, width: number, height: number, numFrames: number, apiKey: string
): Promise<{ videoId: string; taskId: string }> {
  return withRetry(async () => {
    const response = await fetch(`${BASE_URL()}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'agnes-video-v2.0',
        prompt,
        image: imageBase64,
        width, height,
        num_frames: numFrames,
        frame_rate: 24
      })
    })
    if (!response.ok) {
      const err: any = new Error(`Video API error: ${response.status}`)
      err.status = response.status
      throw err
    }
    const data = await response.json()
    return { videoId: data.video_id, taskId: data.task_id }
  })
}

export async function pollVideoStatus(videoId: string, apiKey: string): Promise<{ status: string; url?: string }> {
  const response = await fetch(
    `${getHost()}/agnesapi?video_id=${videoId}`,
    { headers: { 'Authorization': `Bearer ${apiKey}` } }
  )
  if (!response.ok) throw new Error(`Poll error: ${response.status}`)
  const data = await response.json()
  return { status: data.status, url: data.url }
}
