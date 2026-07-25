'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { hasApiKey } from '@/services/api.client'
import Home from '@/components/project/Home'
import Workspace from '@/components/project/Workspace'
import SetupKey from '@/components/settings/SetupKey'

export default function Page() {
  const { currentProject } = useAppStore()
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)

  useEffect(() => {
    setNeedsSetup(!hasApiKey())
  }, [])

  if (needsSetup === null) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--color-bg)' }}
      >
        <div
          className="w-8 h-8 rounded-full animate-spin"
          style={{
            border: '2px solid var(--color-border)',
            borderTopColor: 'var(--color-accent)',
          }}
        />
        <p style={{ color: 'var(--color-text-secondary)' }}>加载中...</p>
      </div>
    )
  }

  if (needsSetup) {
    return <SetupKey onComplete={() => setNeedsSetup(false)} />
  }

  if (currentProject) {
    return <Workspace />
  }

  return <Home />
}
