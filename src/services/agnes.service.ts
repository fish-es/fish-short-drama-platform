// Agnes AI API service - runs on server, receives API key from request headers

import { withRetry } from './retry'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function chatCompletion(
  messages: ChatMessage[],
  apiKey: string,
  baseUrl = 'https://apihub.agnes-ai.com/v1'
): Promise<string> {
  return withRetry(async () => {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const error = new Error(`Agnes API error: ${response.status}`) as any
      error.status = response.status
      throw error
    }

    const data = await response.json()
    return data.choices[0].message.content
  })
}

export async function generateImage(
  prompt: string,
  size: string,
  apiKey: string,
  referenceImages?: string[],
  baseUrl = 'https://apihub.agnes-ai.com/v1'
): Promise<string> {
  return withRetry(async () => {
    const extraBody: any = { response_format: 'url' }
    if (referenceImages && referenceImages.length > 0) {
      extraBody.image = referenceImages
    }

    const response = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'agnes-image-2.0-flash',
        prompt,
        size,
        extra_body: extraBody
      })
    })

    if (!response.ok) {
      const error = new Error(`Agnes Image API error: ${response.status}`) as any
      error.status = response.status
      throw error
    }

    const data = await response.json()
    return data.data[0].url
  })
}

export async function generateVideo(
  prompt: string,
  imageBase64: string,
  width: number,
  height: number,
  numFrames: number,
  apiKey: string,
  baseUrl = 'https://apihub.agnes-ai.com/v1'
): Promise<{ videoId: string; taskId: string }> {
  return withRetry(async () => {
    const response = await fetch(`${baseUrl}/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'agnes-video-v2.0',
        prompt,
        image: imageBase64,
        width,
        height,
        num_frames: numFrames,
        frame_rate: 24
      })
    })

    if (!response.ok) {
      const error = new Error(`Agnes Video API error: ${response.status}`) as any
      error.status = response.status
      throw error
    }

    const data = await response.json()
    return { videoId: data.video_id || data.task_id, taskId: data.task_id || '' }
  })
}

export async function pollVideoStatus(
  videoId: string,
  apiKey: string,
  baseUrl = 'https://apihub.agnes-ai.com/v1'
): Promise<{ status: string; url?: string }> {
  const response = await fetch(
    `${baseUrl.replace('/v1', '')}/agnesapi?video_id=${videoId}`,
    { headers: { 'Authorization': `Bearer ${apiKey}` } }
  )

  if (!response.ok) return { status: 'in_progress' }

  const data = await response.json()
  return { status: data.status, url: data.url }
}
