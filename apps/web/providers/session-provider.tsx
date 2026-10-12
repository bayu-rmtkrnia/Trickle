'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { SessionCoordinator, defaultSessionApi, type SessionSnapshot } from '@/lib/api/session'
import type { Me } from '@/lib/api/worker-types'
import { useAccount } from '@/lib/account'

export interface SessionContextValue extends SessionSnapshot {
  ensureSession(): Promise<string | null>
  refreshMe(): Promise<Me | null>
  logout(): Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function TrickleSessionProvider({ children }: { children: ReactNode }) {
  const account = useAccount()
  const [coordinator] = useState(() => new SessionCoordinator(defaultSessionApi))

  const subscribe = useCallback(
    (listener: () => void) => coordinator.subscribe(listener),
    [coordinator],
  )
  const getSnapshot = useCallback(() => coordinator.getSnapshot(), [coordinator])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const identity = account.user?.id ?? null

  useEffect(() => {
    void coordinator.updateAccount({
      configured: account.configured,
      ready: account.ready,
      authenticated: account.authenticated,
      userId: identity,
      walletAddress: account.walletAddress,
      getAccessToken: account.getAccessToken,
    })
  }, [
    account.authenticated,
    account.configured,
    account.getAccessToken,
    account.ready,
    account.walletAddress,
    coordinator,
    identity,
  ])

  useEffect(() => {
    if (!snapshot.expiresAt) return
    let timer: ReturnType<typeof setTimeout>
    let cancelled = false
    const renew = () => {
      if (cancelled) return
      const remaining = Date.parse(snapshot.expiresAt!) - Date.now()
      if (remaining > 0) {
        timer = setTimeout(renew, Math.min(remaining, 2_147_483_647))
      } else {
        void coordinator.ensureSession().catch(() => undefined)
      }
    }
    renew()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [coordinator, snapshot.expiresAt])

  const value = useMemo<SessionContextValue>(
    () => ({
      ...snapshot,
      ensureSession: () => coordinator.ensureSession(),
      refreshMe: () => coordinator.refreshMe(),
      logout: () => coordinator.logout(account.logout),
    }),
    [account.logout, coordinator, snapshot],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used within TrickleSessionProvider')
  return session
}
