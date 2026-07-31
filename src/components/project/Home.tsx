'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { projectApi, setApiKey, setApiKeys, getApiKeys, logout } from '@/services/api.client'
import { generateImage } from '@/services/agnes.client'
import { downloadProtectedFile, ProtectedImage } from '@/components/common/ProtectedMedia'
import { getDeployEnv } from '@/services/deploy-env'

interface FeedbackItem { id: string; nickname: string; content: string; createdAt: string }

interface HomeProps {
  loggedIn?: boolean
  onLoginRequired?: () => void
}

export default function Home({ loggedIn, onLoginRequired }: HomeProps = {}) {
  const { projects, setProjects, setCurrentProject, setEpisodes, setGenre: setStoreGenre, setEpisodeCount: setStoreEpisodeCount } = useAppStore()
  const [newName, setNewName] = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [genre, setGenre] = useState('auto')
  const [episodeCount, setEpisodeCount] = useState('15')
  const [projectType, setProjectType] = useState<'drama' | 'video'>('drama')
  const [videoDuration, setVideoDuration] = useState('60')
  const [customEpisodeCount, setCustomEpisodeCount] = useState('')
  const [creating, setCreating] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [showTutorialModal, setShowTutorialModal] = useState(false)
  const [feedbackGuide, setFeedbackGuide] = useState(false)
  const [apiKey, setApiKeyState] = useState('')
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([])
  const [feedbackContent, setFeedbackContent] = useState('')
  const [feedbackNickname, setFeedbackNickname] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deployInfo, setDeployInfo] = useState<any>(null)
  const [changelog, setChangelog] = useState<any[]>([])
  const [changelogContent, setChangelogContent] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [projectTab, setProjectTab] = useState<'mine' | 'public' | 'recycle'>('mine')
  const [deletedProjects, setDeletedProjects] = useState<any[]>([])
  const [commitPanelOpen, setCommitPanelOpen] = useState(false)
  const [commits, setCommits] = useState([
    { hash: '7945760', author: 'fish-es', message: 'Merge pull request #53 from shixigege/dev', time: '2026/7/26' },
    { hash: 'a3f2c81', author: 'fish-es', message: 'fix: 修复登录态持久化问题', time: '2026/7/25' },
    { hash: 'e8b1d47', author: 'shixigege', message: 'feat: 新增环境标识徽章 deploy-env 服务', time: '2026/7/25' },
    { hash: 'c2a9033', author: 'fish-es', message: 'refactor: 重构 API 客户端认证逻辑', time: '2026/7/24' },
    { hash: 'f6d7e22', author: 'shixigege', message: 'feat: UI V5 设计系统迁移', time: '2026/7/24' },
    { hash: 'b41a7c9', author: 'fish-es', message: 'fix: 剧集生成重试机制优化', time: '2026/7/23' },
    { hash: 'd93e855', author: 'fish-es', message: 'feat: 新增一键生成全部剧集功能', time: '2026/7/22' },
    { hash: '7e2c1b4', author: 'shixigege', message: 'style: 侧边栏深色主题适配', time: '2026/7/22' },
    { hash: '5a8f3d6', author: 'fish-es', message: 'fix: 封面图保护链接鉴权修复', time: '2026/7/21' },
    { hash: '1c6b9e0', author: 'fish-es', message: 'chore: 升级 Next.js 16 适配', time: '2026/7/20' },
  ])
  const [stats, setStats] = useState<any>(null)
  const [contributors, setContributors] = useState([
    { name: 'fish-es', commits: 19 },
    { name: 'chenzh659', commits: 9 },
    { name: 'sea-fish-es', commits: 8 },
    { name: 'Lily', commits: 5 },
    { name: 'shixigege', commits: 4 },
  ])

  useEffect(() => {
    setApiKeyState(getApiKeys().join('\n'))
    if (loggedIn) {
      projectApi.list().then(setProjects).catch(() => {})
    }
    fetch('/api/feedback').then(r => r.json()).then(setFeedbackList).catch(() => {})
    fetch('/deploy-info.json').then(r => r.ok ? r.json() : null).then(setDeployInfo).catch(() => {})
    fetch('/api/changelog').then(r => r.json()).then(setChangelog).catch(() => {})
    fetch('/commits.json').then(r => r.ok ? r.json() : null).then(d => d && setCommits(d)).catch(() => {})
    fetch('/contributors.json').then(r => r.ok ? r.json() : null).then(d => d && setContributors(d)).catch(() => {})
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn])

  useEffect(() => {
    const key = localStorage.getItem('agnes_api_key') || ''
    if (key && typeof crypto !== 'undefined' && crypto.subtle) {
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16))
        .then(hash => setIsAdmin(hash === '90af35f948de349b'))
        .catch(() => {})
    } else { setIsAdmin(false) }
  }, [apiKey])

  const handleSaveKey = () => {
    const keys = apiKey.split('\n').map(k => k.trim()).filter(Boolean)
    setApiKeys(keys)
    setShowKeyModal(false)
    projectApi.list().then(setProjects).catch(() => {})
  }
  const [checkingKey, setCheckingKey] = useState(false)
  const handleCheckKey = async () => {
    const keys = apiKey.split('\n').map(k => k.trim()).filter(Boolean)
    if (keys.length === 0) { alert('请先填写 API Key'); return }
    setCheckingKey(true)
    try {
      const results = await Promise.all(keys.map(async (k, i) => {
        try {
          const res = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${k}` }, body: JSON.stringify({ model: 'agnes-2.0-flash', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }) })
          return `Key ${i + 1}: ${res.ok ? '有效' : `无效 (${res.status})`}`
        } catch (e: any) { return `Key ${i + 1}: 检查失败 (${e.message})` }
      }))
      alert(results.join('\n'))
    } finally { setCheckingKey(false) }
  }
  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true); setStoreGenre(genre)
    const epCount = episodeCount === 'custom' ? parseInt(customEpisodeCount) || 15 : parseInt(episodeCount)
    setStoreEpisodeCount(projectType === 'drama' ? epCount : 1)
    try { const project = await projectApi.create(newName.trim(), aspectRatio, projectType); setProjects([project, ...projects]); setCurrentProject(project); setNewName('') }
    catch (e: any) { alert(e.message) } finally { setCreating(false) }
  }
  const handleOpen = async (project: any) => {
    setCurrentProject(project)
    try { const res = await fetch(`/api/script/get?projectId=${project.id}`, { headers: { 'x-api-key': localStorage.getItem('agnes_api_key') || '' } }); const data = await res.json(); if (data?.episodes?.length) setEpisodes(data.episodes, data.scriptId) } catch { }
  }
  const handleDelete = async (id: string) => {
    if (!confirm('确定要将该项目移入回收站吗？30 天后将自动清理')) return
    await projectApi.delete(id)
    setProjects(projects.filter(p => p.id !== id))
    projectApi.listDeleted().then(setDeletedProjects).catch(() => {})
  }
  const handleRegenCover = async (project: any) => {
    const key = localStorage.getItem('agnes_api_key') || ''
    if (!key) { alert('请先设置 API Key'); return }
    const title = project.dramaTitle || project.name; const ar = project.aspectRatio || '16:9'
    const coverSize = ar === '9:16' ? '768x1024' : ar === '1:1' ? '1024x1024' : '1024x768'
    try { const url = await generateImage(`${title}，短剧封面海报，电影感`, coverSize, key); await fetch('/api/asset/image', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key }, body: JSON.stringify({ projectId: project.id, type: 'cover', name: '', imageUrl: url }) }); setProjects(projects.map(p => p.id === project.id ? { ...p, coverImage: url } : p)) }
    catch (e: any) { alert('封面生成失败: ' + e.message) }
  }
  const handleTogglePublic = async (project: any) => {
    const newPublic = !project.isPublic
    try { await fetch('/api/project', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-api-key': localStorage.getItem('agnes_api_key') || '' }, body: JSON.stringify({ id: project.id, isPublic: newPublic }) }); setProjects(projects.map(p => p.id === project.id ? { ...p, isPublic: newPublic } : p)) } catch { }
  }
  const handleDownloadCover = async (project: any) => {
    if (!project.coverImage) return
    if (!project.coverImage.startsWith('http')) { await downloadProtectedFile(`/api/file?kind=project-cover&id=${encodeURIComponent(project.id)}`, `${project.dramaTitle || project.name}_封面.png`); return }
    const a = document.createElement('a'); a.href = project.coverImage; a.download = `${project.dramaTitle || project.name}_封面.png`; a.target = '_blank'; a.click()
  }
  const handleSubmitFeedback = async () => {
    if (!feedbackContent.trim()) return; setSubmitting(true)
    try { const res = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }, body: JSON.stringify({ content: feedbackContent, nickname: feedbackNickname }) }); const data = await res.json(); if (res.ok) { setFeedbackList([data, ...feedbackList]); setFeedbackContent('') } } catch { } setSubmitting(false)
  }
  const handleSubmitChangelog = async () => {
    if (!changelogContent.trim()) return
    try { const res = await fetch('/api/changelog', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }, body: JSON.stringify({ content: changelogContent }) }); const data = await res.json(); if (res.ok) { setChangelog([data, ...changelog]); setChangelogContent('') } } catch { }
  }
  const handleDeleteChangelog = async (id: string) => { try { await fetch('/api/changelog', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }, body: JSON.stringify({ id }) }); setChangelog(changelog.filter(c => c.id !== id)) } catch { } }

  const handleLogout = async () => {
    await logout()
    window.location.reload()
  }

  const filtered = projectTab === 'mine'
    ? projects.filter(p => p.isOwner !== false)
    : projectTab === 'public' ? projects.filter(p => p.isPublic) : deletedProjects

  const handleRestore = async (id: string) => {
    try {
      await projectApi.restore(id)
      setDeletedProjects(deletedProjects.filter(p => p.id !== id))
      projectApi.list().then(setProjects).catch(() => {})
    } catch (e: any) { alert('还原失败: ' + e.message) }
  }
  const handlePermanentDelete = async (id: string) => {
    if (!confirm('彻底删除后将无法恢复，确定吗？')) return
    try { await projectApi.delete(id, true); setDeletedProjects(deletedProjects.filter(p => p.id !== id)) } catch (e: any) { alert('删除失败: ' + e.message) }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ===== SIDEBAR (V5: 不支持收起) ===== */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">F</div>
          <span className="sidebar-brand-text">Fish Studio</span>
        </div>
        <div className="sidebar-nav">
          <button className="active"><span className="icon">▶</span><span>项目</span></button>
          <button onClick={() => alert('请先打开一个项目，再使用剧本创作功能')}><span className="icon">✎</span><span>剧本</span></button>
          <button onClick={() => alert('请先打开一个项目，再使用资产库功能')}><span className="icon">■</span><span>资产库</span></button>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setShowTutorialModal(true)}><span className="icon">?</span><span>教程</span></button>
          <button onClick={() => setFeedbackGuide(!feedbackGuide)}><span className="icon">✉</span><span>反馈</span></button>
          {loggedIn && (
            <button onClick={handleLogout} style={{ color: 'var(--color-error)' }}><span className="icon">↩</span><span>退出登录</span></button>
          )}
        </div>
      </nav>

      {/* ===== MAIN ===== */}
      <div className="main-content">
        {/* TOPBAR */}
        <div className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">短剧开发平台</span>
            <span className={`badge ${getDeployEnv(deployInfo).badgeClass}`}>{getDeployEnv(deployInfo).label}</span>
            <span className="topbar-bc"><span className="sep">/</span> 项目工作台</span>
          </div>
          <div className="topbar-right">
            <button className="btn-commit" onClick={() => setCommitPanelOpen(true)}><span className="commit-dot"></span>提交记录 ({commits.length})</button>
            <button className="btn-sm" onClick={() => setShowTutorialModal(true)}>◉ 使用教程</button>
            {loggedIn && (
              <button className="btn-sm" onClick={() => setShowKeyModal(true)}>◎ API Key</button>
            )}
            <button className="btn-sm" onClick={() => setFeedbackGuide(!feedbackGuide)}>✉ 反馈</button>
            {!loggedIn && onLoginRequired && (
              <button className="btn-login" onClick={onLoginRequired}>登录 / 注册</button>
            )}
          </div>
        </div>

        {/* PAGE CONTENT */}
        <div className="page-content">
          {/* HERO */}
          <div className="page-hero animate-enter-up">
            <h1>创造你的下一部爆款短剧</h1>
            <p>AI 驱动剧本创作 · 角色与场景 · 一键生成</p>
          </div>

          {/* CREATE SECTION (V5: grid layout) — 登录后显示 */}
          {loggedIn && (
            <div className="create-section animate-enter-up delay-050">
              <h3>新建项目</h3>
              <div className="create-form">
                <div className="field">
                  <label>项目名称</label>
                  <input className="input-field" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} placeholder="例如：霸总替身复仇记" />
                </div>
                <div className="field">
                  <label>类型</label>
                  <select className="input-field" value={projectType} onChange={e => setProjectType(e.target.value as 'drama' | 'video')}>
                    <option value="drama">短剧</option>
                    <option value="video">长视频</option>
                  </select>
                </div>
                <div className="field">
                  <label>画面比例</label>
                  <select className="input-field" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
                    <option value="9:16">9:16</option>
                    <option value="16:9">16:9</option>
                    <option value="1:1">1:1</option>
                  </select>
                </div>
                <div className="field">
                  <label>集数</label>
                  <select className="input-field" value={episodeCount} onChange={e => setEpisodeCount(e.target.value)}>
                    <option value="5">5</option><option value="10">10</option><option value="15">15</option><option value="20">20</option><option value="30">30</option><option value="custom">自定义</option>
                  </select>
                </div>
                <div className="field">
                  <label>模板</label>
                  <select className="input-field" value={genre} onChange={e => setGenre(e.target.value)}>
                    <option value="auto">自动识别</option><option value="">无模板</option>
                    {projectType === 'drama' ? <>
                      <option value="霸总">霸道总裁</option><option value="复仇">复仇逆袭</option><option value="修仙">修仙玄幻</option><option value="甜宠">甜宠恋爱</option><option value="悬疑">悬疑推理</option><option value="穿越">穿越重生</option><option value="都市">都市情感</option><option value="古装">古装权谋</option><option value="搞笑">搞笑喜剧</option><option value="虐恋">虐恋催泪</option><option value="职场">职场逆袭</option><option value="校园">校园青春</option><option value="豪门">豪门恩怨</option><option value="战神">战神归来</option><option value="赘婿">赘婿逆袭</option><option value="重生">重生复仇</option>
                    </> : <>
                      <option value="寓言">寓言故事</option><option value="广告">商业广告</option><option value="科普">科普知识</option><option value="纪录">纪录短片</option><option value="教程">教学教程</option><option value="动漫">动漫故事</option><option value="情感">情感故事</option><option value="搞笑">搞笑段子</option>
                    </>}
                  </select>
                </div>
                <button className="btn-accent" onClick={handleCreate} disabled={creating || !newName.trim()} style={{ height: 40 }}>{creating ? '...' : '创建项目'}</button>
              </div>
              {projectType === 'drama' && episodeCount === 'custom' && (
                <div className="field" style={{ marginTop: 12, maxWidth: 100 }}>
                  <label>自定义集数</label>
                  <input className="input-field" type="number" min={3} max={100} value={customEpisodeCount} onChange={e => setCustomEpisodeCount(e.target.value)} placeholder="集" />
                </div>
              )}
              {projectType === 'video' && (
                <div className="field" style={{ marginTop: 12, maxWidth: 100 }}>
                  <label>时长</label>
                  <select className="input-field" value={videoDuration} onChange={e => setVideoDuration(e.target.value)}>
                    <option value="30">30秒</option><option value="60">1分钟</option><option value="120">2分钟</option><option value="180">3分钟</option><option value="300">5分钟</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* 反馈引导面板 */}
          {feedbackGuide && (
            <div className="info-card" style={{ marginBottom: 24, padding: '18px 22px' }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--color-text)' }}>📮 如何反馈</h4>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                <p><strong>方式一：</strong>在下方「问题与建议」表单直接提交，所有用户可见。</p>
                <p style={{ marginTop: 4 }}>
                  <strong>方式二：</strong>
                  访问 <a href="https://github.com/fish-es/fish-short-drama-platform/issues" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>GitHub Issues 页面</a> 提交 Issue，适合复杂 bug 或功能需求。
                </p>
              </div>
              <button onClick={() => setFeedbackGuide(false)} className="btn-ghost-sm" style={{ marginTop: 8, color: 'var(--color-text-tertiary)' }}>收起 ↑</button>
            </div>
          )}

          {/* PROJECT LIST (V5: 下划线 tab) — 登录后显示 */}
          {loggedIn && (
            <div className="animate-enter-up delay-100">
              <div className="project-tabs">
                <button className={`project-tab ${projectTab === 'mine' ? 'active' : ''}`} onClick={() => setProjectTab('mine')}>我的项目</button>
                <button className={`project-tab ${projectTab === 'public' ? 'active' : ''}`} onClick={() => setProjectTab('public')}>公开项目</button>
                <button className={`project-tab ${projectTab === 'recycle' ? 'active' : ''}`} onClick={() => { setProjectTab('recycle'); projectApi.listDeleted().then(setDeletedProjects).catch(() => {}) }}>回收站</button>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>共 {filtered.length} 个</span>
              </div>

              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                  {projectTab === 'mine' ? '暂无项目 — 创建一个开始你的创作之旅' : projectTab === 'public' ? '暂无公开项目' : '回收站是空的'}
                </div>
              ) : (
                filtered.map(project => {
                  const isRecycle = projectTab === 'recycle'
                  const remainDays = isRecycle && project.deletedAt
                    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(project.deletedAt + 'Z').getTime()) / 86400000))
                    : 0
                  return (
                  <div key={project.id} className="project-row" onClick={() => !isRecycle && handleOpen(project)}>
                    <div className="pr-left">
                      {project.coverImage ? (
                        <div style={{ width: 60, height: 80, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0, background: 'var(--color-surface-alt)' }}>
                          <ProtectedImage source={project.coverImage} protectedUrl={`/api/file?kind=project-cover&id=${encodeURIComponent(project.id)}`} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div style={{ width: 60, height: 80, borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-alt)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, cursor: 'pointer' }} onClick={e => { e.stopPropagation(); handleRegenCover(project) }}>🎬</div>
                      )}
                      <span className="project-name">{project.dramaTitle || project.name}</span>
                      <div className="project-meta">
                        {isRecycle ? (
                          <>
                            <span>删除于 {project.deletedAt ? new Date(project.deletedAt + 'Z').toLocaleString('zh-CN') : '—'}</span>
                            <span style={{ color: remainDays <= 7 ? 'var(--color-error)' : 'var(--color-text-tertiary)' }}>剩余 {remainDays} 天</span>
                          </>
                        ) : (
                          <>
                            <span>{project.aspectRatio}</span>
                            <span>{project.projectType === 'video' ? '长视频' : '短剧'}</span>
                            {project.isPublic && <span style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>公开</span>}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="pr-right" onClick={e => e.stopPropagation()}>
                      {isRecycle ? (
                        <>
                          <button className="btn-outline" onClick={() => handleRestore(project.id)}>还原</button>
                          <button className="btn-danger" onClick={() => handlePermanentDelete(project.id)}>彻底删除</button>
                        </>
                      ) : (
                        <>
                          {project.isOwner !== false && (
                            <button className="btn-ghost-sm" onClick={() => handleTogglePublic(project)}>{project.isPublic ? '设为私密' : '设为公开'}</button>
                          )}
                          <button className="btn-outline" onClick={() => handleOpen(project)}>打开</button>
                          {project.isOwner !== false && (
                            <button className="btn-danger" onClick={() => handleDelete(project.id)}>删除</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  )
                })
              )}
            </div>
          )}

          {/* 平台统计 */}
          {stats && (
            <div className="info-card" style={{ marginTop: 22 }}>
              <h4>平台数据</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: '项目', v: stats.projects, color: '#818cf8' },
                  { label: '剧本', v: stats.scripts, color: '#34d399' },
                  { label: '图片', v: stats.images, color: '#fbbf24' },
                  { label: '视频', v: stats.videos, color: '#f472b6' },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center', padding: '12px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.v.total}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #9ca3af)', marginTop: 2 }}>{item.label}总数</div>
                    <div style={{ fontSize: 11, color: '#10b981', marginTop: 4 }}>今日 +{item.v.today}</div>
                  </div>
                ))}
              </div>
              {/* 今日产出对比条 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(() => {
                  const items = [
                    { label: '剧本', v: stats.scripts.today, color: '#34d399' },
                    { label: '图片', v: stats.images.today, color: '#fbbf24' },
                    { label: '视频', v: stats.videos.today, color: '#f472b6' },
                  ]
                  const max = Math.max(1, ...items.map(i => i.v))
                  return items.map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary, #9ca3af)', width: 32 }}>{item.label}</span>
                      <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${(item.v / max) * 100}%`, height: '100%', background: item.color, borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--color-text, #e5e7eb)', width: 28, textAlign: 'right' }}>{item.v}</span>
                    </div>
                  ))
                })()}
              </div>
              <p style={{ fontSize: 10, color: 'var(--color-text-tertiary, #6b7280)', marginTop: 10, textAlign: 'center' }}>今日数据按 UTC 时间统计</p>
            </div>
          )}

          {/* HOME BOTTOM (V5: 2栏) */}
          <div className="home-bottom" style={{ marginTop: 22 }}>
            {/* 贡献排行 */}
            <div className="info-card">
              <h4>贡献排行</h4>
              <div className="rank-list">
                {contributors.map((c, i) => {
                  const cls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal'
                  return (
                    <div key={c.name} className="rank-item">
                      <div className={`rank-num ${cls}`}>{i + 1}</div>
                      <div className="rank-avatar-wrap">
                        <div className="rank-avatar-letter">{c.name[0].toUpperCase()}</div>
                        <img src={`https://github.com/${c.name}.png`} alt={c.name} className="rank-avatar-img" onError={e => e.currentTarget.style.display = 'none'} />
                      </div>
                      <div className="rank-info">
                        <a href={`https://github.com/${c.name}`} target="_blank" rel="noopener noreferrer" className="rank-name">{c.name}</a>
                      </div>
                      <div className="rank-bar-wrap">
                        <div className="rank-bar" style={{ width: `${(c.commits / (contributors[0]?.commits || 1)) * 100}%` }} />
                      </div>
                      <div className="rank-commits">{c.commits}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 更新日志 */}
            <div className="info-card">
              <h4>更新日志</h4>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input className="input-field" style={{ flex: 1, fontSize: 12 }} value={changelogContent} onChange={e => setChangelogContent(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmitChangelog()} placeholder="输入更新内容..." />
                  <button className="btn-accent" style={{ fontSize: 11 }} onClick={handleSubmitChangelog} disabled={!changelogContent.trim()}>发布</button>
                </div>
              )}
              {changelog.length > 0 ? changelog.map(item => (
                <div key={item.id} className="cl-item">
                  <span className="cl-date">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
                  {item.content}
                  {isAdmin && <button onClick={() => handleDeleteChangelog(item.id)} style={{ marginLeft: 'auto', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>×</button>}
                </div>
              )) : <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>暂无更新</div>}
            </div>

            {/* 问题与建议 */}
            <div className="info-card" id="feedback-section">
              <h4>问题与建议</h4>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input className="input-field" style={{ width: 100, fontSize: 12 }} value={feedbackNickname} onChange={e => setFeedbackNickname(e.target.value)} placeholder="昵称" />
                <input className="input-field" style={{ flex: 1, fontSize: 12 }} value={feedbackContent} onChange={e => setFeedbackContent(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmitFeedback()} placeholder="描述你的问题或建议..." />
                <button className="btn-accent" style={{ fontSize: 11 }} onClick={handleSubmitFeedback} disabled={submitting || !feedbackContent.trim()}>{submitting ? '..' : '提交'}</button>
              </div>
              {feedbackList.length > 0 ? feedbackList.map(item => (
                <div key={item.id} className="fb-item">
                  <span className="fb-status open">处理中</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text)', minWidth: 40 }}>{item.nickname || '匿名'}</span>
                  <span>{item.content}</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              )) : <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>暂无反馈</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ===== SLIDE-OUT COMMIT PANEL ===== */}
      <div className={`panel-overlay ${commitPanelOpen ? 'open' : ''}`} onClick={() => setCommitPanelOpen(false)} />
      <div className={`commit-panel ${commitPanelOpen ? 'open' : ''}`}>
        <div className="panel-header">
          <div>
            <h3>最近提交记录<span className="panel-count">({commits.length})</span></h3>
          </div>
          <button className="panel-close" onClick={() => setCommitPanelOpen(false)}>✕</button>
        </div>
        <div className="panel-body">
          {commits.map(c => (
            <div key={c.hash} className="commit-item">
              <div className="commit-item-top">
                <span className="commit-hash">{c.hash}</span>
                <span className="commit-time">{c.time}</span>
              </div>
              <div className="commit-author">{c.author}</div>
              <div className="commit-msg">{c.message}</div>
            </div>
          ))}
        </div>
        <div className="panel-footer">
          <a href="https://github.com/fish-es/fish-short-drama-platform/commits/dev" target="_blank" rel="noopener noreferrer">查看全部 →</a>
        </div>
      </div>

      {/* ===== TUTORIAL MODAL ===== */}
      {showTutorialModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowTutorialModal(false) }}>
          <div className="modal">
            <h3>使用教程</h3>
            <p>快速上手短剧开发平台的三步流程：</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              {[
                { n: 1, t: '获取 API Key', d: <>访问 <a href="https://platform.agnes-ai.com/login" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>Agnes AI 注册页面</a> 注册账号，在 <a href="https://platform.agnes-ai.com/settings/apiKeys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>API Keys 设置页</a> 创建 Key</> },
                { n: 2, t: '设置 Key', d: '点击「API Key」按钮，粘贴 Key 并保存' },
                { n: 3, t: '创建项目', d: '输入短剧名称，选择画面比例、集数和模板，点击创建' },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, background: 'var(--color-accent-soft)', color: 'var(--color-accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{step.n}</div>
                  <div><strong style={{ fontSize: 13 }}>{step.t}</strong><div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{step.d}</div></div>
                </div>
              ))}
            </div>
            <div className="modal-footer"><button className="btn-outline" onClick={() => setShowTutorialModal(false)}>关闭</button></div>
          </div>
        </div>
      )}

      {/* ===== API KEY MODAL ===== */}
      {showKeyModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowKeyModal(false) }}>
          <div className="modal">
            <h3>API Key 配置</h3>
            <p>输入你的 API Key 以启用 AI 生成功能。Key 将安全保存在本地浏览器中。</p>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>API Key（每行一个，多个 Key 会并行加速生成）</label>
              <textarea className="input-field" rows={4} value={apiKey} onChange={e => setApiKeyState(e.target.value)} placeholder="sk-...&#10;sk-...（第二个 Key，可选）" style={{ resize: 'vertical', fontFamily: 'monospace' }} />
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={handleCheckKey} disabled={checkingKey}>{checkingKey ? '检查中...' : '检查可用性'}</button>
              <button className="btn-outline" onClick={() => setShowKeyModal(false)}>取消</button>
              <button className="btn-accent" onClick={handleSaveKey}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}