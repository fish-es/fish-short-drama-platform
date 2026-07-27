'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface ConfirmOptions {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setState({
        options: {
          title: '确认',
          message: '',
          confirmText: '确认',
          cancelText: '取消',
          danger: false,
          ...options,
        },
        resolve,
      })
    })
  }, [])

  const handleConfirm = () => {
    state?.resolve(true)
    setState(null)
  }

  const handleCancel = () => {
    state?.resolve(false)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) handleCancel() }}>
          <div className="modal animate-enter-scale">
            <h3>{state.options.title}</h3>
            {state.options.message && <p>{state.options.message}</p>}
            <div className="modal-footer">
              <button className="btn-outline" onClick={handleCancel}>
                {state.options.cancelText}
              </button>
              <button
                className={state.options.danger ? 'btn-danger-filled' : 'btn-accent'}
                onClick={handleConfirm}
              >
                {state.options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
