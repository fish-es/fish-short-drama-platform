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
    if (password.length < 6) { setError('密码长度不能少于6位'); return }
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
    if (newPassword.length < 6) { setError('新密码长度不能少于6位'); return }
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
    if (!value || value.length >= 6) return null
    return (
      <p style={{ color: 'var(--color-error)', fontSize: 11, marginTop: 4 }}>
        密码长度不能少于6位（当前 {value.length} 位）
      </p>
    )
  }

  return (
    <div className="animate-enter-scale" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 32, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>

      {/* Header */}
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, textAlign: 'center', marginBottom: 4, color: 'var(--color-text)' }}>短剧开发平台</h1>
      <p style={{ textAlign: 'center', fontSize: 13, marginBottom: 24, color: 'var(--color-text-secondary)' }}>AI 驱动的短剧自动生成工具</p>

      {/* Mode tabs (login / register) */}
      {(mode === 'login' || mode === 'register') && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 24 }}>
          <button
            onClick={() => switchMode('login')}
            className={`project-tab ${mode === 'login' ? 'active' : ''}`}
            style={{ flex: 1, textAlign: 'center' }}
          >
            登录
          </button>
          <button
            onClick={() => switchMode('register')}
            className={`project-tab ${mode === 'register' ? 'active' : ''}`}
            style={{ flex: 1, textAlign: 'center' }}
          >
            注册
          </button>
        </div>
      )}

      {/* Back button for forgot / reset modes */}
      {(mode === 'forgot' || mode === 'reset') && (
        <button
          onClick={() => switchMode('login')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, marginBottom: 16, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ← 返回登录
        </button>
      )}

      {/* ── Login form ── */}
      {mode === 'login' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="用户名">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="输入用户名"
              autoComplete="username"
              className="input-field"
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
              className="input-field"
            />
          </Field>
          {error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{error}</p>}
          <button onClick={handleLogin} disabled={loading} className="btn-accent" style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }}>
            {loading ? '登录中...' : '登录'}
          </button>
          <p style={{ textAlign: 'center' }}>
            <button
              onClick={() => switchMode('forgot')}
              style={{ color: 'var(--color-accent)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              忘记密码？
            </button>
          </p>
        </div>
      )}

      {/* ── Register form ── */}
      {mode === 'register' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="用户名">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="字母、数字、下划线或中文，最多32个字符"
              autoComplete="username"
              className="input-field"
            />
          </Field>
          <Field label="密码">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="至少6位"
              autoComplete="new-password"
              className="input-field"
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
              className="input-field"
            />
            {confirmPassword && confirmPassword !== password && (
              <p style={{ color: 'var(--color-error)', fontSize: 11, marginTop: 4 }}>两次输入的密码不一致</p>
            )}
          </Field>
          {error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{error}</p>}
          <button onClick={handleRegister} disabled={loading} className="btn-accent" style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }}>
            {loading ? '注册中...' : '注册'}
          </button>
        </div>
      )}

      {/* ── Forgot password form ── */}
      {mode === 'forgot' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
            输入你的用户名，系统会生成一个重置令牌，用它来设置新密码。
          </p>
          <Field label="用户名">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleForgot()}
              placeholder="输入你的用户名"
              className="input-field"
            />
          </Field>
          {error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{error}</p>}
          {!generatedResetToken ? (
            <button onClick={handleForgot} disabled={loading} className="btn-accent" style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }}>
              {loading ? '生成中...' : '获取重置令牌'}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--color-success-bg)', border: `1px solid var(--color-success)`, borderRadius: 'var(--radius-md)', padding: 12 }}>
                <p style={{ color: 'var(--color-success)', fontSize: 11, marginBottom: 4 }}>重置令牌（1小时内有效）：</p>
                <p style={{ fontFamily: 'monospace', color: 'var(--color-success)', fontSize: 13, wordBreak: 'break-all', userSelect: 'all' }}>
                  {generatedResetToken}
                </p>
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: 11, marginTop: 8 }}>请复制此令牌，然后点击下方按钮使用它重置密码。</p>
              </div>
              <button
                onClick={() => { setResetToken(generatedResetToken); switchMode('reset') }}
                className="btn-accent"
                style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }}
              >
                使用令牌重置密码 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Reset password form ── */}
      {mode === 'reset' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
            粘贴你的重置令牌，然后设置新密码。
          </p>
          <Field label="重置令牌">
            <input
              type="text"
              value={resetToken}
              onChange={e => setResetToken(e.target.value)}
              placeholder="粘贴重置令牌"
              className="input-field"
              style={{ fontFamily: 'monospace' }}
            />
          </Field>
          <Field label="新密码">
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="至少6位"
              autoComplete="new-password"
              className="input-field"
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
              className="input-field"
            />
            {confirmNewPassword && confirmNewPassword !== newPassword && (
              <p style={{ color: 'var(--color-error)', fontSize: 11, marginTop: 4 }}>两次输入的密码不一致</p>
            )}
          </Field>
          {error && <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{error}</p>}
          <button onClick={handleReset} disabled={loading} className="btn-accent" style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }}>
            {loading ? '重置中...' : '重置密码并登录'}
          </button>
        </div>
      )}

    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}
