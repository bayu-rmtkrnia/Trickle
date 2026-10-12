'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useAccount } from '@/lib/account'
import { configureSession, configuredAccount, subscribeSession } from '@/lib/api/session'

export type ApiSessionStatus = 'unconfigured' | 'loading' | 'signed-out' | 'ready'

/**
 * Menyambungkan login Privy (`useAccount`) ke sesi API. `ready` baru muncul
 * setelah sesi dikonfigurasi untuk akun yang sama, jadi komponen di bawahnya
 * aman langsung memanggil API saat mount.
 */
export function useApiSession() {
  const account = useAccount()
  const key = account.ready && account.authenticated ? (account.user?.id ?? null) : null

  const getTokenRef = useRef(account.getAccessToken)
  useEffect(() => {
    getTokenRef.current = account.getAccessToken
  })

  useEffect(() => {
    configureSession(key ? () => getTokenRef.current() : null, key)
  }, [key])

  const current = useSyncExternalStore(subscribeSession, configuredAccount, () => null)

  const status: ApiSessionStatus = !account.configured
    ? 'unconfigured'
    : !account.ready
      ? 'loading'
      : !account.authenticated
        ? 'signed-out'
        : key && current === key
          ? 'ready'
          : 'loading'

  return { status, login: account.login }
}
