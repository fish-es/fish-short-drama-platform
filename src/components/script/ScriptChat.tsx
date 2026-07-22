'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store'
import { scriptApi } from '@/services/api.client'
import { generateOutline, parseOutlineResponse, ParsedOutline } from '@/services/script.client'
import { generateImage } from '@/services/agnes.client'

export default function ScriptChat() {
  const { currentProject, messages, loading, progressMsg, genre, episodeCount, episodes, addMessage, setLoading, setProgressMsg, setEpisodes } = useAppStore()
  const [prompt, setPrompt] = useState('')
  const hasOutline = episodes.length > 0

  useEffect(() => {
    if (!loading) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [loading])

  const handleGenerate = async () => {
    if (!prompt.trim() || !currentProject || hasOutline) return
    setLoading(true)
    addMessage({ role: 'user', content: prompt })

    try {
      const apiKey = localStorage.getItem('agnes_api_key') || ''
      let genrePrefix = ''
      if (genre === 'auto') {
        genrePrefix = '【请根据故事内容自动判断最适合的短剧类型风格】'
      } else if (genre) {
        genrePrefix = `【类型：${genre}风格】`
      }
      const epCountPrefix = `【要求生成 ${episodeCount} 集】`
      const fullPrompt = `${genrePrefix}${epCountPrefix}${prompt.trim()}`

      // Step 1: Generate outline
      setProgressMsg('正在生成大纲...')
      let parsed: ParsedOutline | null = null
      let outlineContent = ''
      for (let attempt = 0; attempt < 3; attempt++) {
        outlineContent = await generateOutline(fullPrompt, apiKey)
        try {
          parsed = parseOutlineResponse(outlineContent)
          break
        } catch {
          if (attempt >= 2) throw new Error('大纲生成失败，请重试')
        }
      }
      if (!parsed) throw new Error('大纲生成失败')

      // Step 2: Save outline immediately (no images yet)
      setProgressMsg('正在保存大纲...')
      const result = await scriptApi.save({
        projectId: currentProject.id,
        outlineContent,
        parsed,
        coverImage: null,
        characterImages: parsed.characters.map(() => null),
        locationImages: parsed.locations.map(() => null)
      })
      setEpisodes(result.episodes, result.scriptId)
      addMessage({ role: 'assistant', content: `大纲生成完成！共 ${result.episodes.length} 集。正在生成参考图...` })

      // Step 3: Generate and save images one by one (non-blocking for user)
      const aspectRatio = currentProject.aspectRatio || '16:9'
      const coverSize = aspectRatio === '9:16' ? '768x1024' : aspectRatio === '1:1' ? '1024x1024' : '1024x768'
      const updateImage = (type: string, name: string, imageUrl: string) =>
        fetch('/api/asset/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({ projectId: currentProject.id, type, name, imageUrl })
        })

      setProgressMsg('正在生成封面...')
      try {
        const coverUrl = await generateImage(`${parsed.title}，短剧封面海报，电影感，精美构图，主角特写，戏剧性光影`, coverSize, apiKey)
        await updateImage('cover', '', coverUrl)
      } catch {}

      for (let i = 0; i < parsed.characters.length; i++) {
        const char = parsed.characters[i]
        setProgressMsg(`正在生成角色图 (${i + 1}/${parsed.characters.length})...`)
        try {
          const url = await generateImage(`${char.keywords}，面朝镜头，半身像，中性背景，高质量，细致面部特征`, '768x1024', apiKey)
          await updateImage('character', char.name, url)
        } catch {}
      }

      for (let i = 0; i < parsed.locations.length; i++) {
        const loc = parsed.locations[i]
        setProgressMsg(`正在生成场景图 (${i + 1}/${parsed.locations.length})...`)
        try {
          const url = await generateImage(`${loc.keywords}，广角镜头，电影感，高质量，无人物`, '1024x768', apiKey)
          await updateImage('location', loc.name, url)
        } catch {}
      }

      addMessage({ role: 'assistant', content: '所有参考图生成完成！' })
      setPrompt('')
    } catch (e: any) {
      addMessage({ role: 'assistant', content: `错误: ${e.message}` })
    } finally {
      setLoading(false)
      setProgressMsg('')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg">输入你的故事想法</p>
            <p className="text-sm mt-2">AI 会生成完整短剧大纲</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
              msg.role === 'user' ? 'btn-primary' : 'glass-card text-gray-200'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="glass-card px-4 py-2 text-gray-400 text-sm animate-pulse">
              {progressMsg || '正在生成大纲（含角色和场景参考图）...'}
            </div>
          </div>
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-2 rounded-lg bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-xs">
              正在生成中，离开页面会中断参考图生成（大纲和剧集不受影响，图片可稍后在资产库补生成）
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/10">
        {hasOutline ? (
          <p className="text-sm text-gray-500 text-center">大纲已生成，如需重新生成请删除项目后重建</p>
        ) : (
          <div className="flex gap-2">
            <input type="text" value={prompt} onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && handleGenerate()}
              placeholder="描述你的短剧故事..."
              className="input-field flex-1 text-sm"
              disabled={loading} />
            <button onClick={handleGenerate} disabled={loading || !prompt.trim()}
              className="btn-primary px-5 py-2 disabled:opacity-50">
              {loading ? '生成中...' : '生成大纲'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
