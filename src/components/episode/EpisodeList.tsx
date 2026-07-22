'use client'

import { useState } from 'react'
import { useAppStore } from '@/store'
import { episodeApi } from '@/services/api.client'
import { generateEpisodeScenes, parseEpisodeScenesResponse } from '@/services/script.client'

export default function EpisodeList() {
  const { currentProject, episodes, scriptId, currentEpisodeId, setCurrentEpisodeId, updateEpisode, setScenes, resetPipeline } = useAppStore()
  const [generating, setGenerating] = useState<string | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)

  const handleGenerate = async (episodeId: string) => {
    if (!currentProject) return
    setGenerating(episodeId)
    try {
      const apiKey = localStorage.getItem('agnes_api_key') || ''
      const ctx = await episodeApi.getContext(episodeId)

      let parsed: { scenes: any[] } | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const content = await generateEpisodeScenes(ctx.outlineContent, ctx.epNumber, ctx.previousSummary, apiKey)
        try {
          parsed = parseEpisodeScenesResponse(content)
          break
        } catch {
          if (attempt >= 2) throw new Error(`第 ${ctx.epNumber} 集生成失败`)
        }
      }
      if (!parsed) throw new Error('生成失败')

      const result = await episodeApi.saveScenes(episodeId, ctx.scriptId, parsed.scenes)
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
          const apiKey = localStorage.getItem('agnes_api_key') || ''
          const ctx = await episodeApi.getContext(ep.id)

          let parsed: { scenes: any[] } | null = null
          for (let attempt = 0; attempt < 3; attempt++) {
            const content = await generateEpisodeScenes(ctx.outlineContent, ctx.epNumber, ctx.previousSummary, apiKey)
            try {
              parsed = parseEpisodeScenesResponse(content)
              break
            } catch {
              if (attempt >= 2) break
            }
          }
          if (parsed) {
            await episodeApi.saveScenes(ep.id, ctx.scriptId, parsed.scenes)
            updateEpisode(ep.id, { status: 'generated' })
          }
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

  const isOwner = currentProject?.isOwner !== false

  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">{episodes.length} 集</h3>
        {isOwner && (
          <button onClick={handleGenerateAll} disabled={generatingAll}
            className="btn-success px-3 py-1 text-xs disabled:opacity-50">
            {generatingAll ? '生成中...' : '一键生成全部'}
          </button>
        )}
      </div>

      {episodes.map(ep => (
        <div key={ep.id}
          className={`glass-card p-3 cursor-pointer transition ${
            currentEpisodeId === ep.id ? 'border-indigo-600' : ''
          }`}
          onClick={() => ep.status === 'generated' && handleView(ep.id)}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">第 {ep.number} 集</span>
            <span className={`badge ${
              ep.status === 'generated' ? 'badge-green' : generating === ep.id ? 'badge-yellow animate-pulse' : 'badge-gray'
            }`}>
              {generating === ep.id ? '生成中...' : ep.status === 'generated' ? '已生成' : '待生成'}
            </span>
          </div>
          <p className="text-xs text-gray-300">{ep.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ep.summary}</p>
          {isOwner && ep.status === 'pending' && generating !== ep.id && (
            <button onClick={(e) => { e.stopPropagation(); handleGenerate(ep.id) }}
              className="btn-primary mt-2 px-3 py-1 text-xs">
              生成本集场景
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
