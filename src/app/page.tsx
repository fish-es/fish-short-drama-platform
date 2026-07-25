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
  const [loggedIn, setLoggedIn] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    setLoggedIn(hasSession())
    setNeedsSetup(!hasApiKey())
  }, [])

  const handleLoginComplete = (token: string) => {
    setSessionToken(token)
    setLoggedIn(true)
    setNeedsSetup(!hasApiKey())
    setShowLogin(false)
  }

  if (currentProject) {
    return <Workspace />
  }

  if (loggedIn && needsSetup) {
    return <SetupKey onComplete={() => setNeedsSetup(false)} />
  }

  return (
    <>
      <Home
        loggedIn={loggedIn}
        onLoginRequired={() => setShowLogin(true)}
      />
      {showLogin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="relative w-full max-w-lg mx-4">
            <button
              onClick={() => setShowLogin(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-gray-700 rounded-full text-white hover:bg-gray-600 z-10 flex items-center justify-center text-lg"
            >
              ×
            </button>
            <LoginPage onComplete={handleLoginComplete} />
          </div>
        </div>
      )}
    </>
  )
}

