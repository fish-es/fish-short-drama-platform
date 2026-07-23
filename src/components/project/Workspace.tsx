'use client'

import { useState } from 'react'
import { useAppStore } from '@/store'
import ScriptChat from '@/components/script/ScriptChat'
import EpisodeList from '@/components/episode/EpisodeList'
import SceneList from '@/components/scene/SceneList'
import PipelineControl from '@/components/pipeline/PipelineControl'
import AssetLibrary from '@/components/assets/AssetLibrary'
import type { AuthUser } from '@/services/auth.service'
import AccountMenu from '@/components/auth/AccountMenu'

export default function Workspace({ user }: { user: AuthUser }) {
  const { currentProject, clearProject, currentEpisodeId } = useAppStore()
  const [leftTab, setLeftTab] = useState<'script' | 'assets'>('script')

  if (!currentProject) return null

  return (
    <div className="min-h-screen text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 glass-card rounded-none border-x-0 border-t-0">
        <div className="flex items-center gap-4">
          <button onClick={clearProject} className="btn-secondary px-3 py-1 text-sm">
            ← 返回
          </button>
          <h2 className="text-lg font-medium">{currentProject.dramaTitle || currentProject.name}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{currentProject.aspectRatio}</span>
          <AccountMenu user={user} />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-1/4 border-r border-white/10 flex flex-col">
          <div className="flex items-center gap-1 px-2 py-2 glass-card rounded-none border-x-0 border-t-0">
            <button onClick={() => setLeftTab('script')}
              className={`px-3 py-1 text-xs rounded ${leftTab === 'script' ? 'bg-indigo-600' : 'btn-secondary text-gray-400'}`}>
              剧本创作
            </button>
            <button onClick={() => setLeftTab('assets')}
              className={`px-3 py-1 text-xs rounded ${leftTab === 'assets' ? 'bg-indigo-600' : 'btn-secondary text-gray-400'}`}>
              资产库
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {leftTab === 'script' ? <ScriptChat /> : <AssetLibrary />}
          </div>
        </div>

        <div className="w-1/4 border-r border-white/10 flex flex-col">
          <div className="px-4 py-2 glass-card rounded-none border-x-0 border-t-0">
            <h3 className="text-sm font-medium">剧集管理</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <EpisodeList />
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 glass-card rounded-none border-x-0 border-t-0">
            <h3 className="text-sm font-medium">
              {currentEpisodeId ? '场景管理' : '选择一集查看场景'}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {currentEpisodeId ? <SceneList /> : (
              <div className="p-4 text-center text-gray-500">在中间面板选择一集查看场景</div>
            )}
          </div>
          {currentEpisodeId && (
            <div className="border-t border-white/10">
              <PipelineControl />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
