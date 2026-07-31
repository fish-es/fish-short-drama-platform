'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { ProtectedImage } from '@/components/common/ProtectedMedia'
import { getApiKeys } from '@/services/api.client'
import { generateImage } from '@/services/agnes.client'
import { showAlert } from '@/components/common/Dialog'

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
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set())
  const [fillingAll, setFillingAll] = useState(false)

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

  // 浏览器端生成图片（走代理），再存到服务端。key 用于并行。
  const regenerateOne = async (type: 'character' | 'location', name: string, keywords: string, key: string) => {
    if (!currentProject || !keywords) return
    const prompt = type === 'character'
      ? `${keywords}，面朝镜头，半身像，中性背景，高质量，细致面部特征`
      : `${keywords}，广角镜头，电影感，高质量，无人物`
    const size = type === 'character' ? '768x1024' : '1024x768'
    const url = await generateImage(prompt, size, key)
    await fetch('/api/asset/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': localStorage.getItem('agnes_api_key') || '' },
      body: JSON.stringify({ projectId: currentProject.id, type, name, imageUrl: url })
    })
  }

  const handleRegenerate = async (item: { id: string; name: string; keywords: string }) => {
    if (!currentProject) return
    if (regenerating.has(item.id)) return  // 生成中，不允许重复点击
    const type = tab === 'characters' ? 'character' : 'location'
    const key = getApiKeys()[0] || localStorage.getItem('agnes_api_key') || ''
    setRegenerating(prev => new Set(prev).add(item.id))
    try {
      await regenerateOne(type, item.name, item.keywords, key)
      await loadAssets()
    } catch (e: any) {
      showAlert('生成失败: ' + e.message)
    } finally {
      setRegenerating(prev => { const n = new Set(prev); n.delete(item.id); return n })
    }
  }

  // 一键补全所有缺失图片（无 referenceImage）的角色和场景，多 Key 并行
  const handleFillMissing = async () => {
    if (!currentProject || fillingAll) return
    const missing = [
      ...characters.filter(c => !c.referenceImage && c.keywords).map(c => ({ id: c.id, type: 'character' as const, name: c.name, keywords: c.keywords })),
      ...locations.filter(l => !l.referenceImage && l.keywords).map(l => ({ id: l.id, type: 'location' as const, name: l.name, keywords: l.keywords })),
    ]
    if (missing.length === 0) { showAlert('没有缺失图片的资产'); return }
    setFillingAll(true)
    setRegenerating(new Set(missing.map(m => m.id)))
    const keys = getApiKeys()
    const pool = keys.length > 0 ? keys : [localStorage.getItem('agnes_api_key') || '']
    let idx = 0
    const worker = async (key: string) => {
      while (true) {
        const i = idx++
        if (i >= missing.length) return
        const m = missing[i]
        try { await regenerateOne(m.type, m.name, m.keywords, key) } catch {}
        setRegenerating(prev => { const n = new Set(prev); n.delete(m.id); return n })
        await loadAssets()
      }
    }
    try {
      await Promise.all(pool.map(k => worker(k)))
    } finally {
      setFillingAll(false)
      setRegenerating(new Set())
    }
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
    marginTop: '8px',
    background: 'var(--color-surface)',
    color: 'var(--color-accent)',
    fontSize: '13px',
    padding: '4px 12px',
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
        <div style={{ flex: 1 }} />
        {isOwner && (() => {
          const missingCount = characters.filter(c => !c.referenceImage && c.keywords).length + locations.filter(l => !l.referenceImage && l.keywords).length
          return (
            <button onClick={handleFillMissing} disabled={fillingAll || missingCount === 0}
              className="btn-accent-sm disabled:opacity-50" style={{ fontSize: 11, alignSelf: 'center', marginRight: 8 }}
              title={missingCount === 0 ? '没有缺失图片的资产' : `补全 ${missingCount} 个缺失图片`}>
              {fillingAll ? '补全中...' : `一键补全缺失图${missingCount > 0 ? ` (${missingCount})` : ''}`}
            </button>
          )
        })()}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'characters' ? (
          characters.length === 0 ? (
            <p className="text-center text-sm py-4" style={{ color: 'var(--color-text-secondary)' }}>生成大纲后自动创建</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
              {characters.map(item => (
                <div key={item.id} className="glass-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* 大图（竖向 3:4） */}
                  {item.referenceImage ? (
                    <div style={{ width: '100%', aspectRatio: '3 / 4', overflow: 'hidden' }}>
                      <ProtectedImage
                        source={item.referenceImage}
                        protectedUrl={`/api/file?kind=character&id=${encodeURIComponent(item.id)}`}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: '100%', aspectRatio: '3 / 4',
                      background: 'var(--color-surface-alt)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>无图</span>
                    </div>
                  )}
                  {/* 底部信息区 */}
                  <div style={{ padding: '12px 14px' }}>
                    <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>{item.name}</h4>
                    <p style={{ fontSize: '12px', marginTop: '2px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{item.description}</p>
                    {editingId === item.id ? (
                      <div style={{ marginTop: '6px' }}>
                        <textarea value={editKeywords} onChange={e => setEditKeywords(e.target.value)}
                          className="input-field w-full resize-none" rows={3}
                          style={{ fontSize: '13px' }} />
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
                    {isOwner && (
                      <button onClick={() => handleRegenerate({ id: item.id, name: item.name, keywords: item.keywords })}
                        disabled={!item.keywords || regenerating.has(item.id)}
                        className="btn-ghost-sm disabled:opacity-50"
                        style={{ marginTop: '8px' }}>
                        {regenerating.has(item.id) ? '生成中...' : '重新生成'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          locations.length === 0 ? (
            <p className="text-center text-sm py-4" style={{ color: 'var(--color-text-secondary)' }}>生成大纲后自动创建</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {locations.map(item => (
                <div key={item.id} className="glass-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* 大图（横向 4:3） */}
                  {item.referenceImage ? (
                    <div style={{ width: '100%', aspectRatio: '4 / 3', overflow: 'hidden' }}>
                      <ProtectedImage
                        source={item.referenceImage}
                        protectedUrl={`/api/file?kind=location&id=${encodeURIComponent(item.id)}`}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: '100%', aspectRatio: '4 / 3',
                      background: 'var(--color-surface-alt)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '14px', color: 'var(--color-text-tertiary)' }}>无图</span>
                    </div>
                  )}
                  {/* 底部信息区 */}
                  <div style={{ padding: '12px 14px' }}>
                    <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>{item.name}</h4>
                    <p style={{ fontSize: '12px', marginTop: '2px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{item.description}</p>
                    {editingId === item.id ? (
                      <div style={{ marginTop: '6px' }}>
                        <textarea value={editKeywords} onChange={e => setEditKeywords(e.target.value)}
                          className="input-field w-full resize-none" rows={3}
                          style={{ fontSize: '13px' }} />
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
                    {isOwner && (
                      <button onClick={() => handleRegenerate({ id: item.id, name: item.name, keywords: item.keywords })}
                        disabled={!item.keywords || regenerating.has(item.id)}
                        className="btn-ghost-sm disabled:opacity-50"
                        style={{ marginTop: '8px' }}>
                        {regenerating.has(item.id) ? '生成中...' : '重新生成'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
