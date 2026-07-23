'use client'

import { FormEvent, useState } from 'react'
import { meetsPasswordRequirements, PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENT_MESSAGE } from '@/services/password-policy'

type Mode = 'login' | 'register'

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const passwordIsTooSimple = mode === 'register' && password.length > 0 && !meetsPasswordRequirements(password)

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode)
    setError('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (mode === 'register' && !meetsPasswordRequirements(password)) {
      setError('请先设置符合要求的密码')
      return
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setPending(true)
    try {
      const response = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          legacyApiKey: localStorage.getItem('agnes_api_key') || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '请求失败，请稍后重试')
      window.location.assign('/')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '请求失败，请稍后重试')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm" noValidate>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase text-cyan-300">Fish Studio</p>
        <h1 className="text-3xl font-semibold text-white">{mode === 'login' ? '欢迎回来' : '创建账户'}</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {mode === 'login' ? '登录后继续你的短剧创作。' : '注册后即可开始管理你的创作项目。'}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 border-b border-white/10" role="tablist" aria-label="账户操作">
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}
          className={`h-11 border-b-2 text-sm font-medium transition ${mode === 'login' ? 'border-cyan-300 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
          登录
        </button>
        <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => switchMode('register')}
          className={`h-11 border-b-2 text-sm font-medium transition ${mode === 'register' ? 'border-cyan-300 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
          注册
        </button>
      </div>

      <div className="space-y-4">
        {mode === 'register' && (
          <label className="block text-sm text-zinc-300">
            昵称
            <input name="name" value={name} onChange={event => setName(event.target.value)} autoComplete="name"
              minLength={2} maxLength={40} required placeholder="你的昵称"
              className="mt-2 h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/15" />
          </label>
        )}

        <label className="block text-sm text-zinc-300">
          邮箱
          <input name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email"
            required placeholder="name@example.com"
            className="mt-2 h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/15" />
        </label>

        <label className="block text-sm text-zinc-300">
          密码
          <span className="relative mt-2 block">
            <input name="password" type={showPassword ? 'text' : 'password'} value={password}
              onChange={event => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? PASSWORD_MIN_LENGTH : undefined} maxLength={128} required
              placeholder={mode === 'register' ? '至少 12 位，包含大小写字母和数字' : '输入密码'}
              aria-invalid={passwordIsTooSimple} aria-describedby={passwordIsTooSimple ? 'password-requirement' : undefined}
              className={`h-11 w-full rounded-md border bg-white/5 px-3 pr-14 text-white outline-none transition placeholder:text-zinc-600 focus:ring-2 ${passwordIsTooSimple ? 'border-red-400/70 focus:border-red-400 focus:ring-red-400/15' : 'border-white/10 focus:border-cyan-300 focus:ring-cyan-300/15'}`} />
            <button type="button" onClick={() => setShowPassword(value => !value)}
              className="absolute inset-y-0 right-0 w-14 text-xs text-zinc-500 hover:text-zinc-200"
              aria-label={showPassword ? '隐藏密码' : '显示密码'}>
              {showPassword ? '隐藏' : '显示'}
            </button>
          </span>
          {passwordIsTooSimple && (
            <span id="password-requirement" role="alert" className="mt-2 block text-xs leading-5 text-red-300">
              {PASSWORD_REQUIREMENT_MESSAGE}
            </span>
          )}
        </label>

        {mode === 'register' && (
          <label className="block text-sm text-zinc-300">
            确认密码
            <input name="confirmPassword" type={showPassword ? 'text' : 'password'} value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH} maxLength={128} required placeholder="再次输入密码"
              className="mt-2 h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/15" />
          </label>
        )}
      </div>

      <div className="mt-4 min-h-6" aria-live="polite">
        {error && <p className="text-sm text-red-300">{error}</p>}
      </div>

      <button type="submit" disabled={pending}
        className="mt-2 h-11 w-full rounded-md bg-cyan-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? '请稍候...' : mode === 'login' ? '登录' : '创建账户'}
      </button>
    </form>
  )
}
