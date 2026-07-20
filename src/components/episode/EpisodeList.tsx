'use client'

import { useState } from 'react'
import { useAppStore } from '@/store'
import { episodeApi } from '@/services/api.client'

export default function EpisodeList() {
  const { currentProject, episodes, scriptId, currentEpisodeId, setCurrentEpisodeId, updateEpisode, setScenes, resetPipeline } = useAppStore()
  const [generating, setGenerating] = useState<string | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)

  const handleGenerate = async (episodeId: string) => {
    if (!currentProject) return
    setGenerating(episodeId)
    try {
      const result = await episodeApi.generate(episodeId, currentProject.id)
      updateEpisode(episodeId, { status: 'generated' })
      setCurrentEpisodeId(episodeId)
      setScenes(result.scenes)
      resetPipeline()
    } catch (e: any) {
      alert(`生成失败: ${e.message}`)
    } finally {
      setGenerating(null)
    }
  }

  const handleView = async (episodeId: string) => {
    resetPipeline()
    setCurrentEpisodeId(episodeId)
    const scenes = await episodeApi.getScenes(episodeId)
    setScenes(scenes)
  }

  const handleGenerateAll = async () => {
    if (!currentProject) return
    setGeneratingAll(true)
    for (const ep of episodes) {
      if (ep.status === 'pending') {
        setGenerating(ep.id)
        try {
          await episodeApi.generate(ep.id, currentProject.id)
          updateEpisode(ep.id, { status: 'generated' })
        } catch {
          break
        } finally {
          setGenerating(null)
        }
      }
    }
    setGeneratingAll(false)
  }

  if (episodes.length === 0) {
    return <div className="p-4 text-center text-gray-500 text-sm">暂无剧集，先生成大纲</div>
  }

  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">{episodes.length} 集</h3>
        <button onClick={handleGenerateAll} disabled={generatingAll}
          className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded">
          {generatingAll ? '生成中...' : '一键生成全部'}
        </button>
      </div>

      {episodes.map(ep => (
        <div key={ep.id}
          className={`p-3 rounded-lg border cursor-pointer transition ${
            currentEpisodeId === ep.id ? 'bg-blue-900/30 border-blue-600' : 'bg-gray-800 border-gray-700 hover:border-gray-600'
          }`}
          onClick={() => ep.status === 'generated' && handleView(ep.id)}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">第 {ep.number} 集</span>
            <span className={`px-2 py-0.5 rounded text-xs ${
              ep.status === 'generated' ? 'bg-green-600' : generating === ep.id ? 'bg-yellow-600 animate-pulse' : 'bg-gray-600'
            }`}>
              {generating === ep.id ? '生成中...' : ep.status === 'generated' ? '已生成' : '待生成'}
            </span>
          </div>
          <p className="text-xs text-gray-300">{ep.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ep.summary}</p>
          {ep.status === 'pending' && generating !== ep.id && (
            <button onClick={(e) => { e.stopPropagation(); handleGenerate(ep.id) }}
              className="mt-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded">
              生成本集场景
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
