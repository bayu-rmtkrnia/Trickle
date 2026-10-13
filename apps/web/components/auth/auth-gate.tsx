'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { isMockMode } from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-error-message'
import { authCopy } from '@/lib/copy/auth'
import { useDict, useLocale } from '@/lib/i18n/client'
import { useApiSession } from '@/lib/use-api-session'

/**
 * Menampilkan `children` hanya setelah user login dan sesi API siap.
 * Saat pratinjau mock (`?state=`) login dilewati.
 */
export function AuthGate({
  children,
  loading,
  frame = (node) => node,
  mock = false,
}: {
  children: ReactNode
  /** Tampilan saat menunggu (mis. skeleton halaman). */
  loading: ReactNode
  /** Bingkai halaman (header, padding) untuk pesan login/error. */
  frame?: (node: ReactNode) => ReactNode
  mock?: boolean
}) {
  const { status, error, login, retry, logout } = useApiSession()
  const { locale } = useLocale()
  const t = useDict(authCopy).auth
  const [loginFailed, setLoginFailed] = useState(false)

  if (mock || isMockMode()) return children

  switch (status) {
    case 'ready':
      return children
    case 'loading':
      return loading
    case 'error': {
      // Sesi gagal dibuat (mis. akun baru yang belum siap, atau server belum siap login).
      const { title, message } = apiErrorMessage(error, locale)
      return frame(
        <div className="flex flex-col gap-3">
          <InlineError
            title={title}
            message={message}
            action={{ label: t.retry, onClick: retry }}
          />
          <Button variant="text" onClick={() => void logout().catch(() => undefined)}>
            {t.signOut}
          </Button>
        </div>,
      )
    }
    case 'unconfigured':
      return frame(
        <InlineError
          title={t.unconfiguredTitle}
          message={t.unconfiguredMessage}
          action={{ label: t.toHome, href: '/' }}
        />,
      )
    case 'signed-out':
      return frame(
        <section className="flex flex-col gap-4 rounded-xl border-[1.5px] border-brand-text bg-surface p-6">
          <div>
            <h2 className="text-xl/7 font-bold">{t.signInTitle}</h2>
            <p className="mt-1 text-muted">{t.signInMessage}</p>
          </div>
          {loginFailed && <InlineError title={t.signInFailed} />}
          <Button
            block
            onClick={() => {
              setLoginFailed(false)
              try {
                login()
              } catch {
                setLoginFailed(true)
              }
            }}
          >
            {t.signIn}
          </Button>
        </section>,
      )
  }
}
