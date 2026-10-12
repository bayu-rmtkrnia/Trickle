'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useAccount } from '@/lib/account'
import {
  connectSessionSource,
  connectedSessionKey,
  subscribeSessionSource,
} from '@/lib/api/session'
import { useSession } from '@/providers/session-provider'

export type ApiSessionStatus = 'unconfigured' | 'loading' | 'signed-out' | 'error' | 'ready'

/**
 * Menyambungkan sesi aplikasi (SessionCoordinator lewat `useSession`) ke API area
 * perusahaan. `ready` baru muncul setelah sumber sesi terpasang untuk user yang
 * sama, jadi komponen di bawahnya aman langsung memanggil API saat mount.
 */
export function useApiSession() {
  const account = useAccount()
  const session = useSession()
  const key = session.status === 'ready' ? (session.user?.id ?? null) : null

  // Fungsi sesi terbaru, tanpa memasang ulang sumber setiap render.
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  })

  useEffect(() => {
    connectSessionSource(
      key
        ? {
            key,
            getToken: () => sessionRef.current.ensureSession(),
            recover: () => sessionRef.current.refreshMe(),
          }
        : null,
    )
  }, [key])

  const connected = useSyncExternalStore(subscribeSessionSource, connectedSessionKey, () => null)

  const status: ApiSessionStatus =
    session.status === 'unconfigured'
      ? 'unconfigured'
      : session.status === 'signed-out'
        ? 'signed-out'
        : session.status === 'error'
          ? 'error'
          : session.status === 'ready' && key && connected === key
            ? 'ready'
            : 'loading'

  return {
    status,
    error: session.error,
    login: account.login,
    /** Coba lagi setelah error (mis. akun baru yang belum siap). */
    retry: () => session.ensureSession().catch(() => undefined),
    logout: session.logout,
  }
}
