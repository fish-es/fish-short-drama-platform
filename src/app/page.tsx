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
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">加载中...</p>
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
