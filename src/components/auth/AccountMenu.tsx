'use client'

import type { AuthUser } from '@/services/auth.service'

export default function AccountMenu({ user }: { user: AuthUser }) {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.assign('/login')
  }

  return (
    <details className="group relative">
      <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 text-sm text-gray-300 transition hover:bg-white/10 [&::-webkit-details-marker]:hidden">
        <span className="grid size-6 place-items-center rounded bg-cyan-300 text-xs font-bold text-gray-950">
          {user.name.trim().slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-24 truncate sm:block">{user.name}</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-white/10 bg-[#17171f] p-2 shadow-2xl">
        <div className="border-b border-white/10 px-2 py-2">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="mt-0.5 truncate text-xs text-gray-500">{user.email}</p>
        </div>
        <button type="button" onClick={handleLogout}
          className="mt-1 h-9 w-full rounded px-2 text-left text-sm text-gray-300 transition hover:bg-white/10 hover:text-white">
          退出登录
        </button>
      </div>
    </details>
  )
}
