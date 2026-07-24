'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { hasApiKey, hasSession, setSessionToken } from '@/services/api.client'
import Home from '@/components/project/Home'
import Workspace from '@/components/project/Workspace'
import SetupKey from '@/components/settings/SetupKey'
import LoginPage from '@/components/auth/LoginPage'

export default function Page() {
  const { currentProject } = useAppStore()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)

  useEffect(() => {
    setLoggedIn(hasSession())
    setNeedsSetup(!hasApiKey())
  }, [])

  // Initial load
  if (loggedIn === null) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">加载中...</p>
      </div>
    )
  }

  // Not logged in → show login/register page
  if (!loggedIn) {
    return (
      <LoginPage
        onComplete={(token) => {
          setSessionToken(token)
          setLoggedIn(true)
          setNeedsSetup(!hasApiKey())
        }}
      />
    )
  }

  // Logged in but no Agnes API key yet
  if (needsSetup) {
    return <SetupKey onComplete={() => setNeedsSetup(false)} />
  }

  if (currentProject) {
    return <Workspace />
  }

  return <Home />
}

