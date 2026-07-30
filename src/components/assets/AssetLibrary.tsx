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

  const tagStyle: React.CSSProperties = {
    display: 'inline-block',
    marginTop: '4px',
    background: 'var(--color-surface)',
    color: 'var(--color-accent)',
    fontSize: '9px',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    cursor: isOwner ? 'pointer' : 'default',
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      {/* Sub-tabs (underline style) */}
      <div className="subnav" style={{ padding: '0 12px' }}>
        <button onClick={() => setTab('characters')}
          className={`subnav-tab ${tab === 'characters' ? 'active' : ''}`}
          style={{ padding: '10px 14px' }}>
          角色 ({characters.length})
        </button>
        <button onClick={() => setTab('locations')}
          className={`subnav-tab ${tab === 'locations' ? 'active' : ''}`}
          style={{ padding: '10px 14px' }}>
          场景 ({locations.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'characters' ? (
          characters.length === 0 ? (
            <p className="text-center text-sm py-4" style={{ color: 'var(--color-text-secondary)' }}>生成大纲后自动创建</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
              {characters.map(item => (
                <div key={item.id} className="glass-card" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    {/* 60px avatar */}
                    {item.referenceImage ? (
                      <div style={{ width: 60, height: 60, flexShrink: 0, overflow: 'hidden', borderRadius: 'var(--radius-sm)' }}>
                        <ProtectedImage
                          source={item.referenceImage}
                          protectedUrl={`/api/file?kind=character&id=${encodeURIComponent(item.id)}`}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div style={{
                        width: 60, height: 60, flexShrink: 0, borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-surface-alt)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>无图</span>
                      </div>
                    )}
                    {/* Body */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{item.name}</h4>
                      <p style={{ fontSize: '11px', marginTop: '2px', color: 'var(--color-text-secondary)' }}>{item.description}</p>
                      {editingId === item.id ? (
                        <div style={{ marginTop: '6px' }}>
                          <textarea value={editKeywords} onChange={e => setEditKeywords(e.target.value)}
                            className="input-field w-full resize-none" rows={2}
                            style={{ fontSize: '11px' }} />
                          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                            <button onClick={() => handleSaveKeywords(item.id)} className="btn-success px-2 py-0.5 text-xs">保存</button>
                            <button onClick={() => setEditingId(null)} className="btn-secondary px-2 py-0.5 text-xs">取消</button>
                          </div>
                        </div>
                      ) : (
                        <span
                          style={tagStyle}
                          onClick={() => { if (isOwner) { setEditingId(item.id); setEditKeywords(item.keywords) } }}
                          onMouseEnter={(e) => { if (isOwner) e.currentTarget.style.color = 'var(--color-accent-hover)' }}
                          onMouseLeave={(e) => { if (isOwner) e.currentTarget.style.color = 'var(--color-accent)' }}
                        >
                          🏷 {item.keywords || (isOwner ? '(点击添加关键词)' : '(无关键词)')}
                        </span>
                      )}
                    </div>
                  </div>
                  {isOwner && (
                    <button onClick={() => handleRegenerate(item.id, item.keywords)}
                      disabled={!item.keywords}
                      className="btn-ghost-sm disabled:opacity-50"
                      style={{ marginTop: '8px' }}>
                      重新生成
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          locations.length === 0 ? (
            <p className="text-center text-sm py-4" style={{ color: 'var(--color-text-secondary)' }}>生成大纲后自动创建</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
              {locations.map(item => (
                <div key={item.id} className="glass-card" style={{ padding: '14px' }}>
                  {/* 130px preview */}
                  {item.referenceImage ? (
                    <div style={{ width: '100%', height: 130, overflow: 'hidden', borderRadius: 'var(--radius-sm)' }}>
                      <ProtectedImage
                        source={item.referenceImage}
                        protectedUrl={`/api/file?kind=location&id=${encodeURIComponent(item.id)}`}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: '100%', height: 130, borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-surface-alt)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>无图</span>
                    </div>
                  )}
                  {/* Body */}
                  <div style={{ marginTop: '10px' }}>
                    <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{item.name}</h4>
                    <p style={{ fontSize: '11px', marginTop: '2px', color: 'var(--color-text-secondary)' }}>{item.description}</p>
                    {editingId === item.id ? (
                      <div style={{ marginTop: '6px' }}>
                        <textarea value={editKeywords} onChange={e => setEditKeywords(e.target.value)}
                          className="input-field w-full resize-none" rows={2}
                          style={{ fontSize: '11px' }} />
                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                          <button onClick={() => handleSaveKeywords(item.id)} className="btn-success px-2 py-0.5 text-xs">保存</button>
                          <button onClick={() => setEditingId(null)} className="btn-secondary px-2 py-0.5 text-xs">取消</button>
                        </div>
                      </div>
                    ) : (
                      <span
                        style={tagStyle}
                        onClick={() => { if (isOwner) { setEditingId(item.id); setEditKeywords(item.keywords) } }}
                        onMouseEnter={(e) => { if (isOwner) e.currentTarget.style.color = 'var(--color-accent-hover)' }}
                        onMouseLeave={(e) => { if (isOwner) e.currentTarget.style.color = 'var(--color-accent)' }}
                      >
                        🏷 {item.keywords || (isOwner ? '(点击添加关键词)' : '(无关键词)')}
                      </span>
                    )}
                  </div>
                  {isOwner && (
                    <button onClick={() => handleRegenerate(item.id, item.keywords)}
                      disabled={!item.keywords}
                      className="btn-ghost-sm disabled:opacity-50"
                      style={{ marginTop: '8px' }}>
                      重新生成
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
