'use client'

import { useState } from 'react'
import { setApiKey } from '@/services/api.client'

export default function SetupKey({ onComplete }: { onComplete: () => void }) {
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    if (!key.trim()) return
    setSaving(true)
    setApiKey(key.trim())
    setTimeout(() => onComplete(), 500)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--color-bg)' }}
    >
      <div
        className="animate-enter-scale"
        style={{
          padding: 32,
          maxWidth: 480,
          width: '100%',
          margin: '0 16px',
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <h2
          className="text-2xl font-bold mb-2 text-center"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}
        >
          欢迎使用短剧开发平台
        </h2>
        <p className="text-center mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          请填写你的 Agnes AI API Key 以开始使用
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Agnes AI API Key</label>
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="输入你的 API Key"
              className="input-field text-sm"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>API Base URL: https://apihub.agnes-ai.com/v1</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !key.trim()}
            className="btn-primary w-full"
          >
            {saving ? '保存中...' : '开始使用'}
          </button>
        </div>
      </div>
    </div>
  )
}
