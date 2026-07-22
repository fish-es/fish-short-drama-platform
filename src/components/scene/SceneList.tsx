'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { sceneApi } from '@/services/api.client'

function assetUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `/api/file?path=${encodeURIComponent(path)}`
}

const isOwnerProject = () => useAppStore.getState().currentProject?.isOwner !== false

export default function SceneList() {
  const { scenes, updateScene } = useAppStore()
  const [images, setImages] = useState<Record<string, string>>({})
  const [videos, setVideos] = useState<Record<string, string>>({})
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editDialogue, setEditDialogue] = useState('')

  useEffect(() => {
    scenes.forEach(scene => {
      if ((scene.state === 'IMG_READY' || scene.state === 'VIDEO_READY') && !images[scene.id]) {
        fetch(`/api/scene/image?sceneId=${scene.id}`)
          .then(res => res.json())
          .then(data => { if (data.filePath) setImages(prev => ({ ...prev, [scene.id]: data.filePath })) })
          .catch(() => {})
      }
      if (scene.state === 'VIDEO_READY' && !videos[scene.id]) {
        fetch(`/api/scene/video?sceneId=${scene.id}`)
          .then(res => res.json())
          .then(data => { if (data.filePath) setVideos(prev => ({ ...prev, [scene.id]: data.filePath })) })
          .catch(() => {})
      }
    })
  }, [scenes])

  const handleGenerateImage = async (sceneId: string) => {
    updateScene(sceneId, { state: 'GENERATING_IMG' })
    try {
      const result = await sceneApi.generateImage(sceneId)
      updateScene(sceneId, { state: 'IMG_READY', errorMessage: null })
      setImages(prev => ({ ...prev, [sceneId]: result.filePath }))
    } catch (e: any) {
      updateScene(sceneId, { state: 'ERROR', errorMessage: e.message })
    }
  }

  const handleGenerateVideo = async (sceneId: string) => {
    updateScene(sceneId, { state: 'GENERATING_VIDEO' })
    try {
      const result = await sceneApi.generateVideo(sceneId)
      updateScene(sceneId, { state: 'VIDEO_READY', errorMessage: null })
      if (result.filePath) setVideos(prev => ({ ...prev, [sceneId]: result.filePath }))
    } catch (e: any) {
      updateScene(sceneId, { state: 'ERROR', errorMessage: e.message })
    }
  }

  const handleSaveEdit = (sceneId: string) => {
    updateScene(sceneId, { description: editDesc, dialogue: editDialogue })
    setEditingId(null)
  }

  const stateLabels: Record<string, string> = {
    DRAFT: '待生成', GENERATING_IMG: '生成图片中', IMG_READY: '图片就绪',
    GENERATING_VIDEO: '生成视频中', VIDEO_READY: '视频就绪', ERROR: '错误'
  }
  const stateColors: Record<string, string> = {
    DRAFT: 'badge-gray', GENERATING_IMG: 'badge-yellow animate-pulse', IMG_READY: 'badge-blue',
    GENERATING_VIDEO: 'badge-yellow animate-pulse', VIDEO_READY: 'badge-green', ERROR: 'badge-gray text-red-400'
  }

  if (scenes.length === 0) return <div className="p-4 text-center text-gray-500 text-sm">暂无场景</div>

  return (
    <div className="p-4 space-y-3">
      {scenes.map((scene, i) => (
        <div key={scene.id} className="glass-card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">场景 {i + 1}</span>
            <div className="flex items-center gap-2">
              <span className={`badge ${stateColors[scene.state] || 'badge-gray'}`}>
                {stateLabels[scene.state] || scene.state}
              </span>
              <button onClick={() => { setEditingId(editingId === scene.id ? null : scene.id); setEditDesc(scene.description); setEditDialogue(scene.dialogue) }}
                className="text-xs text-gray-400 hover:text-white">
                {editingId === scene.id ? '取消' : '编辑'}
              </button>
            </div>
          </div>

          {editingId === scene.id ? (
            <div className="space-y-2 mb-2">
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                className="input-field w-full text-xs resize-none" rows={2}
                placeholder="画面描述" />
              <textarea value={editDialogue} onChange={e => setEditDialogue(e.target.value)}
                className="input-field w-full text-xs resize-none" rows={2}
                placeholder="台词" />
              <button onClick={() => handleSaveEdit(scene.id)} className="btn-success px-3 py-1 text-xs">保存</button>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 line-clamp-2 mb-1">{scene.description}</p>
              <p className="text-xs text-gray-300 line-clamp-1 mb-2">💬 {scene.dialogue}</p>
            </>
          )}

          {images[scene.id] && (
            <div className="mb-2 cursor-pointer" onClick={() => setPreviewImage(images[scene.id])}>
              <img src={assetUrl(images[scene.id])} alt={`Scene ${i + 1}`}
                className="w-full h-40 object-cover rounded hover:opacity-90 transition" />
            </div>
          )}

          {videos[scene.id] && (
            <div className="mb-2">
              <video src={assetUrl(videos[scene.id])} controls
                className="w-full h-32 rounded" />
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
                  className="btn-primary px-3 py-1 text-xs">重新生成图片</button>
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
            <span className="text-xs text-gray-500">{scene.duration}s</span>
          </div>

          {scene.errorMessage && <p className="mt-1 text-xs text-red-400">{scene.errorMessage}</p>}
        </div>
      ))}

      {previewImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer"
          onClick={() => setPreviewImage(null)}>
          <img src={assetUrl(previewImage)} alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  )
}
