'use client'

import { useEffect, useState } from 'react'

// ── Global dialog store (module-level, no context needed) ────────────────────

export type DialogKind = 'alert' | 'confirm' | 'prompt'

export interface DialogRequest {
  id: number
  kind: DialogKind
  title: string
  message?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  resolve: (value: boolean | string | null) => void
}

let listener: ((req: DialogRequest | null) => void) | null = null
let counter = 0

function open(req: Omit<DialogRequest, 'id' | 'resolve'>): Promise<boolean | string | null> {
  return new Promise(resolve => {
    const full: DialogRequest = { ...req, id: ++counter, resolve }
    if (listener) listener(full)
    else resolve(req.kind === 'confirm' ? false : null)
  })
}

/** 替代 window.alert */
export function showAlert(message: string, title = '提示'): Promise<void> {
  return open({ kind: 'alert', title, message, confirmText: '知道了' }).then(() => undefined)
}

/** 替代 window.confirm，返回 true/false */
export function showConfirm(
  message: string,
  opts: { title?: string; confirmText?: string; cancelText?: string; danger?: boolean } = {},
): Promise<boolean> {
  return open({
    kind: 'confirm',
    title: opts.title || '确认',
    message,
    confirmText: opts.confirmText || '确定',
    cancelText: opts.cancelText || '取消',
    danger: opts.danger,
  }).then(v => v === true)
}

/** 替代 window.prompt，返回输入字符串或 null（取消） */
export function showPrompt(
  message: string,
  opts: { title?: string; defaultValue?: string; confirmText?: string } = {},
): Promise<string | null> {
  return open({
    kind: 'prompt',
    title: opts.title || '输入',
    message,
    defaultValue: opts.defaultValue || '',
    confirmText: opts.confirmText || '确定',
    cancelText: '取消',
  }).then(v => (typeof v === 'string' ? v : null))
}

// ── Host component (mount once at app root) ──────────────────────────────────

export function DialogHost() {
  const [req, setReq] = useState<DialogRequest | null>(null)
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    listener = (r) => {
      setReq(r)
      if (r?.kind === 'prompt') setInputValue(r.defaultValue || '')
    }
    return () => { listener = null }
  }, [])

  if (!req) return null

  const finish = (value: boolean | string | null) => {
    req.resolve(value)
    setReq(null)
  }

  const onConfirm = () => {
    if (req.kind === 'prompt') finish(inputValue)
    else if (req.kind === 'confirm') finish(true)
    else finish(true)
  }
  const onCancel = () => {
    finish(req.kind === 'confirm' ? false : null)
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal">
        <h3>{req.title}</h3>
        {req.message && <p style={{ marginBottom: 16, whiteSpace: 'pre-wrap' }}>{req.message}</p>}
        {req.kind === 'prompt' && (
          <input
            className="input-field w-full"
            style={{ marginBottom: 16 }}
            value={inputValue}
            autoFocus
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onConfirm() }}
          />
        )}
        <div className="modal-footer">
          {req.kind !== 'alert' && (
            <button className="btn-outline" onClick={onCancel}>{req.cancelText || '取消'}</button>
          )}
          <button
            className="btn-accent"
            style={req.danger ? { background: 'var(--color-error)' } : undefined}
            onClick={onConfirm}
            autoFocus={req.kind !== 'prompt'}
          >
            {req.confirmText || '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}

