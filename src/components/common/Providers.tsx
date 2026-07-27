'use client'

import { type ReactNode } from 'react'
import { ToastProvider } from '@/components/common/Toast'
import { ConfirmProvider } from '@/components/common/ConfirmModal'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {children}
      </ConfirmProvider>
    </ToastProvider>
  )
}
