'use client'

import { useState } from 'react'
import { useAppStore } from '@/store'
import { scriptApi } from '@/services/api.client'

export default function ScriptChat() {
  const { currentProject, messages, loading, progressMsg, genre, episodeCount, addMessage, setLoading, setProgressMsg, setEpisodes } = useAppStore()
  const [prompt, setPrompt] = useState('')

  const handleGenerate = async () => {
    if (!prompt.trim() || !currentProject) return
    setLoading(true)
    addMessage({ role: 'user', content: prompt })

    try {
      let genrePrefix = ''
      if (genre === 'auto') {
        genrePrefix = '【请根据故事内容自动判断最适合的短剧类型风格】'
      } else if (genre) {
        genrePrefix = `【类型：${genre}风格】`
      }
      const epCountPrefix = `【要求生成 ${episodeCount} 集】`
      const result = await scriptApi.generate(currentProject.id, `${genrePrefix}${epCountPrefix}${prompt.trim()}`)
      addMessage({ role: 'assistant', content: `大纲生成完成！共 ${result.episodes.length} 集。` })
      setEpisodes(result.episodes, result.scriptId)
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
              msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-2 rounded-lg bg-gray-700 text-gray-400 text-sm animate-pulse">
              {progressMsg || '正在生成大纲（含角色和场景参考图）...'}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input type="text" value={prompt} onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleGenerate()}
            placeholder="描述你的短剧故事..."
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
            disabled={loading} />
          <button onClick={handleGenerate} disabled={loading || !prompt.trim()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium">
            {loading ? '生成中...' : '生成大纲'}
          </button>
        </div>
      </div>
    </div>
  )
}
