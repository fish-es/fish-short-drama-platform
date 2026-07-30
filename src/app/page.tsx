'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { hasSession, setSessionToken } from '@/services/api.client'
import Home from '@/components/project/Home'
import Workspace from '@/components/project/Workspace'
import LoginPage from '@/components/auth/LoginPage'

export default function Page() {
  const { currentProject } = useAppStore()
  const [loggedIn, setLoggedIn] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    setLoggedIn(hasSession())
  }, [])

  const handleLoginComplete = (token: string) => {
    setSessionToken(token)
    setLoggedIn(true)
    setShowLogin(false)
  }

  if (currentProject) {
    return <Workspace />
  }

  return (
    <>
      <Home
        loggedIn={loggedIn}
        onLoginRequired={() => setShowLogin(true)}
      />
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'var(--bg-overlay)' }}>
          <div className="relative w-full max-w-lg mx-4">
            <button
              onClick={() => setShowLogin(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full text-white z-10 flex items-center justify-center text-lg"
              style={{ background: 'var(--color-text-secondary)' }}
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

