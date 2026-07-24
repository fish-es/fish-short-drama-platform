import * as MP4Box from 'mp4box'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'

// ─── Types ───────────────────────────────────────────────────────────

export interface SubtitleEntry {
  startTime: number
  endTime: number
  text: string
}

export interface SceneVideo {
  url: string
  dialogue: string
  duration: number
}

export type ProgressStep =
  | { step: 'download'; index: number; total: number }
  | { step: 'parse'; index: number; total: number }
  | { step: 'merge' }
  | { step: 'subtitle' }
  | { step: 'done' }

export type ProgressCallback = (info: ProgressStep) => void

export interface MergeResult {
  blob: Blob        // MP4 video
  srtBlob?: Blob    // Optional SRT subtitle file
}

interface ParsedTrack {
  id: number
  type: 'video' | 'audio'
  codec: string
  timescale: number
  duration: number
  width?: number
  height?: number
  samplerate?: number
  channelCount?: number
  samplesize?: number
  avcCDecoderConfig?: ArrayBuffer
  samples: ExtractedSample[]
}

interface ExtractedSample {
  data: Uint8Array
  duration: number
  dts: number
  cts: number
  is_sync: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────

function needsProxy(url: string): boolean {
  if (url.startsWith('/')) return false
  if (typeof window !== 'undefined' && url.startsWith(window.location.origin)) return false
  return true
}

function proxyUrl(url: string): string {
  return `/api/proxy-video?url=${encodeURIComponent(url)}`
}

async function fetchVideo(url: string): Promise<{ buffer: ArrayBuffer }> {
  const fetchUrl = needsProxy(url) ? proxyUrl(url) : url
  const response = await fetch(fetchUrl)
  if (!response.ok) throw new Error(`视频下载失败 (${response.status}): ${url.slice(0, 80)}...`)

  const contentLength = response.headers.get('content-length')
  const total = contentLength ? parseInt(contentLength, 10) : 0

  if (!response.body || total === 0) {
    return { buffer: await response.arrayBuffer() }
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
  }

  if (total > 0 && received !== total) {
    console.warn(`[video-merger] 下载不完整: 期望 ${total}, 实际 ${received}`)
  }

  const result = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) result.set(chunk, offset), offset += chunk.length
  return { buffer: result.buffer }
}

async function parallelLimit<T>(
  items: T[], fn: (item: T, index: number) => Promise<void>, limit = 3
): Promise<void> {
  let idx = 0
  const workers: Promise<void>[] = []
  async function worker() {
    while (idx < items.length) { const i = idx++; await fn(items[i], i) }
  }
  for (let w = 0; w < Math.min(limit, items.length); w++) workers.push(worker())
  await Promise.all(workers)
}

// ─── SRT Generation ───────────────────────────────────────────────────

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function generateSrtBlob(scenes: SceneVideo[]): Blob {
  let srt = ''
  let offset = 0, idx = 1
  for (const scene of scenes) {
    if (scene.dialogue.trim()) {
      srt += `${idx}\n${formatSrtTime(offset)} --> ${formatSrtTime(offset + scene.duration)}\n${scene.dialogue}\n\n`
      idx++
    }
    offset += scene.duration
  }
  return new Blob([srt], { type: 'text/plain;charset=utf-8' })
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── Codec Config Extraction ──────────────────────────────────────────

function extractAvcCFromBuffer(buffer: ArrayBuffer): ArrayBuffer | null {
  const data = new Uint8Array(buffer)
  for (let i = 0; i < data.length - 12; i++) {
    if (data[i] === 0x61 && data[i + 1] === 0x76 && data[i + 2] === 0x63 && data[i + 3] === 0x43) {
      const boxSize = (data[i - 4] << 24) | (data[i - 3] << 16) | (data[i - 2] << 8) | data[i - 1]
      const payloadStart = i + 4, payloadLen = boxSize - 8
      if (payloadLen > 0 && payloadStart + payloadLen <= data.length) {
        return data.slice(payloadStart, payloadStart + payloadLen).buffer.slice(0)
      }
    }
  }
  return null
}

function extractAacConfigFromBuffer(buffer: ArrayBuffer): ArrayBuffer | null {
  const data = new Uint8Array(buffer)
  for (let i = 0; i < data.length - 12; i++) {
    if (data[i] === 0x65 && data[i + 1] === 0x73 && data[i + 2] === 0x64 && data[i + 3] === 0x73) {
      const esdsSize = (data[i - 4] << 24) | (data[i - 3] << 16) | (data[i - 2] << 8) | data[i - 1]
      const esdsEnd = i + esdsSize
      let pos = i + 4
      while (pos < esdsEnd - 2) {
        if (data[pos] === 0x05) {
          const ascLen = data[pos + 1]
          if (ascLen > 0 && pos + 2 + ascLen <= esdsEnd) {
            return data.slice(pos + 2, pos + 2 + ascLen).buffer.slice(0)
          }
        }
        pos++
      }
    }
  }
  return null
}

// ─── MP4 Parsing ─────────────────────────────────────────────────────

function parseMP4(buffer: ArrayBuffer): Promise<{
  videoTrack: ParsedTrack | null
  audioTrack: ParsedTrack | null
}> {
  return new Promise((resolve, reject) => {
    const file = MP4Box.createFile()
    let videoTrack: ParsedTrack | null = null
    let audioTrack: ParsedTrack | null = null

    file.onError = () => reject(new Error('MP4 解析错误'))

    file.onReady = (info: any) => {
      const tracks = info.tracks || []
      const vi = tracks.find((t: any) => t.video)
      const ai = tracks.find((t: any) => t.audio)

      videoTrack = vi ? {
        id: vi.id, type: 'video' as const, codec: vi.codec,
        timescale: vi.timescale, duration: vi.duration,
        width: vi.video.width, height: vi.video.height,
        samples: [],
      } : null

      audioTrack = ai ? {
        id: ai.id, type: 'audio' as const, codec: ai.codec,
        timescale: ai.timescale, duration: ai.duration,
        samplerate: ai.audio?.sample_rate,
        channelCount: ai.audio?.channel_count,
        samplesize: ai.audio?.sample_size,
        samples: [],
      } : null

      const toExtract: { trackId: number; target: ParsedTrack }[] = []
      if (videoTrack) toExtract.push({ trackId: vi.id, target: videoTrack })
      if (audioTrack) toExtract.push({ trackId: ai.id, target: audioTrack })

      if (toExtract.length === 0) { reject(new Error('没有轨道')); return }

      file.onSamples = (trackId: number, _user: any, samples: MP4Box.Sample[]) => {
        const entry = toExtract.find(t => t.trackId === trackId)
        if (!entry) return
        for (const s of samples) {
          if (!s.data) continue
          entry.target.samples.push({
            data: new Uint8Array(s.data.buffer.slice(0, s.size)),
            duration: (s as any).duration || 0,
            dts: (s as any).dts || 0, cts: (s as any).cts || 0,
            is_sync: !!(s as any).is_sync,
          })
        }
        const last = samples[samples.length - 1]
        if (last) file.releaseUsedSamples(trackId, last.number)
      }

      for (const e of toExtract) file.setExtractionOptions(e.trackId, null, { nbSamples: 1000 })
      file.start()
    }

    const mb = new ArrayBuffer(buffer.byteLength)
    new Uint8Array(mb).set(new Uint8Array(buffer))
    ;(mb as any).fileStart = 0
    try { file.appendBuffer(mb as any); file.flush() }
    catch (e: any) { reject(new Error(`MP4 解析失败: ${e.message}`)); return }

    setTimeout(() => {
      try {
        if (videoTrack) {
          const avcC = extractAvcCFromBuffer(buffer)
          if (avcC) videoTrack.avcCDecoderConfig = avcC
        }
        resolve({ videoTrack, audioTrack })
      } catch (e: any) { reject(e) }
    }, 100)
  })
}

// ─── Main API ────────────────────────────────────────────────────────

export async function mergeVideosWithSubtitles(
  scenes: SceneVideo[],
  includeSubtitles: boolean,
  onProgress?: ProgressCallback
): Promise<MergeResult> {
  if (scenes.length === 0) throw new Error('没有可用的视频')

  const total = scenes.length

  // Step 1: Download (parallel, max 3)
  const downloaded: { buffer: ArrayBuffer; scene: SceneVideo }[] = new Array(total)
  let completedDownloads = 0
  await parallelLimit(scenes, async (scene, i) => {
    const { buffer } = await fetchVideo(scene.url)
    downloaded[i] = { buffer, scene }
    completedDownloads++
    onProgress?.({ step: 'download', index: completedDownloads, total })
  }, 3)

  // Step 2: Parse
  const parsed: { videoTrack: ParsedTrack | null; audioTrack: ParsedTrack | null }[] = []
  for (let i = 0; i < total; i++) {
    onProgress?.({ step: 'parse', index: i + 1, total })
    parsed.push(await parseMP4(downloaded[i].buffer))
  }

  // Step 3: Mux with mp4-muxer
  onProgress?.({ step: 'merge' })
  const firstVideo = parsed.find(p => p.videoTrack)?.videoTrack
  if (!firstVideo) throw new Error('没有找到视频轨道')
  const firstAudio = parsed.find(p => p.audioTrack)?.audioTrack
  const videoWidth = firstVideo.width || 1920
  const videoHeight = firstVideo.height || 1080

  // Video codec description (AVCDecoderConfigurationRecord)
  const avcDesc = firstVideo.avcCDecoderConfig
    ? new Uint8Array(firstVideo.avcCDecoderConfig) : null
  const videoDecoderConfig: any = { codec: firstVideo.codec }
  if (avcDesc) videoDecoderConfig.description = avcDesc

  // Audio codec description — only pass if we have valid AAC config,
  // otherwise mp4-muxer auto-generates the MPEG4AudioSpecificConfig
  const aacDesc = firstAudio
    ? extractAacConfigFromBuffer(
        downloaded[parsed.findIndex(p => p.audioTrack === firstAudio)].buffer
      ) : null
  const audioDecoderConfig: any | undefined = (firstAudio && aacDesc)
    ? { codec: firstAudio.codec, description: aacDesc }
    : undefined

  const muxerCfg: any = {
    target: new ArrayBufferTarget(),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
    video: { codec: 'avc', width: videoWidth, height: videoHeight },
  }
  if (firstAudio?.samplerate) {
    muxerCfg.audio = {
      codec: 'aac',
      numberOfChannels: firstAudio.channelCount || 2,
      sampleRate: firstAudio.samplerate,
    }
  }
  const muxer = new Muxer(muxerCfg)

  let videoTimeUs = 0, audioTimeUs = 0

  for (let i = 0; i < parsed.length; i++) {
    const { videoTrack, audioTrack } = parsed[i]

    if (videoTrack) {
      const ts = videoTrack.timescale || 90000
      for (const s of videoTrack.samples) {
        const ptsUs = videoTimeUs + Math.round((s.cts / ts) * 1_000_000)
        const dUs = videoTimeUs + Math.round((s.dts / ts) * 1_000_000)
        const durUs = Math.round((s.duration / ts) * 1_000_000)
        muxer.addVideoChunkRaw(s.data, s.is_sync ? 'key' : 'delta', ptsUs,
          Math.max(durUs, 1), { decoderConfig: videoDecoderConfig }, ptsUs - dUs)
      }
      if (videoTrack.samples.length > 0) {
        const last = videoTrack.samples[videoTrack.samples.length - 1]
        videoTimeUs = Math.round(((last.cts + last.duration) / ts) * 1_000_000)
      }
    }

    if (audioTrack) {
      const ts = audioTrack.timescale || 44100
      // Only pass meta if we have valid config; let mp4-muxer auto-gen otherwise
      const meta: any = audioDecoderConfig ? { decoderConfig: audioDecoderConfig } : undefined
      for (const s of audioTrack.samples) {
        const dtsUs = audioTimeUs + Math.round((s.dts / ts) * 1_000_000)
        const durUs = Math.round((s.duration / ts) * 1_000_000)
        muxer.addAudioChunkRaw(s.data, 'key', dtsUs, Math.max(durUs, 1), meta)
      }
      audioTimeUs += Math.round((audioTrack.duration / ts) * 1_000_000)
    }
  }

  muxer.finalize()
  let finalBuffer = (muxer.target as ArrayBufferTarget).buffer

  // Step 4: Embed soft subtitles (tx3g) via mp4box.js
  onProgress?.({ step: 'subtitle' })
  let srtBlob: Blob | undefined
  if (includeSubtitles && scenes.some(s => s.dialogue.trim())) {
    try {
      const subbed = await embedSubtitleTrack(finalBuffer, scenes, videoWidth, videoHeight)
      if (subbed) {
        finalBuffer = subbed
      } else {
        srtBlob = generateSrtBlob(scenes)
      }
    } catch {
      srtBlob = generateSrtBlob(scenes)
    }
  }

  onProgress?.({ step: 'done' })
  return { blob: new Blob([finalBuffer], { type: 'video/mp4' }), srtBlob }
}

/** Add subtitle track to an existing standard MP4 via mp4box.js */
function embedSubtitleTrack(
  mp4Buffer: ArrayBuffer,
  scenes: SceneVideo[],
  videoWidth: number,
  videoHeight: number,
): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    const file = MP4Box.createFile()

    file.onError = () => resolve(null)

    file.onReady = (info: any) => {
      const vi = info.tracks?.find((t: any) => t.video)
      if (!vi) { resolve(null); return }

      try {
        const subTs = 1000
        const dur = Math.round(scenes.reduce((s, c) => s + c.duration, 0) * subTs)
        const subId = file.addTrack({
          type: 'tx3g' as any, timescale: subTs, duration: dur,
          width: videoWidth, height: videoHeight,
          language: 'zho', hdlr: 'sbtl', name: '中文字幕',
        })

        // Configure tx3g sample entry
        const moov = (file as any).moov
        if (moov) {
          for (const t of moov.traks || []) {
            if (t?.mdia?.hdlr?.handler === 'sbtl') {
              const e = t?.mdia?.minf?.stbl?.stsd?.entries?.[0]
              if (e) {
                e.displayFlags = 0x00000001
                e.horizontal_justification = 0x01
                e.vertical_justification = 0xff
              }
            }
          }
        }

        let off = 0
        for (const sc of scenes) {
          if (sc.dialogue.trim()) {
            const st = Math.round(off * subTs)
            const et = Math.round((off + sc.duration) * subTs)
            const encoder = new TextEncoder()
            const tb = encoder.encode(sc.dialogue)
            const d = new Uint8Array(2 + tb.length)
            d[0] = (tb.length >> 8) & 0xff; d[1] = tb.length & 0xff
            d.set(tb, 2)
            file.addSample(subId, d as any, {
              duration: et - st, dts: st, cts: st,
              is_sync: true, sample_description_index: 1,
            })
          }
          off += sc.duration
        }

        file.flush()
        const ds = file.getBuffer()
        const ab = (ds as any).buffer ? (ds as any).buffer.slice(0) : null
        resolve(ab)
      } catch { resolve(null) }
    }

    const mb = new ArrayBuffer(mp4Buffer.byteLength)
    new Uint8Array(mb).set(new Uint8Array(mp4Buffer))
    ;(mb as any).fileStart = 0
    try { file.appendBuffer(mb as any); file.flush() } catch { resolve(null) }
  })
}

/**
 * Add soft subtitles to a single video.
 * Returns the MP4 (remuxed through mp4-muxer for playability) + optional SRT file.
 */
export async function addSubtitleToVideo(
  videoBuffer: ArrayBuffer,
  subtitles: SubtitleEntry[],
  onProgress?: ProgressCallback
): Promise<MergeResult> {
  if (subtitles.length === 0) {
    return { blob: new Blob([videoBuffer], { type: 'video/mp4' }) }
  }

  onProgress?.({ step: 'parse', index: 1, total: 1 })
  const { videoTrack, audioTrack } = await parseMP4(videoBuffer)
  if (!videoTrack) throw new Error('视频解析失败')

  const width = videoTrack.width || 1920, height = videoTrack.height || 1080

  const avcDesc = videoTrack.avcCDecoderConfig
    ? new Uint8Array(videoTrack.avcCDecoderConfig) : null
  const aacDesc = audioTrack ? extractAacConfigFromBuffer(videoBuffer) : null

  const videoDecoderConfig: any = { codec: videoTrack.codec }
  if (avcDesc) videoDecoderConfig.description = avcDesc
  const audioDecoderConfig: any | undefined = (audioTrack && aacDesc)
    ? { codec: audioTrack.codec, description: aacDesc } : undefined

  const muxerCfg: any = {
    target: new ArrayBufferTarget(),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
    video: { codec: 'avc', width, height },
  }
  if (audioTrack?.samplerate) {
    muxerCfg.audio = {
      codec: 'aac',
      numberOfChannels: audioTrack.channelCount || 2,
      sampleRate: audioTrack.samplerate,
    }
  }
  const muxer = new Muxer(muxerCfg)

  const vTs = videoTrack.timescale || 90000
  for (const s of videoTrack.samples) {
    const pts = Math.round((s.cts / vTs) * 1_000_000)
    const dts = Math.round((s.dts / vTs) * 1_000_000)
    const dur = Math.round((s.duration / vTs) * 1_000_000)
    muxer.addVideoChunkRaw(s.data, s.is_sync ? 'key' : 'delta', pts,
      Math.max(dur, 1), { decoderConfig: videoDecoderConfig }, pts - dts)
  }

  if (audioTrack) {
    const aTs = audioTrack.timescale || 44100
    const meta: any = audioDecoderConfig ? { decoderConfig: audioDecoderConfig } : undefined
    for (const s of audioTrack.samples) {
      const dts = Math.round((s.dts / aTs) * 1_000_000)
      const dur = Math.round((s.duration / aTs) * 1_000_000)
      muxer.addAudioChunkRaw(s.data, 'key', dts, Math.max(dur, 1), meta)
    }
  }

  muxer.finalize()
  let finalBuffer = (muxer.target as ArrayBufferTarget).buffer

  onProgress?.({ step: 'subtitle' })
  let srtBlob: Blob | undefined
  const scenes: SceneVideo[] = subtitles.map(s => ({
    url: '', dialogue: s.text, duration: s.endTime - s.startTime,
  }))
  try {
    const subbed = await embedSubtitleTrack(finalBuffer, scenes, width, height)
    if (subbed) {
      finalBuffer = subbed
    } else {
      srtBlob = generateSrtBlob(scenes)
    }
  } catch {
    srtBlob = generateSrtBlob(scenes)
  }

  onProgress?.({ step: 'done' })
  return { blob: new Blob([finalBuffer], { type: 'video/mp4' }), srtBlob }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
