'use client'

import { useState } from 'react'
import { setApiKey } from '@/services/api.client'
import type { AuthUser } from '@/services/auth.service'
import AccountMenu from '@/components/auth/AccountMenu'

export default function SetupKey({ user, onComplete }: { user: AuthUser; onComplete: () => void }) {
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    if (!key.trim()) return
    setSaving(true)
    setApiKey(key.trim())
    setTimeout(() => onComplete(), 500)
  }

  return (
    <div className="relative min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="absolute right-4 top-4"><AccountMenu user={user} /></div>
      <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4 border border-gray-700">
        <h2 className="text-2xl font-bold mb-2 text-center">欢迎使用短剧开发平台</h2>
        <p className="text-gray-400 text-center mb-6">请填写你的 Agnes AI API Key 以开始使用</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Agnes AI API Key</label>
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="输入你的 API Key"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">API Base URL: https://apihub.agnes-ai.com/v1</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !key.trim()}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium"
          >
            {saving ? '保存中...' : '开始使用'}
          </button>
        </div>
      </div>
    </div>
  )
}
