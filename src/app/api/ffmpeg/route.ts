import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { writeFileSync, existsSync, mkdirSync, unlinkSync, copyFileSync } from 'fs'
import { execFile } from 'child_process'
import { getDatabase, saveDatabase } from '@/services/db.service'
import { getCurrentUser } from '@/services/auth.service'

function getFfmpegPath(): string {
  const cwd = /* turbopackIgnore: true */ process.cwd()
  const possiblePaths = [
    join(cwd, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    join(cwd, 'node_modules', '@ffmpeg-installer', 'linux-x64', 'ffmpeg'),
    join(cwd, 'node_modules', '@ffmpeg-installer', 'darwin-x64', 'ffmpeg'),
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
  ]
  for (const p of possiblePaths) {
    if (existsSync(p)) return p
  }
  return 'ffmpeg'
}

function runFfmpegCmd(args: string[]): Promise<void> {
  const ffmpegPath = getFfmpegPath()
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { timeout: 600000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`ffmpeg error: ${(stderr || error.message).slice(-500)}`))
      else resolve()
    })
  })
}

export async function POST(req: NextRequest) {
  const { projectId, episodeId, subtitles = true } = await req.json()
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: '登录已过期', code: 'UNAUTHENTICATED' }, { status: 401 })
  const userId = user.id
  const db = await getDatabase()
  const projRows = db.exec("SELECT output_path, name, aspect_ratio FROM projects WHERE id = ? AND user_id = ?", [projectId, userId])
  if (!projRows.length || !projRows[0].values.length) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const projectPath = projRows[0].values[0][0] as string
  const projectName = projRows[0].values[0][1] as string
  const aspectRatio = (projRows[0].values[0][2] as string) || '16:9'

  const dimensionsMap: Record<string, string> = { '9:16': '1080:1920', '16:9': '1920:1080', '1:1': '1080:1080' }
  const scaleDim = dimensionsMap[aspectRatio] || '1920:1080'
  const [outW, outH] = scaleDim.split(':').map(Number)

  // Get episode label
  let episodeLabel = ''
  if (episodeId) {
    const epRows = db.exec("SELECT episode_number FROM episodes WHERE id = ?", [episodeId])
    if (epRows.length && epRows[0].values.length) {
      episodeLabel = `_第${epRows[0].values[0][0]}集`
    }
  }

  // Query scenes
  const sceneQuery = episodeId
    ? "SELECT sc.id, sc.scene_order, sc.dialogue, sc.duration, vc.file_path FROM scenes sc LEFT JOIN video_clips vc ON vc.scene_id = sc.id AND vc.status = 'completed' WHERE sc.episode_id = ? ORDER BY sc.scene_order"
    : "SELECT sc.id, sc.scene_order, sc.dialogue, sc.duration, vc.file_path FROM scenes sc JOIN scripts s ON sc.script_id = s.id LEFT JOIN video_clips vc ON vc.scene_id = sc.id AND vc.status = 'completed' WHERE s.project_id = ? ORDER BY sc.scene_order"

  const sceneRows = db.exec(sceneQuery, [episodeId || projectId])
  if (!sceneRows.length || !sceneRows[0].values.length) {
    return NextResponse.json({ error: '没有可用的视频片段' }, { status: 400 })
  }

  const scenes = sceneRows[0].values
    .filter(row => row[4])
    .map(row => ({
      id: row[0] as string,
      order: row[1] as number,
      dialogue: row[2] as string,
      duration: row[3] as number,
      videoPath: row[4] as string
    }))

  if (scenes.length === 0) return NextResponse.json({ error: '没有可用的视频片段' }, { status: 400 })

  const outputDir = join(projectPath, 'output')
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  const finalPath = join(outputDir, `${projectName}${episodeLabel}_final.mp4`)
  const tempFiles: string[] = []

  try {
    // Download videos from URLs to temp files
    const localVideoPaths: string[] = []
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const localPath = join(outputDir, `_dl_${i}.mp4`)
      tempFiles.push(localPath)

      if (scene.videoPath.startsWith('http')) {
        const resp = await fetch(scene.videoPath)
        const buffer = Buffer.from(await resp.arrayBuffer())
        writeFileSync(localPath, buffer)
      } else if (existsSync(scene.videoPath)) {
        copyFileSync(scene.videoPath, localPath)
      } else {
        continue
      }
      localVideoPaths.push(localPath)
    }

    if (localVideoPaths.length === 0) return NextResponse.json({ error: '视频下载失败' }, { status: 500 })

    // Step 1: Normalize videos
    const normalizedPaths: string[] = []
    for (let i = 0; i < localVideoPaths.length; i++) {
      const normPath = join(outputDir, `_norm_${i}.ts`)
      await runFfmpegCmd([
        '-y', '-i', localVideoPaths[i],
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-vf', `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-pix_fmt', 'yuv420p', '-r', '24',
        '-c:a', 'aac', '-b:a', '128k',
        '-map', '0:v:0', '-map', '0:a:0?', '-map', '1:a:0',
        '-shortest',
        '-bsf:v', 'h264_mp4toannexb',
        '-f', 'mpegts', normPath
      ])
      normalizedPaths.push(normPath)
      tempFiles.push(normPath)
    }

    // Step 2: Concatenate
    const concatListPath = join(outputDir, '_concat_list.txt')
    writeFileSync(concatListPath, normalizedPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'))
    tempFiles.push(concatListPath)

    const concatOutput = join(outputDir, '_concat.mp4')
    tempFiles.push(concatOutput)
    await runFfmpegCmd([
      '-y', '-f', 'concat', '-safe', '0', '-i', concatListPath,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', concatOutput
    ])

    let currentInput = concatOutput

    // Step 3: Subtitles
    if (subtitles && scenes.some(s => s.dialogue.trim())) {
      const srtPath = join(outputDir, '_subtitles.srt')
      tempFiles.push(srtPath)

      let srt = '', offset = 0, idx = 1
      for (const scene of scenes) {
        if (scene.dialogue.trim()) {
          const start = formatTime(offset)
          const end = formatTime(offset + scene.duration)
          srt += `${idx}\n${start} --> ${end}\n${scene.dialogue}\n\n`
          idx++
        }
        offset += scene.duration
      }
      writeFileSync(srtPath, srt, 'utf-8')

      const subtitleOutput = join(outputDir, '_subtitled.mp4')
      tempFiles.push(subtitleOutput)
      const srtEscaped = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:')
      await runFfmpegCmd([
        '-y', '-i', currentInput,
        '-vf', `subtitles='${srtEscaped}'`,
        '-c:a', 'copy', subtitleOutput
      ])
      currentInput = subtitleOutput
    }

    // Final output
    if (currentInput !== finalPath) {
      copyFileSync(currentInput, finalPath)
    }

    return NextResponse.json({ path: finalPath })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  } finally {
    for (const f of tempFiles) {
      if (existsSync(f) && f !== finalPath) {
        try { unlinkSync(f) } catch {}
      }
    }
  }
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, '0')}`
}
function pad(n: number) { return String(n).padStart(2, '0') }
