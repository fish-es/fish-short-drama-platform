'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { ProtectedImage } from '@/components/common/ProtectedMedia'

interface Character {
  id: string; name: string; description: string; voiceId: string; referenceImage: string | null; keywords: string
}
interface Location {
  id: string; name: string; description: string; referenceImage: string | null; keywords: string
}

async function requestAssets(projectId: string): Promise<{
  characters: Character[]
  locations: Location[]
}> {
  const headers = { 'x-api-key': localStorage.getItem('agnes_api_key') || '' }
  const [characters, locations] = await Promise.all([
    fetch(`/api/asset?projectId=${projectId}&type=characters`, { headers }).then(res => res.json()),
    fetch(`/api/asset?projectId=${projectId}&type=locations`, { headers }).then(res => res.json()),
  ])
  return {
    characters: Array.isArray(characters) ? characters : [],
    locations: Array.isArray(locations) ? locations : [],
  }
}

export default function AssetLibrary() {
  const { currentProject } = useAppStore()
  const isOwner = currentProject?.isOwner !== false
  const [tab, setTab] = useState<'characters' | 'locations'>('characters')
  const [characters, setCharacters] = useState<Character[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editKeywords, setEditKeywords] = useState('')

  const loadAssets = async () => {
    if (!currentProject) return
    const assets = await requestAssets(currentProject.id)
    setCharacters(assets.characters)
    setLocations(assets.locations)
  }

  useEffect(() => {
    if (!currentProject) return
    let cancelled = false
    requestAssets(currentProject.id).then(assets => {
      if (cancelled) return
      setCharacters(assets.characters)
      setLocations(assets.locations)
    })
    return () => {
      cancelled = true
    }
  }, [currentProject])

  const handleRegenerate = async (id: string, keywords: string) => {
    if (!currentProject) return
    const type = tab === 'characters' ? 'character' : 'location'
    await fetch('/api/asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': localStorage.getItem('agnes_api_key') || '' },
      body: JSON.stringify({ id, type, keywords, projectId: currentProject.id, action: 'regenerate' })
    })
    loadAssets()
  }

  const handleSaveKeywords = async (id: string) => {
    const type = tab === 'characters' ? 'character' : 'location'
    await fetch('/api/asset', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-api-key': localStorage.getItem('agnes_api_key') || '' },
      body: JSON.stringify({ id, type, keywords: editKeywords })
    })
    setEditingId(null)
    loadAssets()
  }

  const items = tab === 'characters' ? characters : locations

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
        <button onClick={() => setTab('characters')}
          className={`px-3 py-1 text-xs rounded ${tab === 'characters' ? 'bg-indigo-600' : 'btn-secondary'}`}>
          角色 ({characters.length})
        </button>
        <button onClick={() => setTab('locations')}
          className={`px-3 py-1 text-xs rounded ${tab === 'locations' ? 'bg-indigo-600' : 'btn-secondary'}`}>
          场景 ({locations.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-4">生成大纲后自动创建</p>
        )}
        {items.map(item => (
          <div key={item.id} className="glass-card p-3">
            <div className="flex items-start gap-3">
              {item.referenceImage ? (
                <ProtectedImage
                  source={item.referenceImage}
                  protectedUrl={`/api/file?kind=${tab === 'characters' ? 'character' : 'location'}&id=${encodeURIComponent(item.id)}`}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 bg-white/5 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-gray-500">无图</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium">{item.name}</h4>
                <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                {editingId === item.id ? (
                  <div className="mt-1 space-y-1">
                    <textarea value={editKeywords} onChange={e => setEditKeywords(e.target.value)}
                      className="input-field w-full text-xs resize-none" rows={2} />
                    <div className="flex gap-1">
                      <button onClick={() => handleSaveKeywords(item.id)} className="btn-success px-2 py-0.5 text-xs">保存</button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary px-2 py-0.5 text-xs">取消</button>
                    </div>
                  </div>
                ) : (
                  <p className={`text-xs text-indigo-400 mt-0.5 ${isOwner ? 'cursor-pointer hover:text-indigo-300' : ''}`}
                    onClick={() => { if (isOwner) { setEditingId(item.id); setEditKeywords(item.keywords) } }}>
                    🏷 {item.keywords || (isOwner ? '(点击添加关键词)' : '(无关键词)')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              {isOwner && (
                <button onClick={() => handleRegenerate(item.id, item.keywords)}
                  disabled={!item.keywords}
                  className="btn-primary px-2 py-1 text-xs disabled:opacity-50">
                  重新生成
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
