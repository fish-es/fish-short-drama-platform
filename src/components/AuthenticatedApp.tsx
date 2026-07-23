'use client'

import { useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import { hasApiKey } from '@/services/api.client'
import type { AuthUser } from '@/services/auth.service'
import Home from '@/components/project/Home'
import Workspace from '@/components/project/Workspace'
import SetupKey from '@/components/settings/SetupKey'

export default function AuthenticatedApp({ user }: { user: AuthUser }) {
  const { currentProject } = useAppStore()
  const isClient = useSyncExternalStore(() => () => {}, () => true, () => false)

  if (!isClient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <p className="text-gray-400">加载中...</p>
      </div>
    )
  }

  if (!hasApiKey()) return <SetupKey user={user} onComplete={() => window.location.reload()} />
  if (currentProject) return <Workspace user={user} />
  return <Home user={user} />
}
