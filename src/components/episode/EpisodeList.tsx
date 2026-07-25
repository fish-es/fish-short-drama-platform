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
        try { parsed = parseEpisodeScenesResponse(content); break } catch { if (attempt >= 2) throw new Error(`第 ${ctx.epNumber} 集生成失败`) }
      }
      if (!parsed) throw new Error('生成失败')
      const result = await episodeApi.saveScenes(episodeId, ctx.scriptId, parsed.scenes)
      updateEpisode(episodeId, { status: 'generated' })
      setCurrentEpisodeId(episodeId)
      setScenes(result.scenes)
      resetPipeline()
    } catch (e: any) { alert(`生成失败: ${e.message}`) }
    finally { setGenerating(null) }
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
            try { parsed = parseEpisodeScenesResponse(content); break } catch { if (attempt >= 2) break }
          }
          if (parsed) { await episodeApi.saveScenes(ep.id, ctx.scriptId, parsed.scenes); updateEpisode(ep.id, { status: 'generated' }) }
        } catch { break } finally { setGenerating(null) }
      }
    }
    setGeneratingAll(false)
  }

  if (episodes.length === 0) {
    return (
      <>
        <div className="episode-timeline-bar">
          <span className="timeline-label">剧集</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>暂无剧集</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
          在左侧输入故事构思，生成大纲后此处显示剧集
        </div>
      </>
    )
  }

  const isOwner = currentProject?.isOwner !== false
  const generatedCount = episodes.filter(e => e.status === 'generated').length

  return (
    <>
      {/* Timeline bar */}
      <div className="episode-timeline-bar">
        <span className="timeline-label">剧集</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{episodes.length} 集 · {generatedCount} 已生成</span>
        <div style={{ flex: 1 }} />
        {isOwner && generatedCount < episodes.length && (
          <button className="btn-accent-sm" style={{ fontSize: 11 }} onClick={handleGenerateAll} disabled={generatingAll}>
            {generatingAll ? '生成中...' : '一键生成全部'}
          </button>
        )}
      </div>

      {/* Horizontal chips */}
      <div className="timeline-scroll">
        {episodes.map(ep => (
          <div
            key={ep.id}
            className={`ep-chip ${ep.status === 'generated' ? 'done' : ''} ${currentEpisodeId === ep.id ? 'active' : ''}`}
            onClick={() => ep.status === 'generated' ? handleView(ep.id) : (isOwner ? handleGenerate(ep.id) : null)}
            style={{ cursor: ep.status === 'generated' || isOwner ? 'pointer' : 'default', opacity: generating === ep.id ? 0.5 : 1 }}
          >
            <span className="ep-dot" />
            <span className="ep-chip-num">{ep.number < 10 ? '0' : ''}{ep.number}</span>
            <span className="ep-chip-name">{ep.title}</span>
            {generating === ep.id && <span style={{ fontSize: 10, color: 'var(--color-warning)' }}>...</span>}
          </div>
        ))}
      </div>
    </>
  )
}