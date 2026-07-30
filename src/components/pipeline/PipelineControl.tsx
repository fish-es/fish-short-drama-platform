'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { sceneApi, getApiKeys } from '@/services/api.client'
import { generateImage, generateVideo, pollVideoStatus } from '@/services/agnes.client'
import {
  mergeVideosWithSubtitles,
  downloadBlob,
  type ProgressStep,
  type MergeResult,
} from '@/services/video-merger.client'

export default function PipelineControl() {
  const { scenes, currentProject, currentEpisodeId, pipelineStatus, pipelineStep, pipelineProgress, videoUrls,
    updateScene, setPipelineStatus, setPipelineStep, setPipelineProgress, resetPipeline } = useAppStore()
  const [subtitles, setSubtitles] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [stats, setStats] = useState({ images: 0, videos: 0, imgTime: 0, vidTime: 0 })
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  // Client-side merge state
  const [mergeStatus, setMergeStatus] = useState<'idle' | 'merging' | 'done' | 'error'>('idle')
  const [mergeSubtitles, setMergeSubtitles] = useState(true)
  const [mergeProgressMsg, setMergeProgressMsg] = useState('')

  // Scene selection for merge
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(new Set())

  const allVideoReady = scenes.length > 0 && scenes.every(s => s.state === 'VIDEO_READY')
  const videoReadyScenes = scenes.filter(s => s.state === 'VIDEO_READY')
  const videoCount = videoReadyScenes.length

  // Reset selection when scenes change
  useEffect(() => {
    if (videoCount >= 2) {
      // Default: select all
      setSelectedSceneIds(new Set(videoReadyScenes.map(s => s.id)))
    }
  }, [videoCount, scenes.map(s => s.id + s.state).join(',')])

  const selectedCount = videoReadyScenes.filter(s => selectedSceneIds.has(s.id)).length

  const toggleScene = (sceneId: string) => {
    setSelectedSceneIds(prev => {
      const next = new Set(prev)
      if (next.has(sceneId)) {
        next.delete(sceneId)
      } else {
        next.add(sceneId)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedCount === videoCount) {
      setSelectedSceneIds(new Set())
    } else {
      setSelectedSceneIds(new Set(videoReadyScenes.map(s => s.id)))
    }
  }

  // Timer effect
  useEffect(() => {
    if (pipelineStatus === 'running') {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [pipelineStatus])

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return m > 0 ? `${m}分${s}秒` : `${s}秒`
  }

  const runAutoPipeline = async () => {
    if (!currentProject || scenes.length === 0) return
    if (pipelineStatus === 'running') return
    setPipelineStatus('running')
    startTimeRef.current = Date.now()
    setElapsed(0)
    setStats({ images: 0, videos: 0, imgTime: 0, vidTime: 0 })

    const keys = getApiKeys()
    const pool = keys.length > 0 ? keys : ['']
    const primaryKey = pool[0]
    const MAX_CONSECUTIVE_FAILURES = 10
    let consecutiveFailures = 0
    let stopped = false

    const refreshProgress = () => {
      const cs = useAppStore.getState().scenes
      const total = cs.length
      const imgDone = cs.filter(s => s.state !== 'DRAFT' && s.state !== 'GENERATING_IMG').length
      const videoDone = cs.filter(s => s.state === 'VIDEO_READY').length
      const imgProgress = total > 0 ? (imgDone / total) * 40 : 0
      const vidProgress = total > 0 ? (videoDone / total) * 45 : 0
      setPipelineProgress(Math.round(imgProgress + vidProgress))
      setPipelineStep(`图片 ${imgDone}/${total}，视频 ${videoDone}/${total}（${pool.length} Key 并行）`)
    }

    // Atomically claim the next task (no await between read and mark → race-free)
    type Task = { id: string; kind: 'image' | 'video' | 'retry' }
    const claimTask = (): Task | 'wait' | 'done' | 'stop' => {
      const state = useAppStore.getState()
      if (state.pipelineStatus !== 'running' || stopped) return 'stop'
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) return 'stop'
      const cs = state.scenes
      const total = cs.length
      const videoDone = cs.filter(s => s.state === 'VIDEO_READY').length
      if (videoDone === total) return 'done'

      const draft = cs.find(s => s.state === 'DRAFT')
      if (draft) {
        updateScene(draft.id, { state: 'GENERATING_IMG', errorMessage: null })
        return { id: draft.id, kind: 'image' }
      }
      const allImagesComplete = !cs.some(s => s.state === 'DRAFT' || s.state === 'GENERATING_IMG')
      const err = cs.find(s => s.state === 'ERROR')
      if (err && !allImagesComplete) {
        updateScene(err.id, { state: 'GENERATING_IMG', errorMessage: null })
        return { id: err.id, kind: 'image' }
      }
      if (allImagesComplete) {
        const imgReady = cs.find(s => s.state === 'IMG_READY')
        if (imgReady) {
          updateScene(imgReady.id, { state: 'GENERATING_VIDEO', errorMessage: null })
          return { id: imgReady.id, kind: 'video' }
        }
        if (err) {
          updateScene(err.id, { state: 'GENERATING_VIDEO', errorMessage: null })
          return { id: err.id, kind: 'retry' }
        }
      }
      return 'wait'
    }

    const doImage = async (sceneId: string, key: string) => {
      const t0 = Date.now()
      try {
        const ctx = await sceneApi.getContext(sceneId)
        const imageUrl = await generateImage(ctx.prompt, ctx.size, key, ctx.referenceImages?.length > 0 ? ctx.referenceImages : undefined)
        await sceneApi.saveImage(sceneId, imageUrl, ctx.prompt, ctx.size)
        updateScene(sceneId, { state: 'IMG_READY', errorMessage: null })
        consecutiveFailures = 0
        setStats(prev => ({ ...prev, images: prev.images + 1, imgTime: prev.imgTime + (Date.now() - t0) }))
      } catch (e: any) {
        updateScene(sceneId, { state: 'ERROR', errorMessage: e.message })
        consecutiveFailures++
      }
    }

    const doVideo = async (sceneId: string, key: string) => {
      const t0 = Date.now()
      try {
        const ctx = await sceneApi.getVideoContext(sceneId)
        const { videoId } = await generateVideo(ctx.prompt, ctx.imageBase64, ctx.width, ctx.height, ctx.numFrames, key)
        const maxPollTime = 5 * 60 * 1000
        const startTime = Date.now()
        let videoUrl = ''
        while (Date.now() - startTime < maxPollTime) {
          await new Promise(resolve => setTimeout(resolve, 5000))
          const result = await pollVideoStatus(videoId, key)
          if (result.status === 'completed' && result.url) { videoUrl = result.url; break }
          if (result.status === 'failed') throw new Error('视频生成失败')
        }
        if (!videoUrl) throw new Error('视频生成超时')
        await sceneApi.saveVideo(sceneId, videoUrl, videoId)
        updateScene(sceneId, { state: 'VIDEO_READY', errorMessage: null })
        consecutiveFailures = 0
        setStats(prev => ({ ...prev, videos: prev.videos + 1, vidTime: prev.vidTime + (Date.now() - t0) }))
      } catch (e: any) {
        updateScene(sceneId, { state: 'ERROR', errorMessage: e.message })
        consecutiveFailures++
      }
    }

    // ERROR scene when all images done: check if it already has an image → video, else image
    const doRetry = async (sceneId: string, key: string) => {
      await new Promise(resolve => setTimeout(resolve, 15000))
      let hasImage = false
      try {
        const imgRes = await fetch(`/api/scene/image?sceneId=${sceneId}`, { headers: { 'x-api-key': primaryKey } })
        const imgData = await imgRes.json()
        hasImage = !!imgData.filePath
      } catch {}
      if (hasImage) {
        await doVideo(sceneId, key)
      } else {
        updateScene(sceneId, { state: 'GENERATING_IMG', errorMessage: null })
        await doImage(sceneId, key)
      }
    }

    const worker = async (key: string) => {
      while (true) {
        const task = claimTask()
        if (task === 'stop' || task === 'done') return
        if (task === 'wait') { await new Promise(r => setTimeout(r, 2000)); continue }
        refreshProgress()
        if (task.kind === 'image') await doImage(task.id, key)
        else if (task.kind === 'video') await doVideo(task.id, key)
        else await doRetry(task.id, key)
        refreshProgress()
      }
    }

    try {
      await Promise.all(pool.map(k => worker(k)))

      if (useAppStore.getState().pipelineStatus !== 'running') return
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        setPipelineStep(`连续失败 ${MAX_CONSECUTIVE_FAILURES} 次，已暂停`)
        setPipelineStatus('paused')
        return
      }
      setPipelineProgress(85)
      setPipelineStep('完成! 可以合成视频了')
      setPipelineStatus('completed')
    } catch (e: any) {
      setPipelineStep(`错误: ${e.message}`)
      setPipelineStatus('error')
    }
  }

  const handleStop = () => {
    setPipelineStatus('paused')
    setPipelineStep('已停止')
  }

  /** Client-side merge — only merges SELECTED scenes */
  const handleClientMerge = async () => {
    if (!currentProject || selectedCount < 1) return

    setMergeStatus('merging')

    const projectName = currentProject.dramaTitle || currentProject.name || 'video'
    const episodeNumber = currentEpisodeId
      ? (() => {
          const ep = useAppStore.getState().episodes.find(e => e.id === currentEpisodeId)
          return ep ? `第${ep.number}集` : ''
        })()
      : ''
    const filename = `${projectName}${episodeNumber ? '_' + episodeNumber : ''}_merged.mp4`

    try {
      // Only use selected scenes
      const selectedScenes = videoReadyScenes.filter(s => selectedSceneIds.has(s.id))

      const sceneVideos = selectedScenes.map((s, i) => {
        const url = videoUrls[s.id] || ''
        return {
          url,
          dialogue: s.dialogue,
          duration: s.duration,
          sceneId: s.id,
          order: i,
        }
      })

      for (const sv of sceneVideos) {
        if (!sv.url) throw new Error(`场景 ${sv.order + 1} 视频地址未就绪`)
      }

      const result: MergeResult = await mergeVideosWithSubtitles(
        sceneVideos,
        mergeSubtitles,
        (progress: ProgressStep) => {
          switch (progress.step) {
            case 'download':
              setMergeProgressMsg(`正在下载视频 ${progress.index}/${progress.total}...`)
              break
            case 'parse':
              setMergeProgressMsg(`正在解析视频 ${progress.index}/${progress.total}...`)
              break
            case 'merge':
              setMergeProgressMsg('正在合并视频轨道...')
              break
            case 'subtitle':
              setMergeProgressMsg('正在生成字幕...')
              break
            case 'done':
              setMergeProgressMsg('处理完成，开始下载...')
              break
          }
        }
      )

      downloadBlob(result.blob, filename)
      if (result.srtBlob) {
        // Small delay to avoid browser blocking two rapid downloads
        setTimeout(() => {
          downloadBlob(result.srtBlob!, filename.replace(/\.mp4$/i, '.srt'))
        }, 300)
      }
      setMergeStatus('done')
      const msg = result.srtBlob
        ? '合并下载完成！(MP4 + SRT字幕)'
        : '合并下载完成！'
      setMergeProgressMsg(msg)
    } catch (e: any) {
      setMergeStatus('error')
      setMergeProgressMsg(`客户端合并失败: ${e.message}`)
    }
  }

  return (
    <div className="p-4 space-y-3" style={{ background: 'var(--color-surface)' }}>
      <div className="flex items-center gap-3 flex-wrap">
        {currentProject?.isOwner !== false && pipelineStatus !== 'running' && (
          <button onClick={() => { resetPipeline(); runAutoPipeline() }}
            disabled={scenes.length === 0}
            className="btn-primary px-4 py-2 disabled:opacity-50">
            一键生成
          </button>
        )}
        {pipelineStatus === 'running' && (
          <button onClick={handleStop}
            className="btn-outline px-4 py-2">
            停止
          </button>
        )}
      </div>

      {(pipelineStatus === 'running' || pipelineStatus === 'paused' || pipelineStatus === 'completed' || pipelineStatus === 'error') && (
        <div className="space-y-2">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{pipelineStep}</p>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${pipelineProgress}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <span>{pipelineProgress}%</span>
            <span>⏱ {formatElapsed(elapsed)}</span>
          </div>
          {(stats.images > 0 || stats.videos > 0) && (
            <div className="text-xs space-x-3" style={{ color: 'var(--color-text-secondary)' }}>
              {stats.images > 0 && <span>图片 {stats.images} 张 (均 {Math.round(stats.imgTime / stats.images / 1000)}秒/张)</span>}
              {stats.videos > 0 && <span>视频 {stats.videos} 个 (均 {Math.round(stats.vidTime / stats.videos / 1000)}秒/个)</span>}
            </div>
          )}
        </div>
      )}

      {/* ── Client-Side Merge Panel (2+ videos, shows when at least 2 ready) ── */}
      {videoCount >= 2 || mergeStatus !== 'idle' ? (
        <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
          <h4 className="text-sm font-medium text-gray-300">
            合并下载 ({selectedCount}/{videoCount} 个视频)
          </h4>

          {/* Scene selection checkboxes */}
          <div className="space-y-1 max-h-40 overflow-y-auto">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer pb-1 border-b border-white/5">
              <input
                type="checkbox"
                checked={selectedCount === videoCount}
                onChange={toggleAll}
                disabled={mergeStatus === 'merging'}
                className="w-3 h-3"
              />
              全选 / 取消全选
            </label>
            {videoReadyScenes.map((s, i) => (
              <label key={s.id} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={selectedSceneIds.has(s.id)}
                  onChange={() => toggleScene(s.id)}
                  disabled={mergeStatus === 'merging'}
                  className="w-3 h-3"
                />
                场景 {i + 1}
                <span className="text-gray-500">{s.duration}s</span>
                {s.dialogue.trim() && <span className="text-indigo-400/70">💬</span>}
              </label>
            ))}
          </div>

          {/* Subtitle toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={mergeSubtitles}
              onChange={(e) => setMergeSubtitles(e.target.checked)}
              disabled={mergeStatus === 'merging'}
              className="w-4 h-4"
            />
            包含软字幕（MP4 内嵌）
          </label>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            {mergeStatus !== 'merging' && (
              <button
                onClick={handleClientMerge}
                disabled={selectedCount < 1}
                className="btn-success px-4 py-2 disabled:opacity-50"
              >
                {mergeStatus === 'done'
                  ? '重新合并下载'
                  : selectedCount < videoCount
                    ? `合并下载 (已选 ${selectedCount} 个)`
                    : '合并下载 MP4'}
              </button>
            )}

          </div>

          {/* Progress */}
          {mergeStatus === 'merging' && (
            <div className="space-y-1">
              <p className="text-sm text-indigo-300 animate-pulse">{mergeProgressMsg}</p>
              <div className="progress-bar">
                <div className="progress-bar-fill progress-bar-indeterminate" />
              </div>
            </div>
          )}

          {mergeStatus === 'done' && (
            <p className="text-sm text-green-400">{mergeProgressMsg}</p>
          )}

          {mergeStatus === 'error' && (
            <p className="text-sm text-red-400">{mergeProgressMsg}</p>
          )}

          {/* Soft subtitle notice */}
          {mergeSubtitles && (
            <p className="text-xs text-amber-400/70">
              ⚠ 软字幕为 MP4 内嵌字幕轨道，浏览器的 &lt;video&gt; 标签不支持显示。
              请使用 <strong>VLC</strong> / <strong>PotPlayer</strong> / <strong>IINA</strong> 等播放器打开下载的视频，即可在字幕菜单中开启中文字幕。
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
