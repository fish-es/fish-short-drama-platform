'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store'
import ScriptChat from '@/components/script/ScriptChat'
import EpisodeList from '@/components/episode/EpisodeList'
import SceneList from '@/components/scene/SceneList'
import PipelineControl from '@/components/pipeline/PipelineControl'
import AssetLibrary from '@/components/assets/AssetLibrary'
import { getDeployEnv, DeployInfo } from '@/services/deploy-env'
import { logout } from '@/services/api.client'
import { showAlert } from '@/components/common/Dialog'

export default function Workspace() {
  const { currentProject, clearProject, currentEpisodeId, episodes, setCurrentEpisodeId } = useAppStore()
  const [leftTab, setLeftTab] = useState<'script' | 'assets'>('script')
  const [deployInfo, setDeployInfo] = useState<DeployInfo | null>(null)

  const isVideo = currentProject?.projectType === 'video'

  useEffect(() => {
    fetch('/deploy-info.json').then(r => r.ok ? r.json() : null).then(setDeployInfo).catch(() => {})
  }, [])

  // 长视频只有一集，自动选中，无需显示分集时间线
  useEffect(() => {
    if (isVideo && episodes.length > 0 && !currentEpisodeId) {
      setCurrentEpisodeId(episodes[0].id)
    }
  }, [isVideo, episodes, currentEpisodeId, setCurrentEpisodeId])

  if (!currentProject) return null

  const currentEpisode = episodes.find(e => e.id === currentEpisodeId)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ===== SIDEBAR ===== */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">F</div>
          <span className="sidebar-brand-text">Fish Studio</span>
        </div>
        <div className="sidebar-nav">
          <button onClick={clearProject}><span className="icon">▶</span><span>项目</span></button>
          <button className={leftTab === 'script' ? 'active' : ''} onClick={() => setLeftTab('script')}><span className="icon">✎</span><span>剧本</span></button>
          <button className={leftTab === 'assets' ? 'active' : ''} onClick={() => setLeftTab('assets')}><span className="icon">■</span><span>资产库</span></button>
        </div>
        <div className="sidebar-bottom">
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', padding: '0 12px' }}>{currentProject.aspectRatio}</span>
          <button onClick={async () => { await logout(); window.location.reload() }}><span className="icon">↪</span><span>退出</span></button>
          <button onClick={clearProject}><span className="icon">←</span><span>返回首页</span></button>
        </div>
      </nav>

      {/* ===== MAIN ===== */}
      <div className="main-content">
        {/* TOPBAR */}
        <div className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">短剧开发平台</span>
            <span className={`badge ${getDeployEnv(deployInfo).badgeClass}`}>{getDeployEnv(deployInfo).label}</span>
            <span className="topbar-bc">
              <span className="sep">/</span>
              <a onClick={clearProject}>项目</a>
              <span className="sep">/</span>
              {currentProject.dramaTitle || currentProject.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              {currentProject.aspectRatio} · {currentProject.projectType === 'video' ? '长视频' : '短剧'}
            </span>
          </div>
          <div className="topbar-right">
            <span className={`badge ${currentProject.projectType === 'video' ? 'badge-blue' : 'badge-gray'}`}>
              {currentProject.projectType === 'video' ? '长视频' : '短剧'}
            </span>
            <button className="btn-commit" onClick={() => showAlert('请返回首页查看提交记录')}><span className="commit-dot"></span>提交记录</button>
          </div>
        </div>

        {/* ===== SCRIPT TAB ===== */}
        {leftTab === 'script' && (
          <>

            {/* SCRIPT VIEW: 左侧故事构思 + 右侧剧集时间线+详情 */}
            <div className="script-view">
              {/* 左侧: 故事构思面板 */}
              <div className="idea-panel">
                <ScriptChat />
              </div>

              {/* 右侧: 剧集时间线 + 详情 */}
              <div className="episode-main">
                {/* 水平剧集 chips */}
                <EpisodeList />

                {/* 剧集详情区 */}
                <div className="episode-detail-area">
                  {currentEpisode ? (
                    <>
                      {/* 剧集头部 */}
                      <div className="ed-header">
                        {!isVideo && <div className="ed-num">第 {currentEpisode.number} 集</div>}
                        <div className="ed-title">{currentEpisode.title}</div>
                        <div className="ed-meta">
                          <span className={`ep-badge ${currentEpisode.status === 'generated' ? 'done' : 'pending'}`}>
                            {currentEpisode.status === 'generated' ? '已生成' : '待生成'}
                          </span>
                        </div>
                      </div>

                      {/* 剧情概要 */}
                      {currentEpisode.summary && (
                        <div className="story-block">
                          <h4>{isVideo ? '剧情简介' : '剧情概要'}</h4>
                          <div className="story-text">{currentEpisode.summary}</div>
                        </div>
                      )}

                      {/* 场景列表 */}
                      <SceneList />

                      {/* 流水线控制 */}
                      <div style={{ marginTop: 16 }}>
                        <PipelineControl />
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                      点击上方的剧集 chip 查看详情
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ===== ASSET TAB ===== */}
        {leftTab === 'assets' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
            <AssetLibrary />
          </div>
        )}
      </div>
    </div>
  )
}