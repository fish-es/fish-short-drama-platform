'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { sceneApi } from '@/services/api.client'
import { generateImage, generateVideo, pollVideoStatus } from '@/services/agnes.client'

export default function PipelineControl() {
  const { scenes, currentProject, currentEpisodeId, pipelineStatus, pipelineStep, pipelineProgress,
    updateScene, setPipelineStatus, setPipelineStep, setPipelineProgress, resetPipeline } = useAppStore()
  const [subtitles, setSubtitles] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [stats, setStats] = useState({ images: 0, videos: 0, imgTime: 0, vidTime: 0 })
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  const allVideoReady = scenes.length > 0 && scenes.every(s => s.state === 'VIDEO_READY')

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

    try {
      const MAX_CONSECUTIVE_FAILURES = 10
      let consecutiveFailures = 0

      while (true) {
        const currentScenes = useAppStore.getState().scenes
        const totalScenes = currentScenes.length
        const imgDone = currentScenes.filter(s => s.state !== 'DRAFT' && s.state !== 'GENERATING_IMG').length
        const videoDone = currentScenes.filter(s => s.state === 'VIDEO_READY').length
        const allDone = videoDone === totalScenes
        const inProgress = currentScenes.some(s => s.state === 'GENERATING_IMG' || s.state === 'GENERATING_VIDEO')

        const imgProgress = totalScenes > 0 ? (imgDone / totalScenes) * 40 : 0
        const vidProgress = totalScenes > 0 ? (videoDone / totalScenes) * 45 : 0
        setPipelineProgress(Math.round(imgProgress + vidProgress))
        setPipelineStep(`图片 ${imgDone}/${totalScenes}，视频 ${videoDone}/${totalScenes}`)

        if (allDone) break
        if (useAppStore.getState().pipelineStatus !== 'running') return

        // Safety: too many consecutive failures
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          setPipelineStep(`连续失败 ${MAX_CONSECUTIVE_FAILURES} 次，已暂停`)
          setPipelineStatus('paused')
          return
        }

        if (inProgress) {
          await new Promise(resolve => setTimeout(resolve, 3000))
          continue
        }

        const draftScene = currentScenes.find(s => s.state === 'DRAFT')
        const errorScene = currentScenes.find(s => s.state === 'ERROR')
        const imgReadyScene = currentScenes.find(s => s.state === 'IMG_READY')

        // Priority: DRAFT first, then ERROR (retry), then IMG_READY (video)
        // This ensures all images are done before starting videos
        const allImagesComplete = !currentScenes.some(s => s.state === 'DRAFT' || s.state === 'GENERATING_IMG')
        const hasImageErrors = currentScenes.some(s => s.state === 'ERROR')

        if (draftScene) {
          setPipelineStep(`生成图片 (${imgDone}/${totalScenes})`)
          const t0 = Date.now()
          try {
            const apiKey = localStorage.getItem('agnes_api_key') || ''
            const ctx = await sceneApi.getContext(draftScene.id)
            const imageUrl = await generateImage(ctx.prompt, ctx.size, apiKey, ctx.referenceImages?.length > 0 ? ctx.referenceImages : undefined)
            await sceneApi.saveImage(draftScene.id, imageUrl, ctx.prompt, ctx.size)
            updateScene(draftScene.id, { state: 'IMG_READY', errorMessage: null })
            consecutiveFailures = 0
            setStats(prev => ({ ...prev, images: prev.images + 1, imgTime: prev.imgTime + (Date.now() - t0) }))
          } catch (e: any) {
            updateScene(draftScene.id, { state: 'ERROR', errorMessage: e.message })
            consecutiveFailures++
          }
        } else if (errorScene && !allImagesComplete) {
          setPipelineStep(`重试失败图片... 等待15秒`)
          await new Promise(resolve => setTimeout(resolve, 15000))
          try {
            const apiKey = localStorage.getItem('agnes_api_key') || ''
            updateScene(errorScene.id, { state: 'GENERATING_IMG', errorMessage: null })
            const ctx = await sceneApi.getContext(errorScene.id)
            const imageUrl = await generateImage(ctx.prompt, ctx.size, apiKey, ctx.referenceImages?.length > 0 ? ctx.referenceImages : undefined)
            await sceneApi.saveImage(errorScene.id, imageUrl, ctx.prompt, ctx.size)
            updateScene(errorScene.id, { state: 'IMG_READY', errorMessage: null })
            consecutiveFailures = 0
          } catch (e: any) {
            updateScene(errorScene.id, { state: 'ERROR', errorMessage: e.message })
            consecutiveFailures++
          }
        } else if (imgReadyScene) {
          setPipelineStep(`生成视频 (${videoDone}/${totalScenes})`)
          const t0 = Date.now()
          try {
            const apiKey = localStorage.getItem('agnes_api_key') || ''
            const ctx = await sceneApi.getVideoContext(imgReadyScene.id)
            const { videoId } = await generateVideo(ctx.prompt, ctx.imageBase64, ctx.width, ctx.height, ctx.numFrames, apiKey)
            // Poll for completion
            const maxPollTime = 5 * 60 * 1000
            const pollInterval = 5000
            const startTime = Date.now()
            let videoUrl = ''
            while (Date.now() - startTime < maxPollTime) {
              await new Promise(resolve => setTimeout(resolve, pollInterval))
              const result = await pollVideoStatus(videoId, apiKey)
              if (result.status === 'completed' && result.url) { videoUrl = result.url; break }
              if (result.status === 'failed') throw new Error('视频生成失败')
            }
            if (!videoUrl) throw new Error('视频生成超时')
            await sceneApi.saveVideo(imgReadyScene.id, videoUrl, videoId)
            updateScene(imgReadyScene.id, { state: 'VIDEO_READY', errorMessage: null })
            consecutiveFailures = 0
            setStats(prev => ({ ...prev, videos: prev.videos + 1, vidTime: prev.vidTime + (Date.now() - t0) }))
          } catch (e: any) {
            updateScene(imgReadyScene.id, { state: 'ERROR', errorMessage: e.message })
            consecutiveFailures++
          }

          // After each video, retry a failed image if any
          const freshScenes = useAppStore.getState().scenes
          const failedImageScene = freshScenes.find(s => s.state === 'ERROR')
          if (failedImageScene) {
            setPipelineStep(`视频完成，顺便重试失败的图片...`)
            try {
              const apiKey = localStorage.getItem('agnes_api_key') || ''
              const imgRes = await fetch(`/api/scene/image?sceneId=${failedImageScene.id}`)
              const imgData = await imgRes.json()
              if (!imgData.filePath) {
                updateScene(failedImageScene.id, { state: 'GENERATING_IMG', errorMessage: null })
                const ctx = await sceneApi.getContext(failedImageScene.id)
                const imageUrl = await generateImage(ctx.prompt, ctx.size, apiKey, ctx.referenceImages?.length > 0 ? ctx.referenceImages : undefined)
                await sceneApi.saveImage(failedImageScene.id, imageUrl, ctx.prompt, ctx.size)
                updateScene(failedImageScene.id, { state: 'IMG_READY', errorMessage: null })
                consecutiveFailures = 0
              }
            } catch {}
          }
        } else if (errorScene) {
          setPipelineStep(`重试失败场景... 等待15秒`)
          await new Promise(resolve => setTimeout(resolve, 15000))

          let hasImage = false
          try {
            const imgRes = await fetch(`/api/scene/image?sceneId=${errorScene.id}`)
            const imgData = await imgRes.json()
            hasImage = !!imgData.filePath
          } catch {}

          if (hasImage) {
            try {
              const apiKey = localStorage.getItem('agnes_api_key') || ''
              updateScene(errorScene.id, { state: 'GENERATING_VIDEO', errorMessage: null })
              const ctx = await sceneApi.getVideoContext(errorScene.id)
              const { videoId } = await generateVideo(ctx.prompt, ctx.imageBase64, ctx.width, ctx.height, ctx.numFrames, apiKey)
              const maxPollTime = 5 * 60 * 1000
              const pollInterval = 5000
              const startTime = Date.now()
              let videoUrl = ''
              while (Date.now() - startTime < maxPollTime) {
                await new Promise(resolve => setTimeout(resolve, pollInterval))
                const result = await pollVideoStatus(videoId, apiKey)
                if (result.status === 'completed' && result.url) { videoUrl = result.url; break }
                if (result.status === 'failed') throw new Error('视频生成失败')
              }
              if (!videoUrl) throw new Error('视频生成超时')
              await sceneApi.saveVideo(errorScene.id, videoUrl, videoId)
              updateScene(errorScene.id, { state: 'VIDEO_READY', errorMessage: null })
              consecutiveFailures = 0
            } catch (e: any) {
              updateScene(errorScene.id, { state: 'ERROR', errorMessage: e.message })
              consecutiveFailures++
            }
          } else {
            try {
              const apiKey = localStorage.getItem('agnes_api_key') || ''
              updateScene(errorScene.id, { state: 'GENERATING_IMG', errorMessage: null })
              const ctx = await sceneApi.getContext(errorScene.id)
              const imageUrl = await generateImage(ctx.prompt, ctx.size, apiKey, ctx.referenceImages?.length > 0 ? ctx.referenceImages : undefined)
              await sceneApi.saveImage(errorScene.id, imageUrl, ctx.prompt, ctx.size)
              updateScene(errorScene.id, { state: 'IMG_READY', errorMessage: null })
              consecutiveFailures = 0
            } catch (e: any) {
              updateScene(errorScene.id, { state: 'ERROR', errorMessage: e.message })
              consecutiveFailures++
            }
          }
        } else {
          break
        }
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

  const handleAssemble = async () => {
    if (!currentProject) return
    setPipelineStatus('running')
    setPipelineStep('合成最终视频...')
    try {
      const res = await fetch('/api/ffmpeg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': localStorage.getItem('agnes_api_key') || '' },
        body: JSON.stringify({ projectId: currentProject.id, episodeId: currentEpisodeId, subtitles })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Download via browser
      const fileRes = await fetch(`/api/file?path=${encodeURIComponent(data.path)}`)
      const blob = await fileRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.path.split(/[/\\]/).pop() || 'video.mp4'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setPipelineStatus('completed')
      setPipelineStep('合成完成，已下载')
    } catch (e: any) {
      setPipelineStep(`合成失败: ${e.message}`)
      setPipelineStatus('error')
    }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        {currentProject?.isOwner !== false && pipelineStatus !== 'running' && (
          <button onClick={() => { resetPipeline(); runAutoPipeline() }}
            disabled={scenes.length === 0}
            className="btn-success px-4 py-2 disabled:opacity-50">
            一键生成
          </button>
        )}
        {pipelineStatus === 'running' && (
          <button onClick={handleStop}
            className="btn-danger px-4 py-2">
            停止
          </button>
        )}
      </div>

      {(pipelineStatus === 'running' || pipelineStatus === 'paused' || pipelineStatus === 'completed' || pipelineStatus === 'error') && (
        <div className="space-y-2">
          <p className="text-sm text-gray-300">{pipelineStep}</p>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${pipelineProgress}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{pipelineProgress}%</span>
            <span>⏱ {formatElapsed(elapsed)}</span>
          </div>
          {(stats.images > 0 || stats.videos > 0) && (
            <div className="text-xs text-gray-500 space-x-3">
              {stats.images > 0 && <span>图片 {stats.images} 张 (均 {Math.round(stats.imgTime / stats.images / 1000)}秒/张)</span>}
              {stats.videos > 0 && <span>视频 {stats.videos} 个 (均 {Math.round(stats.vidTime / stats.videos / 1000)}秒/个)</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
