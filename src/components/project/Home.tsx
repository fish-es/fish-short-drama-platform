'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { projectApi, setApiKey, logout } from '@/services/api.client'
import { generateImage } from '@/services/agnes.client'
import { downloadProtectedFile, ProtectedImage } from '@/components/common/ProtectedMedia'

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
  const [projectType, setProjectType] = useState<'drama' | 'video'>('drama')
  const [videoDuration, setVideoDuration] = useState('60')
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
  const [showTutorial, setShowTutorial] = useState(false)
  const [showFeedbackGuide, setShowFeedbackGuide] = useState(false)
  const [projectTab, setProjectTab] = useState<'mine' | 'public'>('mine')
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
    setStoreEpisodeCount(projectType === 'video' ? 1 : epCount)
    try {
      const project = await projectApi.create(newName.trim(), aspectRatio, projectType)
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
    if (!confirm('确定要删除这个项目吗？所有相关数据将被永久删除。')) return
    await projectApi.delete(id)
    setProjects(projects.filter(p => p.id !== id))
  }

  const handleOpen = async (project: any) => {
    setCurrentProject(project)
    try {
      const res = await fetch(`/api/script/get?projectId=${project.id}`, { headers: { 'x-api-key': localStorage.getItem('agnes_api_key') || '' } })
      const data = await res.json()
      if (data && data.episodes && data.episodes.length > 0) {
        setEpisodes(data.episodes, data.scriptId)
      }
    } catch {}
  }

  const handleSaveKey = () => {
    setApiKey(apiKey)
    setShowKey(false)
    projectApi.list().then(setProjects).catch(() => {})
  }

  const [checkingKey, setCheckingKey] = useState(false)

  const handleCheckKey = async () => {
    if (!apiKey) { alert('请先填写 API Key'); return }
    setCheckingKey(true)
    try {
      const res = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'agnes-2.0-flash', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 })
      })
      if (res.ok) {
        alert('API Key 有效')
      } else {
        alert(`API Key 无效 (${res.status})`)
      }
    } catch (e: any) {
      alert('检查失败: ' + e.message)
    } finally {
      setCheckingKey(false)
    }
  }

  const handleRegenCover = async (project: any) => {
    const key = localStorage.getItem('agnes_api_key') || ''
    if (!key) { alert('请先设置 API Key'); return }
    const title = project.dramaTitle || project.name
    const aspectRatio = project.aspectRatio || '16:9'
    const coverSize = aspectRatio === '9:16' ? '768x1024' : aspectRatio === '1:1' ? '1024x1024' : '1024x768'
    try {
      const url = await generateImage(`${title}，短剧封面海报，电影感，精美构图，主角特写，戏剧性光影`, coverSize, key)
      await fetch('/api/asset/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({ projectId: project.id, type: 'cover', name: '', imageUrl: url })
      })
      setProjects(projects.map(p => p.id === project.id ? { ...p, coverImage: url } : p))
    } catch (e: any) {
      alert('封面生成失败: ' + e.message)
    }
  }

  const handleDownloadCover = async (project: any) => {
    if (!project.coverImage) return
    if (!project.coverImage.startsWith('http')) {
      await downloadProtectedFile(
        `/api/file?kind=project-cover&id=${encodeURIComponent(project.id)}`,
        `${project.dramaTitle || project.name}_封面.png`,
      )
      return
    }
    const url = project.coverImage
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.dramaTitle || project.name}_封面.png`
    a.target = '_blank'
    a.click()
  }

  const handleTogglePublic = async (project: any) => {
    const newPublic = !project.isPublic
    try {
      await fetch('/api/project', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': localStorage.getItem('agnes_api_key') || '' },
        body: JSON.stringify({ id: project.id, isPublic: newPublic })
      })
      setProjects(projects.map(p => p.id === project.id ? { ...p, isPublic: newPublic } : p))
    } catch {}
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
    <div className="min-h-screen text-white flex" style={{ background: 'linear-gradient(180deg, #0c0c14 0%, #121220 100%)' }}>
      {/* 左侧面板 */}
      <div className="w-64 shrink-0 border-r border-white/5 h-screen overflow-y-auto p-4 space-y-6" style={{ background: 'rgba(12, 12, 20, 0.95)' }}>
        {/* 贡献榜 */}
        {contributors.length > 0 && (
          <div>
            <h3 className="text-xs font-bold mb-3 text-gray-400 uppercase tracking-wider">贡献榜</h3>
            <div className="space-y-1.5">
              {contributors.map((c, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 glass-card text-xs">
                  <span className="text-gray-200">
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
          <h3 className="text-xs font-bold mb-3 text-gray-400 uppercase tracking-wider">更新日志</h3>
          {isAdmin && (
            <div className="mb-2 flex gap-1">
              <input type="text" value={changelogContent} onChange={e => setChangelogContent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmitChangelog()}
                placeholder="输入更新内容..."
                className="input-field flex-1 text-xs !py-1.5" />
              <button onClick={handleSubmitChangelog} disabled={!changelogContent.trim()}
                className="btn-success !py-1.5 !px-2 !text-xs">发布</button>
            </div>
          )}
          {changelog.length > 0 ? (
            <div className="space-y-1.5">
              {changelog.map(item => (
                <div key={item.id} className="p-2.5 glass-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
                    {isAdmin && <button onClick={() => handleDeleteChangelog(item.id)} className="text-xs text-red-400 hover:text-red-300">x</button>}
                  </div>
                  <p className="text-xs text-gray-300 mt-1">{item.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">暂无更新</p>
          )}
        </div>

        {/* 问题与建议 */}
        <div>
          <h3 className="text-xs font-bold mb-3 text-gray-400 uppercase tracking-wider">问题与建议</h3>
          <div className="mb-2 space-y-1.5">
            <input type="text" value={feedbackNickname} onChange={e => setFeedbackNickname(e.target.value)}
              placeholder="昵称（选填）"
              className="input-field w-full text-xs !py-1.5" />
            <div className="flex gap-1">
              <input type="text" value={feedbackContent} onChange={e => setFeedbackContent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmitFeedback()}
                placeholder="输入问题或建议..."
                className="input-field flex-1 text-xs !py-1.5" />
              <button onClick={handleSubmitFeedback} disabled={submitting || !feedbackContent.trim()}
                className="btn-primary !py-1.5 !px-2 !text-xs">
                {submitting ? '..' : '提交'}
              </button>
            </div>
          </div>
          {feedbackList.length > 0 && (
            <div className="space-y-1.5">
              {feedbackList.map(item => (
                <div key={item.id} className="p-2.5 glass-card">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-indigo-400">{item.nickname}</span>
                    <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1">{item.content}</p>
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
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">短剧开发平台</h1>
              <span className={`badge ${
                deployInfo?.pr ? 'badge-yellow' : deployInfo?.branch === 'main' ? 'badge-green' : deployInfo?.branch === 'dev' ? 'badge-blue' : 'badge-gray'
              }`}>
                {deployInfo?.pr ? '测试版' : deployInfo?.branch === 'main' ? '正式版' : deployInfo?.branch === 'dev' ? '实验版' : '本地环境'}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowFeedbackGuide(!showFeedbackGuide)} className="btn-secondary !text-xs">
                反馈
              </button>
              <button onClick={() => setShowTutorial(!showTutorial)} className="btn-secondary !text-xs">
                ? 使用教程
              </button>
              <button onClick={() => setShowKey(!showKey)} className="btn-secondary !text-xs">
                ⚙ API Key
              </button>
              <button
                onClick={async () => { await logout(); window.location.reload() }}
                className="btn-secondary !text-xs !border-red-500/30 !text-red-400 hover:!text-red-300"
              >
                退出登录
              </button>
            </div>
          </div>

          {showTutorial && (
            <div className="mb-6 p-5 glass-card text-sm text-gray-300 space-y-3">
              <h3 className="text-base font-bold text-white">使用教程</h3>
              <div className="space-y-2">
                <p className="font-medium text-gray-200">第一步：获取 API Key</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-400">
                  <li>访问 <a href="https://platform.agnes-ai.com/login" target="_blank" className="text-indigo-400 hover:underline">Agnes AI 注册页面</a> 注册账号</li>
                  <li>登录后进入 <a href="https://platform.agnes-ai.com/settings/apiKeys" target="_blank" className="text-indigo-400 hover:underline">API Keys 设置页</a></li>
                  <li>点击创建新的 API Key，复制保存</li>
                </ol>
                <p className="font-medium text-gray-200 pt-2">第二步：设置 Key</p>
                <p className="text-gray-400">点击右上角"⚙ API Key"按钮，粘贴你的 Key 并保存</p>
                <p className="font-medium text-gray-200 pt-2">第三步：创建项目</p>
                <p className="text-gray-400">输入短剧名称，选择画面比例和集数，点击创建</p>
                <p className="font-medium text-gray-200 pt-2">第四步：生成内容</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-400">
                  <li>输入故事创意，AI 自动生成大纲、角色、场景</li>
                  <li>选择剧集，生成分镜场景</li>
                  <li>点击"一键生成"，自动生成图片和视频</li>
                </ol>
              </div>
              <button onClick={() => setShowTutorial(false)} className="text-xs text-gray-500 hover:text-indigo-400 transition">收起</button>
            </div>
          )}

          {showFeedbackGuide && (
            <div className="mb-6 p-5 glass-card text-sm text-gray-300 space-y-3">
              <h3 className="text-base font-bold text-white">如何反馈</h3>
              <div className="space-y-2">
                <p className="font-medium text-gray-200">方式一：在首页左侧留言</p>
                <p className="text-gray-400">在左侧"问题与建议"栏直接输入你的反馈，所有用户都能看到。</p>
                <p className="font-medium text-gray-200 pt-2">方式二：到 GitHub 提 Issue</p>
                <p className="text-gray-400">访问 <a href="https://github.com/fish-es/fish-short-drama-platform/issues" target="_blank" className="text-indigo-400 hover:underline">GitHub Issues 页面</a>，点击 New Issue 描述你的问题或建议。适合较复杂的 bug 或功能需求。</p>
              </div>
              <button onClick={() => setShowFeedbackGuide(false)} className="text-xs text-gray-500 hover:text-indigo-400 transition">收起</button>
            </div>
          )}

          {deployInfo && (
            <div className="mb-4 px-4 py-2.5 glass-card text-xs text-gray-400 flex items-center gap-2">
              <span>当前部署：</span>
              <span className="text-indigo-400">{deployInfo.author}</span>
              {deployInfo.pr && <span>PR #{deployInfo.pr}</span>}
              {deployInfo.branch && <span>({deployInfo.branch})</span>}
              {deployInfo.title && <span>— {deployInfo.title}</span>}
              {deployInfo.message && !deployInfo.pr && <span>— {deployInfo.message}</span>}
              <span className="ml-auto">{deployInfo.time ? new Date(deployInfo.time).toLocaleString('zh-CN') : ''}</span>
            </div>
          )}

          {commits.length > 0 && (
            <details className="mb-6">
              <summary className="text-sm text-gray-400 cursor-pointer hover:text-indigo-400 transition">最近提交记录（{commits.length}）</summary>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {commits.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 glass-card text-xs !rounded-lg">
                    <span className="text-amber-400 font-mono">{c.hash}</span>
                    <span className="text-indigo-400">{c.author}</span>
                    <span className="text-gray-300 flex-1 truncate">{c.message}</span>
                    <span className="text-gray-500 shrink-0">{new Date(c.time).toLocaleString('zh-CN')}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

        {showKey && (
          <div className="mb-6 p-4 glass-card">
            <div className="flex gap-2">
              <input type="password" value={apiKey} onChange={e => setApiKeyState(e.target.value)}
                className="input-field flex-1" />
              <button onClick={handleSaveKey} className="btn-primary">保存</button>
              <button onClick={handleCheckKey} disabled={checkingKey} className="btn-secondary">
                {checkingKey ? '检查中...' : '检查可用性'}
              </button>
            </div>
          </div>
        )}

        <div className="mb-8 space-y-3">
          <div className="flex gap-3">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="输入新项目名称..."
              className="input-field flex-1" />
            <button onClick={handleCreate} disabled={creating || !newName.trim()}
              className="btn-primary !px-6">
              {creating ? '创建中...' : '创建项目'}
            </button>
          </div>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setProjectType('drama')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${projectType === 'drama' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              短剧 <span className="text-[10px] opacity-60">内测</span>
            </button>
            <button onClick={() => setProjectType('video')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${projectType === 'video' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              长视频 <span className="text-[10px] opacity-60">内测</span>
            </button>
          </div>
          <div className="flex gap-3 flex-wrap">
            <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}
              className="input-field text-sm">
              <option value="9:16">9:16 竖屏</option>
              <option value="16:9">16:9 横屏</option>
              <option value="1:1">1:1 方形</option>
            </select>
            {projectType === 'drama' && (
              <>
                <select value={episodeCount} onChange={e => setEpisodeCount(e.target.value)}
                  className="input-field text-sm">
                  <option value="5">5 集</option>
                  <option value="10">10 集</option>
                  <option value="15">15 集</option>
                  <option value="20">20 集</option>
                  <option value="30">30 集</option>
                  <option value="custom">自定义</option>
                </select>
                {episodeCount === 'custom' && (
                  <input type="number" value={customEpisodeCount} onChange={e => setCustomEpisodeCount(e.target.value)}
                    placeholder="集数" min="3" max="100"
                    className="input-field w-16 text-sm" />
                )}
                <select value={genre} onChange={e => setGenre(e.target.value)}
                  className="input-field text-sm">
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
              </>
            )}
            {projectType === 'video' && (
              <>
                <select value={videoDuration} onChange={e => setVideoDuration(e.target.value)}
                  className="input-field text-sm">
                  <option value="30">30 秒</option>
                  <option value="60">1 分钟</option>
                  <option value="120">2 分钟</option>
                  <option value="180">3 分钟</option>
                  <option value="300">5 分钟</option>
                </select>
                <select value={genre} onChange={e => setGenre(e.target.value)}
                  className="input-field text-sm">
                  <option value="auto">自动识别</option>
                  <option value="">不使用模板</option>
                  <option value="寓言">寓言故事</option>
                  <option value="广告">商业广告</option>
                  <option value="科普">科普知识</option>
                  <option value="纪录">纪录短片</option>
                  <option value="教程">教学教程</option>
                  <option value="动画">动画故事</option>
                  <option value="情感">情感故事</option>
                  <option value="搞笑">搞笑段子</option>
                </select>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setProjectTab('mine')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${projectTab === 'mine' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            我的项目
          </button>
          <button onClick={() => setProjectTab('public')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${projectTab === 'public' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            公开项目
          </button>
        </div>

        {(() => {
          const filtered = projectTab === 'mine'
            ? projects.filter(p => p.isOwner !== false)
            : projects.filter(p => p.isPublic)
          return filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">{projectTab === 'mine' ? '还没有项目' : '暂无公开项目'}</p>
              <p className="text-sm mt-2">{projectTab === 'mine' ? '输入名称创建你的第一个短剧项目' : '其他用户公开的项目会显示在这里'}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filtered.map(project => (
              <div key={project.id} className="flex items-center gap-4 p-4 glass-card">
                {project.coverImage ? (
                  <div className="relative group">
                    <ProtectedImage
                      source={project.coverImage}
                      protectedUrl={`/api/file?kind=project-cover&id=${encodeURIComponent(project.id)}`}
                      alt=""
                      className="w-16 h-20 object-cover rounded"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 rounded">
                      <button onClick={(e) => { e.stopPropagation(); handleRegenCover(project) }} className="text-xs text-white hover:text-blue-300">重新生成</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDownloadCover(project) }} className="text-xs text-white hover:text-green-300">下载</button>
                    </div>
                  </div>
                ) : (
                  <div className="w-16 h-20 bg-gray-700 rounded flex items-center justify-center cursor-pointer" onClick={() => handleRegenCover(project)}>
                    <span className="text-xs text-gray-500">生成封面</span>
                  </div>
                )}
                <div className="flex-1 cursor-pointer" onClick={() => handleOpen(project)}>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">{project.dramaTitle || project.name}</h3>
                    {project.isPublic && <span className="badge badge-green">公开</span>}
                    {!project.isOwner && <span className="badge badge-gray">他人</span>}
                  </div>
                  <p className="text-xs text-gray-400">{project.aspectRatio} · {new Date(project.createdAt).toLocaleDateString('zh-CN')}</p>
                </div>
                <div className="flex gap-2">
                  {project.isOwner !== false && (
                    <button onClick={(e) => { e.stopPropagation(); handleTogglePublic(project) }}
                      className={`btn-secondary !py-1.5 !px-3 !text-xs ${project.isPublic ? '!border-amber-500/30 !text-amber-400' : ''}`}>
                      {project.isPublic ? '设为私有' : '设为公开'}
                    </button>
                  )}
                  <button onClick={() => handleOpen(project)} className="btn-success !py-1.5 !px-4 !text-xs">打开</button>
                  {project.isOwner !== false && (
                    <button onClick={() => handleDelete(project.id)} className="btn-danger !py-1.5 !px-4 !text-xs">删除</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          )
        })()}
        </div>
      </div>
    </div>
  )
}
