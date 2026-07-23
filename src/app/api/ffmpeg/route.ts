import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { writeFileSync, existsSync, mkdirSync, unlinkSync, copyFileSync } from 'fs'
import { execFile } from 'child_process'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { getDatabase } from '@/services/db.service'
import { fetchRemoteMedia } from '@/services/remote-media.service'
import {
  getProjectDirectory,
  requireExistingProjectFile,
  sanitizeFilename,
} from '@/services/storage.service'
import {
  requireAuth,
  requireEpisodeInProject,
  requireProjectAccess,
  routeErrorResponse,
  RouteError,
} from '@/services/security.service'

function getFfmpegPath(): string {
  return ffmpegInstaller.path || 'ffmpeg'
}

function runFfmpegCmd(args: string[]): Promise<void> {
  const ffmpegPath = getFfmpegPath()
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      args,
      { timeout: 600_000, maxBuffer: 10 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) reject(new Error(`ffmpeg error: ${(stderr || error.message).slice(-500)}`))
        else resolve()
      },
    )
  })
}

export async function POST(req: NextRequest) {
  const tempFiles: string[] = []
  try {
    const { userId } = requireAuth(req)
    const body = await req.json()
    const projectId = typeof body.projectId === 'string' ? body.projectId : ''
    const episodeId = typeof body.episodeId === 'string' ? body.episodeId : ''
    const subtitles = body.subtitles !== false
    if (!projectId || !episodeId) throw new RouteError(400, 'projectId and episodeId required')

    const db = await getDatabase()
    requireProjectAccess(db, projectId, userId, 'write')
    requireEpisodeInProject(db, episodeId, projectId, userId)

    const projRows = db.exec(
      'SELECT name, aspect_ratio FROM projects WHERE id = ? AND user_id = ?',
      [projectId, userId],
    )
    if (!projRows.length || !projRows[0].values.length) throw new RouteError(404, 'Project not found')
    const projectName = projRows[0].values[0][0] as string
    const aspectRatio = (projRows[0].values[0][1] as string) || '16:9'
    const projectPath = getProjectDirectory(userId, projectId)

    const epRows = db.exec(
      'SELECT episode_number FROM episodes WHERE id = ? AND script_id IN (SELECT id FROM scripts WHERE project_id = ?)',
      [episodeId, projectId],
    )
    if (!epRows.length || !epRows[0].values.length) throw new RouteError(404, 'Episode not found')
    const episodeNumber = Number(epRows[0].values[0][0])

    const dimensionsMap: Record<string, string> = {
      '9:16': '1080:1920',
      '16:9': '1920:1080',
      '1:1': '1080:1080',
    }
    const scaleDim = dimensionsMap[aspectRatio] || '1920:1080'
    const [outW, outH] = scaleDim.split(':').map(Number)

    const sceneRows = db.exec(
      `SELECT sc.id, sc.scene_order, sc.dialogue, sc.duration, vc.file_path
       FROM scenes sc
       JOIN scripts s ON s.id = sc.script_id
       LEFT JOIN video_clips vc ON vc.scene_id = sc.id AND vc.status = 'completed'
       WHERE sc.episode_id = ? AND s.project_id = ?
       ORDER BY sc.scene_order`,
      [episodeId, projectId],
    )
    if (!sceneRows.length || !sceneRows[0].values.length) {
      throw new RouteError(400, '没有可用的视频片段')
    }

    const scenes = sceneRows[0].values
      .filter(row => row[4])
      .map(row => ({
        id: row[0] as string,
        order: row[1] as number,
        dialogue: row[2] as string,
        duration: row[3] as number,
        videoPath: row[4] as string,
      }))
    if (scenes.length === 0) throw new RouteError(400, '没有可用的视频片段')

    const outputDir = join(projectPath, 'output')
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
    const filename = sanitizeFilename(
      `${projectName}_第${episodeNumber}集_final.mp4`,
      `episode-${episodeNumber}.mp4`,
    )
    const finalPath = join(outputDir, filename)

    const localVideoPaths: string[] = []
    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index]
      const localPath = join(outputDir, `_dl_${index}.mp4`)
      tempFiles.push(localPath)

      if (scene.videoPath.startsWith('http')) {
        const media = await fetchRemoteMedia(scene.videoPath, {
          allowedContentTypes: ['video/'],
          maxBytes: 500 * 1024 * 1024,
          timeoutMs: 60_000,
        })
        writeFileSync(localPath, media.buffer)
      } else {
        const safeSource = requireExistingProjectFile(scene.videoPath, userId, projectId)
        copyFileSync(safeSource, localPath)
      }
      localVideoPaths.push(localPath)
    }

    const normalizedPaths: string[] = []
    for (let index = 0; index < localVideoPaths.length; index++) {
      const normPath = join(outputDir, `_norm_${index}.ts`)
      await runFfmpegCmd([
        '-y', '-i', localVideoPaths[index],
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-vf', `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-pix_fmt', 'yuv420p', '-r', '24',
        '-c:a', 'aac', '-b:a', '128k',
        '-map', '0:v:0', '-map', '0:a:0?', '-map', '1:a:0',
        '-shortest',
        '-bsf:v', 'h264_mp4toannexb',
        '-f', 'mpegts', normPath,
      ])
      normalizedPaths.push(normPath)
      tempFiles.push(normPath)
    }

    const concatListPath = join(outputDir, '_concat_list.txt')
    writeFileSync(
      concatListPath,
      normalizedPaths.map(path => `file '${path.replace(/\\/g, '/')}'`).join('\n'),
    )
    tempFiles.push(concatListPath)

    const concatOutput = join(outputDir, '_concat.mp4')
    tempFiles.push(concatOutput)
    await runFfmpegCmd([
      '-y', '-f', 'concat', '-safe', '0', '-i', concatListPath,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', concatOutput,
    ])

    let currentInput = concatOutput
    if (subtitles && scenes.some(scene => scene.dialogue.trim())) {
      const srtPath = join(outputDir, '_subtitles.srt')
      tempFiles.push(srtPath)

      let srt = ''
      let offset = 0
      let subtitleIndex = 1
      for (const scene of scenes) {
        if (scene.dialogue.trim()) {
          srt += `${subtitleIndex}\n${formatTime(offset)} --> ${formatTime(offset + scene.duration)}\n${scene.dialogue}\n\n`
          subtitleIndex++
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
        '-c:a', 'copy', subtitleOutput,
      ])
      currentInput = subtitleOutput
    }

    copyFileSync(currentInput, finalPath)
    const downloadUrl = `/api/file?kind=output&projectId=${encodeURIComponent(projectId)}&episodeId=${encodeURIComponent(episodeId)}`
    return NextResponse.json({ downloadUrl, filename })
  } catch (error) {
    return routeErrorResponse(error)
  } finally {
    for (const file of tempFiles) {
      if (existsSync(file)) {
        try {
          unlinkSync(file)
        } catch {}
      }
    }
  }
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const wholeSeconds = Math.floor(seconds % 60)
  const milliseconds = Math.round((seconds % 1) * 1000)
  return `${pad(hours)}:${pad(minutes)}:${pad(wholeSeconds)},${String(milliseconds).padStart(3, '0')}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
