'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { projectApi } from '@/services/api.client'
import { setApiKey } from '@/services/api.client'

interface FeedbackItem {
  id: string
  nickname: string
  content: string
  createdAt: string
}

export default function Home() {
  const { projects, setProjects, setCurrentProject, setEpisodes, setGenre: setStoreGenre, setEpisodeCount: setStoreEpisodeCount } = useAppStore()
  const [newName, setNewName] = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [genre, setGenre] = useState('auto')
  const [episodeCount, setEpisodeCount] = useState('15')
  const [customEpisodeCount, setCustomEpisodeCount] = useState('')
  const [creating, setCreating] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [apiKey, setApiKeyState] = useState('')
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([])
  const [feedbackContent, setFeedbackContent] = useState('')
  const [feedbackNickname, setFeedbackNickname] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deployInfo, setDeployInfo] = useState<any>(null)
  const [commits, setCommits] = useState<any[]>([])
  const [changelog, setChangelog] = useState<any[]>([])
  const [changelogContent, setChangelogContent] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [contributors, setContributors] = useState<any[]>([])

  useEffect(() => {
    projectApi.list().then(setProjects).catch(() => {})
    setApiKeyState(localStorage.getItem('agnes_api_key') || '')
    fetch('/api/feedback').then(r => r.json()).then(setFeedbackList).catch(() => {})
    fetch('/deploy-info.json').then(r => r.ok ? r.json() : null).then(setDeployInfo).catch(() => {})
    fetch('/commits.json').then(r => r.ok ? r.json() : null).then(d => d && setCommits(d)).catch(() => {})
    fetch('/api/changelog').then(r => r.json()).then(setChangelog).catch(() => {})
    fetch('/contributors.json').then(r => r.ok ? r.json() : null).then(d => d && setContributors(d)).catch(() => {})
  }, [setProjects])

  useEffect(() => {
    const key = localStorage.getItem('agnes_api_key') || ''
    if (key && typeof crypto !== 'undefined' && crypto.subtle) {
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16))
        .then(hash => setIsAdmin(hash === '90af35f948de349b'))
        .catch(() => {})
    } else {
      setIsAdmin(false)
    }
  }, [apiKey])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    setStoreGenre(genre)
    const epCount = episodeCount === 'custom' ? parseInt(customEpisodeCount) || 15 : parseInt(episodeCount)
    setStoreEpisodeCount(epCount)
    try {
      const project = await projectApi.create(newName.trim(), aspectRatio)
      setProjects([project, ...projects])
      setCurrentProject(project)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setNewName('')
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    await projectApi.delete(id)
    setProjects(projects.filter(p => p.id !== id))
  }

  const handleOpen = async (project: any) => {
    setCurrentProject(project)
    try {
      const res = await fetch(`/api/script/get?projectId=${project.id}`)
      const data = await res.json()
      if (data && data.episodes && data.episodes.length > 0) {
        setEpisodes(data.episodes, data.scriptId)
      }
    } catch {}
  }

  const handleSaveKey = () => {
    setApiKey(apiKey)
    setShowKey(false)
  }

  const handleSubmitFeedback = async () => {
    if (!feedbackContent.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ content: feedbackContent, nickname: feedbackNickname })
      })
      const data = await res.json()
      if (res.ok) {
        setFeedbackList([data, ...feedbackList])
        setFeedbackContent('')
      }
    } catch {}
    setSubmitting(false)
  }

  const handleSubmitChangelog = async () => {
    if (!changelogContent.trim()) return
    try {
      const res = await fetch('/api/changelog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ content: changelogContent })
      })
      const data = await res.json()
      if (res.ok) {
        setChangelog([data, ...changelog])
        setChangelogContent('')
      }
    } catch {}
  }

  const handleDeleteChangelog = async (id: string) => {
    try {
      await fetch('/api/changelog', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ id })
      })
      setChangelog(changelog.filter(c => c.id !== id))
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* 左侧面板 */}
      <div className="w-64 shrink-0 border-r border-gray-700 h-screen overflow-y-auto p-3 space-y-6">
        {/* 贡献榜 */}
        {contributors.length > 0 && (
          <div>
            <h3 className="text-xs font-bold mb-2 text-gray-400 uppercase">贡献榜</h3>
            <div className="space-y-1">
              {contributors.map((c, i) => (
                <div key={i} className="flex items-center justify-between px-2 py-1 bg-gray-800 rounded text-xs">
                  <span className="text-gray-300">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {c.name}
                  </span>
                  <span className="text-gray-500">{c.commits} commits</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 更新日志 */}
        <div>
          <h3 className="text-xs font-bold mb-2 text-gray-400 uppercase">更新日志</h3>
          {isAdmin && (
            <div className="mb-2 flex gap-1">
              <input type="text" value={changelogContent} onChange={e => setChangelogContent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmitChangelog()}
                placeholder="输入更新内容..."
                className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs focus:outline-none focus:border-blue-500" />
              <button onClick={handleSubmitChangelog} disabled={!changelogContent.trim()}
                className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-xs">发布</button>
            </div>
          )}
          {changelog.length > 0 ? (
            <div className="space-y-1">
              {changelog.map(item => (
                <div key={item.id} className="p-2 bg-gray-800 rounded border border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
                    {isAdmin && <button onClick={() => handleDeleteChangelog(item.id)} className="text-xs text-red-400 hover:text-red-300">x</button>}
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">{item.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">暂无更新</p>
          )}
        </div>

        {/* 问题与建议 */}
        <div>
          <h3 className="text-xs font-bold mb-2 text-gray-400 uppercase">问题与建议</h3>
          <div className="mb-2 space-y-1">
            <input type="text" value={feedbackNickname} onChange={e => setFeedbackNickname(e.target.value)}
              placeholder="昵称（选填）"
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs focus:outline-none focus:border-blue-500" />
            <div className="flex gap-1">
              <input type="text" value={feedbackContent} onChange={e => setFeedbackContent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmitFeedback()}
                placeholder="输入问题或建议..."
                className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs focus:outline-none focus:border-blue-500" />
              <button onClick={handleSubmitFeedback} disabled={submitting || !feedbackContent.trim()}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-xs">
                {submitting ? '..' : '提交'}
              </button>
            </div>
          </div>
          {feedbackList.length > 0 && (
            <div className="space-y-1">
              {feedbackList.map(item => (
                <div key={item.id} className="p-2 bg-gray-800 rounded border border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-blue-400">{item.nickname}</span>
                    <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">{item.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">短剧开发平台</h1>
            <button onClick={() => setShowKey(!showKey)} className="px-4 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded">
              ⚙ API Key
            </button>
          </div>

          {deployInfo && (
            <div className="mb-4 px-3 py-2 bg-gray-800 rounded border border-gray-700 text-xs text-gray-400 flex items-center gap-2">
              <span>当前部署：</span>
              <span className="text-blue-400">{deployInfo.author}</span>
              {deployInfo.pr && <span>PR #{deployInfo.pr}</span>}
              {deployInfo.branch && <span>({deployInfo.branch})</span>}
              {deployInfo.title && <span>— {deployInfo.title}</span>}
              {deployInfo.message && !deployInfo.pr && <span>— {deployInfo.message}</span>}
              <span className="ml-auto">{deployInfo.time ? new Date(deployInfo.time).toLocaleString('zh-CN') : ''}</span>
            </div>
          )}

          {commits.length > 0 && (
            <details className="mb-6">
              <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">最近提交记录（{commits.length}）</summary>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {commits.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded text-xs">
                    <span className="text-yellow-400 font-mono">{c.hash}</span>
                    <span className="text-blue-400">{c.author}</span>
                    <span className="text-gray-300 flex-1 truncate">{c.message}</span>
                    <span className="text-gray-500 shrink-0">{new Date(c.time).toLocaleString('zh-CN')}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

        {showKey && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex gap-2">
              <input type="password" value={apiKey} onChange={e => setApiKeyState(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm" />
              <button onClick={handleSaveKey} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">保存</button>
            </div>
          </div>
        )}

        <div className="mb-8 space-y-3">
          <div className="flex gap-3">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="输入新项目名称..."
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500" />
            <button onClick={handleCreate} disabled={creating || !newName.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium">
              {creating ? '创建中...' : '创建项目'}
            </button>
          </div>
          <div className="flex gap-3 flex-wrap">
            <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm">
              <option value="9:16">9:16 竖屏</option>
              <option value="16:9">16:9 横屏</option>
              <option value="1:1">1:1 方形</option>
            </select>
            <select value={episodeCount} onChange={e => setEpisodeCount(e.target.value)}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm">
              <option value="10">10 集</option>
              <option value="15">15 集</option>
              <option value="20">20 集</option>
              <option value="30">30 集</option>
              <option value="custom">自定义</option>
            </select>
            {episodeCount === 'custom' && (
              <input type="number" value={customEpisodeCount} onChange={e => setCustomEpisodeCount(e.target.value)}
                placeholder="集数" min="3" max="100"
                className="w-16 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm" />
            )}
            <select value={genre} onChange={e => setGenre(e.target.value)}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm">
              <option value="auto">自动识别</option>
              <option value="">不使用模板</option>
              <option value="霸总">霸道总裁</option>
              <option value="复仇">复仇逆袭</option>
              <option value="修仙">修仙玄幻</option>
              <option value="甜宠">甜宠恋爱</option>
              <option value="悬疑">悬疑推理</option>
              <option value="穿越">穿越重生</option>
              <option value="都市">都市情感</option>
              <option value="古装">古装权谋</option>
              <option value="搞笑">搞笑喜剧</option>
              <option value="虐恋">虐恋催泪</option>
              <option value="职场">职场逆袭</option>
              <option value="校园">校园青春</option>
              <option value="豪门">豪门恩怨</option>
              <option value="战神">战神归来</option>
              <option value="赘婿">赘婿逆袭</option>
              <option value="重生">重生复仇</option>
            </select>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">还没有项目</p>
            <p className="text-sm mt-2">输入名称创建你的第一个短剧项目</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map(project => (
              <div key={project.id} className="flex items-center gap-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                {project.coverImage ? (
                  <img src={project.coverImage.startsWith('http') ? project.coverImage : `/api/file?path=${encodeURIComponent(project.coverImage)}`} alt="" className="w-16 h-20 object-cover rounded" />
                ) : (
                  <div className="w-16 h-20 bg-gray-700 rounded flex items-center justify-center">
                    <span className="text-xs text-gray-500">无封面</span>
                  </div>
                )}
                <div className="flex-1 cursor-pointer" onClick={() => handleOpen(project)}>
                  <h3 className="text-lg font-medium">{project.dramaTitle || project.name}</h3>
                  <p className="text-xs text-gray-400">{project.aspectRatio} · {new Date(project.createdAt).toLocaleDateString('zh-CN')}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpen(project)} className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm">打开</button>
                  <button onClick={() => handleDelete(project.id)} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm">删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
