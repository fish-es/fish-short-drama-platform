'use client'

import { useState } from 'react'

type Mode = 'login' | 'register' | 'forgot' | 'reset'

interface Props {
  onComplete: (token: string, username: string) => void
}

export default function LoginPage({ onComplete }: Props) {
  const [mode, setMode] = useState<Mode>('login')

  // Shared fields
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Token shown after forgot-password request
  const [generatedResetToken, setGeneratedResetToken] = useState('')

  const clearErrors = () => setError('')

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setGeneratedResetToken('')
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    clearErrors()
    if (!username.trim() || !password) { setError('请填写用户名和密码'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '登录失败'); return }
      onComplete(data.token, data.username)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    clearErrors()
    if (!username.trim()) { setError('请填写用户名'); return }
    if (password.length < 12) { setError('密码长度不能少于12位'); return }
    if (password !== confirmPassword) { setError('两次输入的密码不一致'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '注册失败'); return }
      onComplete(data.token, data.username)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // ── Forgot password ────────────────────────────────────────────────────────
  const handleForgot = async () => {
    clearErrors()
    if (!username.trim()) { setError('请填写用户名'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '操作失败'); return }
      setGeneratedResetToken(data.resetToken)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // ── Reset password ─────────────────────────────────────────────────────────
  const handleReset = async () => {
    clearErrors()
    if (!resetToken.trim()) { setError('请输入重置令牌'); return }
    if (newPassword.length < 12) { setError('新密码长度不能少于12位'); return }
    if (newPassword !== confirmNewPassword) { setError('两次输入的密码不一致'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '重置失败'); return }
      onComplete(data.token, data.username)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // Password strength indicator (used in register and reset forms)
  const PasswordWarning = ({ value }: { value: string }) => {
    if (!value || value.length >= 12) return null
    return (
      <p className="text-red-500 text-xs mt-1">
        密码长度不能少于12位（当前 {value.length} 位）
      </p>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700 shadow-xl">

        {/* Header */}
        <h1 className="text-2xl font-bold text-center mb-1">短剧开发平台</h1>
        <p className="text-gray-400 text-center text-sm mb-6">AI 驱动的短剧自动生成工具</p>

        {/* Mode tabs (login / register) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex rounded-lg overflow-hidden border border-gray-700 mb-6">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === 'register' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              注册
            </button>
          </div>
        )}

        {/* Back button for forgot / reset modes */}
        {(mode === 'forgot' || mode === 'reset') && (
          <button
            onClick={() => switchMode('login')}
            className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-4 transition-colors"
          >
            ← 返回登录
          </button>
        )}

        {/* ── Login form ── */}
        {mode === 'login' && (
          <div className="space-y-4">
            <Field label="用户名">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="输入用户名"
                autoComplete="username"
                className={inputCls}
              />
            </Field>
            <Field label="密码">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="输入密码"
                autoComplete="current-password"
                className={inputCls}
              />
            </Field>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleLogin} disabled={loading} className={btnCls}>
              {loading ? '登录中...' : '登录'}
            </button>
            <p className="text-center">
              <button
                onClick={() => switchMode('forgot')}
                className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                忘记密码？
              </button>
            </p>
          </div>
        )}

        {/* ── Register form ── */}
        {mode === 'register' && (
          <div className="space-y-4">
            <Field label="用户名">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="字母、数字、下划线或中文，最多32个字符"
                autoComplete="username"
                className={inputCls}
              />
            </Field>
            <Field label="密码">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="至少12位"
                autoComplete="new-password"
                className={inputCls}
              />
              <PasswordWarning value={password} />
            </Field>
            <Field label="确认密码">
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
                placeholder="再次输入密码"
                autoComplete="new-password"
                className={inputCls}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="text-red-500 text-xs mt-1">两次输入的密码不一致</p>
              )}
            </Field>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleRegister} disabled={loading} className={btnCls}>
              {loading ? '注册中...' : '注册'}
            </button>
          </div>
        )}

        {/* ── Forgot password form ── */}
        {mode === 'forgot' && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              输入你的用户名，系统会生成一个重置令牌，用它来设置新密码。
            </p>
            <Field label="用户名">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleForgot()}
                placeholder="输入你的用户名"
                className={inputCls}
              />
            </Field>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            {!generatedResetToken ? (
              <button onClick={handleForgot} disabled={loading} className={btnCls}>
                {loading ? '生成中...' : '获取重置令牌'}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-gray-900 border border-green-600 rounded-lg p-3">
                  <p className="text-green-400 text-xs mb-1">重置令牌（1小时内有效）：</p>
                  <p className="font-mono text-green-300 break-all select-all text-sm">
                    {generatedResetToken}
                  </p>
                  <p className="text-gray-500 text-xs mt-2">请复制此令牌，然后点击下方按钮使用它重置密码。</p>
                </div>
                <button
                  onClick={() => { setResetToken(generatedResetToken); switchMode('reset') }}
                  className={btnCls}
                >
                  使用令牌重置密码 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Reset password form ── */}
        {mode === 'reset' && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              粘贴你的重置令牌，然后设置新密码。
            </p>
            <Field label="重置令牌">
              <input
                type="text"
                value={resetToken}
                onChange={e => setResetToken(e.target.value)}
                placeholder="粘贴重置令牌"
                className={`${inputCls} font-mono`}
              />
            </Field>
            <Field label="新密码">
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="至少12位"
                autoComplete="new-password"
                className={inputCls}
              />
              <PasswordWarning value={newPassword} />
            </Field>
            <Field label="确认新密码">
              <input
                type="password"
                value={confirmNewPassword}
                onChange={e => setConfirmNewPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="再次输入新密码"
                autoComplete="new-password"
                className={inputCls}
              />
              {confirmNewPassword && confirmNewPassword !== newPassword && (
                <p className="text-red-500 text-xs mt-1">两次输入的密码不一致</p>
              )}
            </Field>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleReset} disabled={loading} className={btnCls}>
              {loading ? '重置中...' : '重置密码并登录'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm text-white placeholder-gray-600'

const btnCls =
  'w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors'
