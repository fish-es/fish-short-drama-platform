'use client'

import { useState } from 'react'
import { useAppStore } from '@/store'
import ScriptChat from '@/components/script/ScriptChat'
import EpisodeList from '@/components/episode/EpisodeList'
import SceneList from '@/components/scene/SceneList'
import PipelineControl from '@/components/pipeline/PipelineControl'
import AssetLibrary from '@/components/assets/AssetLibrary'

export default function Workspace() {
  const { currentProject, clearProject, currentEpisodeId, episodes } = useAppStore()
  const [leftTab, setLeftTab] = useState<'script' | 'assets'>('script')
  const [bannerCollapsed, setBannerCollapsed] = useState(false)

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
          <button onClick={clearProject}><span className="icon">←</span><span>返回首页</span></button>
        </div>
      </nav>

      {/* ===== MAIN ===== */}
      <div className="main-content">
        {/* TOPBAR */}
        <div className="topbar">
          <div className="topbar-left">
            <span className="topbar-bc">
              <a onClick={clearProject}>短剧开发平台</a>
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
          </div>
        </div>

        {/* SUBNAV */}
        <div className="subnav">
          <button className={`subnav-tab ${leftTab === 'script' ? 'active' : ''}`} onClick={() => setLeftTab('script')}>剧本创作</button>
          <button className={`subnav-tab ${leftTab === 'assets' ? 'active' : ''}`} onClick={() => setLeftTab('assets')}>资产库</button>
          <div className="subnav-spacer" />
        </div>

        {/* ===== SCRIPT TAB ===== */}
        {leftTab === 'script' && (
          <>
            {/* STORY BANNER (可折叠) */}
            <div className={`story-banner ${bannerCollapsed ? 'collapsed' : ''}`}>
              <div className="story-banner-inner">
                <div className="story-banner-meta">
                  <div className="label">项目信息</div>
                  <div className="meta-row"><strong>比例</strong> {currentProject.aspectRatio || '—'}</div>
                  <div className="meta-row"><strong>类型</strong> {currentProject.projectType === 'video' ? '长视频' : '短剧'}</div>
                  <div className="meta-row"><strong>状态</strong> {currentEpisodeId ? '创作中' : '新建'}</div>
                </div>
                <div className="story-banner-summary">
                  <div className="banner-title">{currentProject.dramaTitle || currentProject.name}</div>
                  <div className="banner-desc">在左侧输入你的故事构思，AI 将为你生成完整的剧本大纲和剧集内容。</div>
                </div>
              </div>
            </div>
            <button className="banner-toggle-btn" onClick={() => setBannerCollapsed(!bannerCollapsed)}>
              {bannerCollapsed ? '展开梗概 ▼' : '收起梗概 ▲'}
            </button>

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
                        <div className="ed-num">第 {currentEpisode.number} 集</div>
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
                          <h4>剧情概要</h4>
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