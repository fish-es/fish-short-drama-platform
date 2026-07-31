'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { sceneApi, getApiKeys } from '@/services/api.client'
import { generateImage, generateVideo, pollVideoStatus } from '@/services/agnes.client'
import { showAlert, showConfirm } from '@/components/common/Dialog'
import {
  addSubtitleToVideo,
  downloadBlob,
  type SubtitleEntry,
} from '@/services/video-merger.client'
import { ProtectedImage, ProtectedVideo } from '@/components/common/ProtectedMedia'

function assetUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `/api/file?path=${encodeURIComponent(path)}`
}

const isOwnerProject = () => useAppStore.getState().currentProject?.isOwner !== false

export default function SceneList() {
  const { scenes, updateScene, setScenes, setVideoUrl } = useAppStore()
  const [images, setImages] = useState<Record<string, string>>({})
  const [videos, setVideos] = useState<Record<string, string>>({})
  const [previewImage, setPreviewImage] = useState<{ source: string; sceneId: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editDialogue, setEditDialogue] = useState('')
  const [fullPrompt, setFullPrompt] = useState<string>('')
  const [fullRefImages, setFullRefImages] = useState<string[]>([])
  const [videoPrompt, setVideoPrompt] = useState<string>('')
  const [loadingPrompt, setLoadingPrompt] = useState(false)
  const [downloadSubtitles] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadMsg, setDownloadMsg] = useState('')

  useEffect(() => {
    scenes.forEach(scene => {
      if ((scene.state === 'IMG_READY' || scene.state === 'VIDEO_READY') && !images[scene.id]) {
        fetch(`/api/scene/image?sceneId=${scene.id}`, {
          headers: { 'x-api-key': localStorage.getItem('agnes_api_key') || '' },
        })
          .then(res => res.json())
          .then(data => { if (data.filePath) setImages(prev => ({ ...prev, [scene.id]: data.filePath })) })
          .catch(() => {})
      }
      if (scene.state === 'VIDEO_READY' && !videos[scene.id]) {
        fetch(`/api/scene/video?sceneId=${scene.id}`, {
          headers: { 'x-api-key': localStorage.getItem('agnes_api_key') || '' },
        })
          .then(res => res.json())
          .then(data => { if (data.filePath) { setVideos(prev => ({ ...prev, [scene.id]: data.filePath })); setVideoUrl(scene.id, data.filePath) } })
          .catch(() => {})
      }
    })
  }, [scenes])

  const handleGenerateImage = async (sceneId: string) => {
    const key = getApiKeys()[0] || localStorage.getItem('agnes_api_key') || ''
    if (!key) { showAlert('请先设置 API Key'); return }
    updateScene(sceneId, { state: 'GENERATING_IMG' })
    try {
      // 浏览器端生成（走代理）：取上下文 → 生成 → 存回
      const ctx = await sceneApi.getContext(sceneId)
      const imageUrl = await generateImage(ctx.prompt, ctx.size, key, ctx.referenceImages?.length > 0 ? ctx.referenceImages : undefined)
      const result = await sceneApi.saveImage(sceneId, imageUrl, ctx.prompt, ctx.size)
      updateScene(sceneId, { state: 'IMG_READY', errorMessage: null })
      setImages(prev => ({ ...prev, [sceneId]: result.filePath || imageUrl }))
    } catch (e: any) {
      updateScene(sceneId, { state: 'ERROR', errorMessage: e.message })
    }
  }

  const handleGenerateVideo = async (sceneId: string) => {
    const key = getApiKeys()[0] || localStorage.getItem('agnes_api_key') || ''
    if (!key) { showAlert('请先设置 API Key'); return }
    updateScene(sceneId, { state: 'GENERATING_VIDEO' })
    try {
      // 浏览器端生成（走代理）：取视频上下文 → 生成 → 轮询 → 存回
      const ctx = await sceneApi.getVideoContext(sceneId)
      const { videoId } = await generateVideo(ctx.prompt, ctx.imageBase64, ctx.width, ctx.height, ctx.numFrames, key)
      const maxPollTime = 5 * 60 * 1000
      const startTime = Date.now()
      let videoUrl = ''
      while (Date.now() - startTime < maxPollTime) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        const r = await pollVideoStatus(videoId, key)
        if (r.status === 'completed' && r.url) { videoUrl = r.url; break }
        if (r.status === 'failed') throw new Error('视频生成失败')
      }
      if (!videoUrl) throw new Error('视频生成超时')
      const result = await sceneApi.saveVideo(sceneId, videoUrl, videoId)
      updateScene(sceneId, { state: 'VIDEO_READY', errorMessage: null })
      const finalUrl = result.filePath || videoUrl
      setVideos(prev => ({ ...prev, [sceneId]: finalUrl }))
      setVideoUrl(sceneId, finalUrl)
    } catch (e: any) {
      updateScene(sceneId, { state: 'ERROR', errorMessage: e.message })
    }
  }

  const handleSaveEdit = async (sceneId: string) => {
    updateScene(sceneId, { description: editDesc, dialogue: editDialogue })
    setEditingId(null)
    setFullPrompt(''); setFullRefImages([]); setVideoPrompt('')
    try { await sceneApi.updateText(sceneId, editDesc, editDialogue) } catch (e: any) { showAlert('保存失败: ' + e.message) }
  }

  const handleViewFullPrompt = async (sceneId: string) => {
    setLoadingPrompt(true)
    setFullPrompt('')
    try {
      // 先保存当前编辑，确保拼接用的是最新描述
      await sceneApi.updateText(sceneId, editDesc, editDialogue)
      updateScene(sceneId, { description: editDesc, dialogue: editDialogue })
      const ctx = await sceneApi.getContext(sceneId)
      setFullPrompt(ctx.prompt || '(无)')
      setFullRefImages(Array.isArray(ctx.referenceImages) ? ctx.referenceImages : [])
      // 视频提示词（需要场景已有图片才能取到）
      try {
        const vctx = await sceneApi.getVideoContext(sceneId)
        setVideoPrompt(vctx.prompt || '')
      } catch (e: any) {
        setVideoPrompt('（需先生成图片后才能预览视频提示词）')
      }
    } catch (e: any) {
      setFullPrompt('获取失败: ' + e.message)
      setFullRefImages([])
      setVideoPrompt('')
    } finally {
      setLoadingPrompt(false)
    }
  }

  const handleDeleteScene = async (sceneId: string) => {
    if (!(await showConfirm('确定删除这个场景吗？', { danger: true, confirmText: '删除' }))) return
    try {
      await sceneApi.remove(sceneId)
      setScenes(scenes.filter(s => s.id !== sceneId))
    } catch (e: any) { showAlert('删除失败: ' + e.message) }
  }

  const handleMoveScene = async (sceneId: string, dir: -1 | 1) => {
    const idx = scenes.findIndex(s => s.id === sceneId)
    const target = idx + dir
    if (target < 0 || target >= scenes.length) return
    const reordered = [...scenes]
    ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
    setScenes(reordered)
    try { await sceneApi.reorder(reordered.map(s => s.id)) } catch (e: any) { showAlert('排序失败: ' + e.message) }
  }

  const handleDownloadScene = async (sceneId: string, videoPath: string, dialogue: string, duration: number, sceneIndex: number) => {
    if (downloadingId) return
    setDownloadingId(sceneId)

    try {
      const hasDialogue = dialogue.trim().length > 0
      const projectName = useAppStore.getState().currentProject?.dramaTitle
        || useAppStore.getState().currentProject?.name
        || 'video'
      const filename = `${projectName}_场景${sceneIndex + 1}.mp4`

      if (!downloadSubtitles || !hasDialogue) {
        // Direct download — no subtitle processing needed
        setDownloadMsg('下载中...')
        const fetchUrl = videoPath.startsWith('http')
          ? `/api/proxy-video?url=${encodeURIComponent(videoPath)}`
          : assetUrl(videoPath)

        const res = await fetch(fetchUrl)
        if (!res.ok) throw new Error(`下载失败 (${res.status})`)
        const blob = await res.blob()
        downloadBlob(blob, filename)
      } else {
        // Download + embed soft subtitles
        setDownloadMsg('下载视频...')
        const fetchUrl = videoPath.startsWith('http')
          ? `/api/proxy-video?url=${encodeURIComponent(videoPath)}`
          : assetUrl(videoPath)

        const res = await fetch(fetchUrl)
        if (!res.ok) throw new Error(`下载失败 (${res.status})`)
        const buffer = await res.arrayBuffer()

        setDownloadMsg('封装字幕...')
        const subtitles: SubtitleEntry[] = [{
          startTime: 0,
          endTime: duration,
          text: dialogue,
        }]

        const result = await addSubtitleToVideo(buffer, subtitles)
        downloadBlob(result.blob, filename)
        if (result.srtBlob) {
          setTimeout(() => {
            downloadBlob(result.srtBlob!, filename.replace(/\.mp4$/i, '.srt'))
          }, 300)
        }
      }

      setDownloadMsg('')
    } catch (e: any) {
      showAlert(`下载失败: ${e.message}`)
      setDownloadMsg('')
    } finally {
      setDownloadingId(null)
    }
  }

  const stateLabels: Record<string, string> = {
    DRAFT: '待生成', GENERATING_IMG: '生成图片中', IMG_READY: '图片就绪',
    GENERATING_VIDEO: '生成视频中', VIDEO_READY: '视频就绪', ERROR: '错误'
  }
  const stateColors: Record<string, string> = {
    DRAFT: 'badge-gray', GENERATING_IMG: 'badge-yellow animate-pulse', IMG_READY: 'badge-blue',
    GENERATING_VIDEO: 'badge-yellow animate-pulse', VIDEO_READY: 'badge-green', ERROR: 'badge-gray'
  }

  if (scenes.length === 0) return <div className="p-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>暂无场景</div>

  return (
    <div className="p-4 space-y-3">
      {scenes.map((scene, i) => (
        <div key={scene.id} className="glass-card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>场景 {i + 1}</span>
            <div className="flex items-center gap-2">
              <span className={`badge ${stateColors[scene.state] || 'badge-gray'}`}>
                {stateLabels[scene.state] || scene.state}
              </span>
              {isOwnerProject() && (
                <>
                  <button onClick={() => handleMoveScene(scene.id, -1)} disabled={i === 0}
                    className="btn-ghost text-xs disabled:opacity-30" style={{ color: 'var(--color-text-secondary)' }} title="上移">↑</button>
                  <button onClick={() => handleMoveScene(scene.id, 1)} disabled={i === scenes.length - 1}
                    className="btn-ghost text-xs disabled:opacity-30" style={{ color: 'var(--color-text-secondary)' }} title="下移">↓</button>
                  <button
                    onClick={() => { setEditingId(editingId === scene.id ? null : scene.id); setEditDesc(scene.description); setEditDialogue(scene.dialogue); setFullPrompt(''); setFullRefImages([]); setVideoPrompt('') }}
                    className="btn-ghost text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    {editingId === scene.id ? '取消' : '编辑'}
                  </button>
                  <button onClick={() => handleDeleteScene(scene.id)} className="btn-ghost text-xs" style={{ color: 'var(--color-error)' }} title="删除场景">删除</button>
                </>
              )}
            </div>
          </div>

          {editingId === scene.id ? (
            <div className="space-y-2 mb-2">
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>画面描述（生成图片的主提示词）</label>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                className="input-field w-full text-xs" rows={6}
                style={{ resize: 'vertical', minHeight: 100 }}
                placeholder="画面描述" />
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>台词（生成视频时的对白）</label>
              <textarea value={editDialogue} onChange={e => setEditDialogue(e.target.value)}
                className="input-field w-full text-xs" rows={3}
                style={{ resize: 'vertical', minHeight: 60 }}
                placeholder="台词" />
              <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                实际生成图片时，系统会自动在描述后追加该场景角色和地点的外貌关键词。
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => handleSaveEdit(scene.id)} className="btn-success px-3 py-1 text-xs">保存</button>
                <button onClick={() => handleViewFullPrompt(scene.id)} className="btn-outline px-3 py-1 text-xs" disabled={loadingPrompt}>
                  {loadingPrompt ? '加载中...' : '查看完整提示词'}
                </button>
              </div>
              {fullPrompt && (
                <div style={{ marginTop: 6, padding: 8, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 4 }}>① 文字提示词：</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{fullPrompt}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 8, marginBottom: 4 }}>
                    ② 参考图（{fullRefImages.length} 张，作为角色/场景一致性参考一起发给 AI）：
                  </div>
                  {fullRefImages.length > 0 ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {fullRefImages.map((url, idx) => (
                        <img key={idx} src={url} alt={`ref${idx}`}
                          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--color-border)' }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>无参考图（该场景的角色/地点还没有生成参考图）</div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 10, marginBottom: 4 }}>③ 视频生成提示词（含说话人、台词、口型指令，以场景当前图片为首帧）：</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{videoPrompt || '（无台词或未生成图片）'}</div>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs line-clamp-2 mb-1" style={{ color: 'var(--color-text-secondary)' }}>{scene.description}</p>
              <p className="text-xs line-clamp-1 mb-2" style={{ color: 'var(--color-text-tertiary)' }}>💬 {scene.dialogue}</p>
            </>
          )}

          {images[scene.id] && (
            <div className="mb-2 cursor-pointer">
              <ProtectedImage
                source={images[scene.id]}
                protectedUrl={`/api/file?kind=scene-image&id=${encodeURIComponent(scene.id)}`}
                alt={`Scene ${i + 1}`}
                className="w-full h-40 object-cover rounded transition"
                onClick={() => setPreviewImage({ source: images[scene.id], sceneId: scene.id })}
              />
            </div>
          )}

          {videos[scene.id] && (
            <div className="mb-2">
              <ProtectedVideo
                source={videos[scene.id]}
                protectedUrl={`/api/file?kind=scene-video&id=${encodeURIComponent(scene.id)}`}
                controls
                className="w-full h-32 rounded"
              />
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => handleDownloadScene(scene.id, videos[scene.id], scene.dialogue, scene.duration, i)}
                  disabled={downloadingId === scene.id}
                  className="btn-primary px-2 py-0.5 text-xs disabled:opacity-50"
                >
                  {downloadingId === scene.id
                    ? (downloadMsg || '处理中...')
                    : '⬇ 下载'}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {isOwnerProject() && (scene.state === 'DRAFT' || scene.state === 'ERROR') && (
              <button onClick={() => handleGenerateImage(scene.id)}
                className="btn-primary px-3 py-1 text-xs">生成图片</button>
            )}
            {isOwnerProject() && (scene.state === 'IMG_READY' || scene.state === 'VIDEO_READY') && (
              <>
                <button onClick={() => handleGenerateImage(scene.id)}
                  className="btn-outline px-3 py-1 text-xs">重新生成图片</button>
                <button onClick={() => handleGenerateVideo(scene.id)}
                  className="btn-primary px-3 py-1 text-xs">
                  {scene.state === 'VIDEO_READY' ? '重新生成视频' : '生成视频'}
                </button>
              </>
            )}
            {isOwnerProject() && scene.state === 'ERROR' && images[scene.id] && (
              <button onClick={() => handleGenerateVideo(scene.id)}
                className="btn-primary px-3 py-1 text-xs">重试视频</button>
            )}
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{scene.duration}s</span>
          </div>

          {scene.errorMessage && <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>{scene.errorMessage}</p>}
        </div>
      ))}

      {previewImage && (
        <div
          className="modal-overlay"
          onClick={() => setPreviewImage(null)}
          style={{ cursor: 'pointer' }}>
          <ProtectedImage
            source={previewImage.source}
            protectedUrl={`/api/file?kind=scene-image&id=${encodeURIComponent(previewImage.sceneId)}`}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  )
}
