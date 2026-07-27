'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store'
import { scriptApi } from '@/services/api.client'
import { generateOutline, parseOutlineResponse, ParsedOutline } from '@/services/script.client'
import { generateImage } from '@/services/agnes.client'
import { useToast } from '@/components/common/Toast'

export default function ScriptChat() {
  const { currentProject, messages, loading, progressMsg, genre, episodeCount, episodes, addMessage, setLoading, setProgressMsg, setEpisodes } = useAppStore()
  const toast = useToast()
  const [prompt, setPrompt] = useState('')
  const hasOutline = episodes.length > 0

  useEffect(() => {
    if (!loading) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [loading])

  const handleGenerate = async () => {
    if (!prompt.trim() || !currentProject || hasOutline) return
    const apiKey = localStorage.getItem('agnes_api_key') || ''
    if (!apiKey) { toast.warning('请先设置 API Key（点击右上角「API Key」按钮）'); return }
    setLoading(true)
    addMessage({ role: 'user', content: prompt })
    try {
      let genrePrefix = ''
      if (genre === 'auto') genrePrefix = '【请根据故事内容自动判断最适合的短剧类型风格】'
      else if (genre) genrePrefix = `【类型：${genre}风格】`
      const epCountPrefix = `【要求生成 ${episodeCount} 集】`
      const fullPrompt = `${genrePrefix}${epCountPrefix}${prompt.trim()}`

      setProgressMsg('正在生成大纲...')
      let parsed: ParsedOutline | null = null
      let outlineContent = ''
      for (let attempt = 0; attempt < 3; attempt++) {
        outlineContent = await generateOutline(fullPrompt, apiKey)
        try { parsed = parseOutlineResponse(outlineContent); break } catch { if (attempt >= 2) throw new Error('大纲生成失败，请重试') }
      }
      if (!parsed) throw new Error('大纲生成失败')

      setProgressMsg('正在保存大纲...')
      const result = await scriptApi.save({
        projectId: currentProject.id, outlineContent, parsed,
        coverImage: null, characterImages: parsed.characters.map(() => null), locationImages: parsed.locations.map(() => null)
      })
      setEpisodes(result.episodes, result.scriptId)
      addMessage({ role: 'assistant', content: `大纲生成完成！共 ${result.episodes.length} 集。` })

      const aspectRatio = currentProject.aspectRatio || '16:9'
      const coverSize = aspectRatio === '9:16' ? '768x1024' : aspectRatio === '1:1' ? '1024x1024' : '1024x768'
      const updateImage = (type: string, name: string, imageUrl: string) =>
        fetch('/api/asset/image', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }, body: JSON.stringify({ projectId: currentProject.id, type, name, imageUrl }) })

      setProgressMsg('正在生成封面...')
      try { const coverUrl = await generateImage(`${parsed.title}，短剧封面海报，电影感`, coverSize, apiKey); await updateImage('cover', '', coverUrl) } catch {}

      for (let i = 0; i < parsed.characters.length; i++) {
        const char = parsed.characters[i]
        setProgressMsg(`正在生成角色图 (${i + 1}/${parsed.characters.length})...`)
        try { const url = await generateImage(`${char.keywords}，面朝镜头，半身像，中性背景`, '768x1024', apiKey); await updateImage('character', char.name, url) } catch {}
      }
      for (let i = 0; i < parsed.locations.length; i++) {
        const loc = parsed.locations[i]
        setProgressMsg(`正在生成场景图 (${i + 1}/${parsed.locations.length})...`)
        try { const url = await generateImage(`${loc.keywords}，广角镜头，电影感，无人物`, '1024x768', apiKey); await updateImage('location', loc.name, url) } catch {}
      }
      addMessage({ role: 'assistant', content: '所有参考图生成完成！' })
      setPrompt('')
    } catch (e: any) {
      addMessage({ role: 'assistant', content: `错误: ${e.message}` })
      toast.error(`生成失败: ${e.message}`)
    }
    finally { setLoading(false); setProgressMsg('') }
  }

  const fillIdea = (text: string) => setPrompt(text)

  return (
    <>
      <div className="idea-header">
        <h3>故事构思</h3>
        <div className="idea-sub">写下你的创意，AI 生成完整大纲</div>
      </div>
      <div className="idea-body">
        {hasOutline ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-tertiary)' }}>
            <p style={{ fontSize: 14, marginBottom: 6 }}>✓ 大纲已生成</p>
            <p style={{ fontSize: 11 }}>共 {episodes.length} 集剧本大纲</p>
            <p style={{ fontSize: 11, marginTop: 8 }}>如需重新生成请删除项目后重建</p>
          </div>
        ) : (
          <>
            <textarea
              className="idea-textarea"
              placeholder={'输入你的故事想法……\n\n例如：一个替身演员顶替当红女星出席豪门晚宴，却被总裁一眼看穿……'}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={loading}
            />
            <div className="idea-prompts">
              <button className="idea-prompt" onClick={() => fillIdea('一个替身演员被迫顶替当红女星，在豪门晚宴上遇到了识破她伪装的总裁。')}>替身 · 豪门</button>
              <button className="idea-prompt" onClick={() => fillIdea('都市白领意外穿越到古代宫廷，用现代知识在后宫杀出一条血路。')}>穿越 · 宫斗</button>
              <button className="idea-prompt" onClick={() => fillIdea('悬疑作家笔下的小说情节全部成真，而她成了连环命案的头号嫌疑人。')}>悬疑 · 反转</button>
            </div>
            {loading && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--color-accent-soft)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--color-accent)' }}>
                {progressMsg || '正在生成中……'}
              </div>
            )}
            {!loading && messages.length > 0 && messages.slice(-3).map((msg, i) => (
              <div key={i} style={{
                marginTop: 8, padding: '8px 12px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                background: msg.content.startsWith('错误') ? 'var(--color-error-bg)' : 'var(--color-surface)',
                color: msg.content.startsWith('错误') ? 'var(--color-error)' : 'var(--color-text-secondary)',
              }}>
                {msg.content}
              </div>
            ))}
          </>
        )}
      </div>
      <div className="idea-footer">
        {!hasOutline && (
          <button className="btn-accent" onClick={handleGenerate} disabled={loading || !prompt.trim()}>
            {loading ? '生成中...' : '⚡ 生成完整大纲'}
          </button>
        )}
        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
          AI 将根据你的创意自动生成 {episodeCount || 15} 集剧本大纲
        </span>
      </div>
    </>
  )
}