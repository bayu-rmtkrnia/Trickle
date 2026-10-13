'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from '@/lib/account'
import { ApiError, isApiError } from '@/lib/api/errors'
import { acceptInvitation, getInvitation } from '@/lib/api/invitations'
import type { Invite } from '@/lib/api/types'
import { invitationCopy } from '@/lib/copy/worker'
import { useDict } from '@/lib/i18n/client'
import { useSession } from '@/providers/session-provider'

type Phase = 'idle' | 'accepting' | 'refreshing' | 'refresh-error' | 'unknown'

export function useWorkerInvitation(code: string) {
  const t = useDict(invitationCopy)
  const account = useAccount()
  const session = useSession()
  const router = useRouter()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [loading, setLoading] = useState(true)
  const [lookupError, setLookupError] = useState<unknown>(null)
  const [actionError, setActionError] = useState<unknown>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [acceptedIdentity, setAcceptedIdentity] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [retryUntil, setRetryUntil] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const busy = useRef(false)
  const active = useRef(true)
  const generation = useRef(0)
  const identity = account.user?.id ?? null

  useEffect(() => {
    generation.current += 1
  }, [identity])

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      generation.current += 1
    }
  }, [])

  useEffect(() => {
    const abort = new AbortController()
    void getInvitation(code, abort.signal).then(
      (data) => {
        if (abort.signal.aborted) return
        setInvite(data)
        setLoading(false)
      },
      (error: unknown) => {
        if (abort.signal.aborted) return
        setLookupError(error)
        if (isApiError(error) && error.status === 429) {
          setRetryUntil(Date.now() + (error.retryAfterMs ?? 1000))
        }
        setLoading(false)
      },
    )
    return () => abort.abort()
  }, [code, reload])

  useEffect(() => {
    if (!retryUntil) return
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const remaining = retryUntil - Date.now()
      if (remaining <= 0) setRetryUntil(0)
      else timer = setTimeout(tick, Math.min(remaining, 2_147_483_647))
    }
    tick()
    return () => clearTimeout(timer)
  }, [retryUntil])

  function reloadInvitation() {
    if (busy.current || retryUntil > Date.now()) return
    setLoading(true)
    setLookupError(null)
    setActionError(null)
    setPhase('idle')
    setReload((value) => value + 1)
  }

  function login() {
    setActionError(null)
    try {
      account.login()
    } catch {
      setActionError(new ApiError('configuration', t.errors.login.title, { code: 'LOGIN_FAILED' }))
    }
  }

  async function logout() {
    if (busy.current) return
    setLoggingOut(true)
    setActionError(null)
    try {
      await session.logout()
    } catch {
      if (active.current)
        setActionError(new ApiError('network', t.errors.logout.title, { code: 'LOGOUT_FAILED' }))
    } finally {
      if (active.current) setLoggingOut(false)
    }
  }

  function current(version: number) {
    return active.current && generation.current === version
  }

  async function refreshAccepted(version: number) {
    try {
      const me = await session.refreshMe()
      if (!current(version)) return
      if (!me?.roles.worker) throw new Error('Worker profile unavailable')
      router.replace('/w')
    } catch {
      if (current(version)) setPhase('refresh-error')
    }
  }

  async function retryProfile() {
    if (busy.current || !identity || identity !== acceptedIdentity) return
    const version = generation.current
    busy.current = true
    setPhase('refreshing')
    await refreshAccepted(version)
    busy.current = false
    if (active.current && !current(version)) setPhase('idle')
  }

  async function accept() {
    if (
      busy.current ||
      loggingOut ||
      retryUntil > Date.now() ||
      !identity ||
      !account.authenticated ||
      invite?.type !== 'WORKER' ||
      invite.status !== 'PENDING' ||
      (isApiError(actionError) && actionError.status === 401) ||
      phase === 'unknown'
    )
      return
    const version = generation.current
    busy.current = true
    setPhase('accepting')
    setActionError(null)
    try {
      const token = await session.ensureSession()
      if (!current(version)) return
      if (!token) throw new ApiError('unauthorized', t.errors.session.title, { status: 401 })
      const accepted = await acceptInvitation(code, token)
      if (!current(version)) return
      setInvite(accepted)
      setAcceptedIdentity(identity)
      setPhase('refreshing')
      await refreshAccepted(version)
    } catch (error) {
      if (!current(version)) return
      setActionError(error)
      if (isApiError(error) && error.status === 429) {
        setRetryUntil(Date.now() + (error.retryAfterMs ?? 1000))
      }
      // A transport/server failure may occur after the mutation committed.
      // Check the public resource, never automatically replay acceptance.
      if (!isApiError(error) || error.kind === 'network' || (error.status ?? 0) >= 500) {
        setPhase('unknown')
        try {
          const latest = await getInvitation(code)
          if (!current(version)) return
          setInvite(latest)
          setPhase('idle')
        } catch {
          /* Explicit public reload is available; acceptance stays blocked. */
        }
      } else setPhase('idle')
    } finally {
      busy.current = false
      if (active.current && !current(version)) setPhase('idle')
    }
  }

  async function recoverSession() {
    if (busy.current) return
    const version = generation.current
    busy.current = true
    setPhase('refreshing')
    try {
      if (isApiError(actionError) && actionError.status === 401) await session.refreshMe()
      else await session.ensureSession()
      if (current(version)) setActionError(null)
    } catch (error) {
      if (current(version)) setActionError(error)
    } finally {
      busy.current = false
      if (active.current) setPhase('idle')
    }
  }

  return {
    account,
    session,
    identity,
    invite,
    loading,
    lookupError,
    actionError,
    phase,
    acceptedIdentity,
    retryUntil,
    loggingOut,
    reloadInvitation,
    login,
    logout,
    retryProfile,
    accept,
    recoverSession,
  }
}
