'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'

interface Character {
  id: string; name: string; description: string; voiceId: string; referenceImage: string | null; keywords: string
}
interface Location {
  id: string; name: string; description: string; referenceImage: string | null; keywords: string
}

export default function AssetLibrary() {
  const { currentProject } = useAppStore()
  const [tab, setTab] = useState<'characters' | 'locations'>('characters')
  const [characters, setCharacters] = useState<Character[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editKeywords, setEditKeywords] = useState('')

  useEffect(() => {
    if (!currentProject) return
    loadAssets()
  }, [currentProject])

  const loadAssets = async () => {
    if (!currentProject) return
    const [chars, locs] = await Promise.all([
      fetch(`/api/asset?projectId=${currentProject.id}&type=characters`).then(r => r.json()),
      fetch(`/api/asset?projectId=${currentProject.id}&type=locations`).then(r => r.json())
    ])
    setCharacters(chars)
    setLocations(locs)
  }

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type, keywords: editKeywords })
    })
    setEditingId(null)
    loadAssets()
  }

  const assetUrl = (path: string | null) => {
    if (!path) return ''
    if (path.startsWith('http')) return path
    return `/api/file?path=${encodeURIComponent(path)}`
  }

  const items = tab === 'characters' ? characters : locations

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700">
        <button onClick={() => setTab('characters')}
          className={`px-3 py-1 text-xs rounded ${tab === 'characters' ? 'bg-blue-600' : 'bg-gray-700'}`}>
          角色 ({characters.length})
        </button>
        <button onClick={() => setTab('locations')}
          className={`px-3 py-1 text-xs rounded ${tab === 'locations' ? 'bg-blue-600' : 'bg-gray-700'}`}>
          场景 ({locations.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-4">生成大纲后自动创建</p>
        )}
        {items.map(item => (
          <div key={item.id} className="p-3 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-start gap-3">
              {item.referenceImage ? (
                <img src={assetUrl(item.referenceImage)}
                  alt={item.name} className="w-16 h-16 object-cover rounded flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-gray-500">无图</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium">{item.name}</h4>
                <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                {editingId === item.id ? (
                  <div className="mt-1 space-y-1">
                    <textarea value={editKeywords} onChange={e => setEditKeywords(e.target.value)}
                      className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 resize-none" rows={2} />
                    <div className="flex gap-1">
                      <button onClick={() => handleSaveKeywords(item.id)} className="px-2 py-0.5 text-xs bg-green-600 rounded">保存</button>
                      <button onClick={() => setEditingId(null)} className="px-2 py-0.5 text-xs bg-gray-700 rounded">取消</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-blue-400 mt-0.5 cursor-pointer hover:text-blue-300"
                    onClick={() => { setEditingId(item.id); setEditKeywords(item.keywords) }}>
                    🏷 {item.keywords || '(点击添加关键词)'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => handleRegenerate(item.id, item.keywords)}
                disabled={!item.keywords}
                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded">
                重新生成
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
