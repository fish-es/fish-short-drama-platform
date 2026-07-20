'use client'

import { useState } from 'react'
import { useAppStore } from '@/store'
import ScriptChat from '@/components/script/ScriptChat'
import EpisodeList from '@/components/episode/EpisodeList'
import SceneList from '@/components/scene/SceneList'
import PipelineControl from '@/components/pipeline/PipelineControl'
import AssetLibrary from '@/components/assets/AssetLibrary'

export default function Workspace() {
  const { currentProject, clearProject, currentEpisodeId } = useAppStore()
  const [leftTab, setLeftTab] = useState<'script' | 'assets'>('script')

  if (!currentProject) return null

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <button onClick={clearProject} className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded">
            ← 返回
          </button>
          <h2 className="text-lg font-medium">{currentProject.dramaTitle || currentProject.name}</h2>
        </div>
        <span className="text-sm text-gray-400">{currentProject.aspectRatio}</span>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-1/4 border-r border-gray-700 flex flex-col">
          <div className="flex items-center gap-1 px-2 py-2 bg-gray-800 border-b border-gray-700">
            <button onClick={() => setLeftTab('script')}
              className={`px-3 py-1 text-xs rounded ${leftTab === 'script' ? 'bg-blue-600' : 'bg-gray-700 text-gray-400'}`}>
              剧本创作
            </button>
            <button onClick={() => setLeftTab('assets')}
              className={`px-3 py-1 text-xs rounded ${leftTab === 'assets' ? 'bg-blue-600' : 'bg-gray-700 text-gray-400'}`}>
              资产库
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {leftTab === 'script' ? <ScriptChat /> : <AssetLibrary />}
          </div>
        </div>

        <div className="w-1/4 border-r border-gray-700 flex flex-col">
          <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
            <h3 className="text-sm font-medium">剧集管理</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <EpisodeList />
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
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
            <div className="border-t border-gray-700">
              <PipelineControl />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
