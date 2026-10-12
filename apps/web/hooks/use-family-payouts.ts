'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, isApiError } from '@/lib/api/errors'
import { getPayout, listPayouts, type PayoutDto, type PayoutPage } from '@/lib/api/payouts'
import type { SessionContextValue } from '@/providers/session-provider'

export const PAYOUT_POLL_MS = 5000
const ACTIVE = ['PENDING', 'PROCESSING']
export const isActivePayout = (payout: PayoutDto) => ACTIVE.includes(payout.status)

const unauthorized = () => new ApiError('unauthorized', 'Sesi tidak tersedia', { status: 401 })

const terminal = (payout: PayoutDto) => !isActivePayout(payout)
/**
 * Picks the newer view of one payout. A final status is never replaced by an
 * in-flight one (an older list snapshot must not undo a polled COMPLETED);
 * otherwise the later `updatedAt` wins, ties going to the incoming row.
 */
function fresher(current: PayoutDto, incoming: PayoutDto) {
  if (terminal(current) && !terminal(incoming)) return current
  if (terminal(incoming) && !terminal(current)) return incoming
  return Date.parse(incoming.updatedAt) >= Date.parse(current.updatedAt) ? incoming : current
}

/** Merges by id keeping the fresher row; `prepend` puts new ids first. */
function merge(rows: PayoutDto[], incoming: PayoutDto[], prepend = false) {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const added: PayoutDto[] = []
  for (const row of incoming) {
    const existing = byId.get(row.id)
    if (existing) byId.set(row.id, fresher(existing, row))
    else {
      byId.set(row.id, row)
      added.push(row)
    }
  }
  const kept = rows.map((row) => byId.get(row.id)!)
  return prepend ? [...added, ...kept] : [...kept, ...added]
}

/**
 * Payout history of the signed-in recipient, plus polling of in-flight
 * payouts. Status comes only from the backend DTO: a failed poll keeps the
 * last known status instead of turning it into FAILED. Mount per account.
 */
export function useFamilyPayouts(session: SessionContextValue) {
  const currentSession = useRef(session)
  const active = useRef(true)
  const busy = useRef(false)
  const request = useRef<AbortController | null>(null)
  const [page, setPage] = useState<PayoutPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [pageError, setPageError] = useState<unknown>(null)
  const [pollError, setPollError] = useState<unknown>(null)
  const [retryUntil, setRetryUntil] = useState(0)
  const rows = useRef<PayoutDto[]>([])
  /** Payouts registered in this tab; kept even if an older list misses them. */
  const local = useRef(new Map<string, PayoutDto>())
  useEffect(() => {
    currentSession.current = session
  }, [session])
  useEffect(() => {
    rows.current = page?.data ?? []
  }, [page])

  /** Calls `fn` with a session token, recovering a 401 once via profile refresh. */
  const withToken = useCallback(async <T>(fn: (token: string) => Promise<T>) => {
    const api = currentSession.current
    const token = await api.ensureSession()
    if (!token) throw unauthorized()
    try {
      return await fn(token)
    } catch (problem) {
      if (!isApiError(problem) || problem.status !== 401) throw problem
      await api.refreshMe()
      const renewed = await api.ensureSession()
      if (!renewed) throw unauthorized()
      return fn(renewed)
    }
  }, [])

  const load = useCallback(
    async (cursor?: string) => {
      if (busy.current) return
      busy.current = true
      const controller = new AbortController()
      request.current = controller
      if (cursor) {
        setLoadingMore(true)
        setPageError(null)
      } else {
        setLoading(true)
        setError(null)
      }
      try {
        const result = await withToken((token) =>
          listPayouts(token, cursor, { signal: controller.signal }),
        )
        if (controller.signal.aborted) return
        if (cursor && result.nextCursor === cursor)
          throw new ApiError('server', 'Cursor tidak berubah', { code: 'INVALID_RESPONSE' })
        setPage((previous) => {
          if (cursor)
            return { data: merge(previous?.data ?? [], result.data), nextCursor: result.nextCursor }
          // A first page replaces the list, but never drops a payout this tab
          // registered or regresses a row that polling already moved forward.
          const known = new Map((previous?.data ?? []).map((row) => [row.id, row]))
          const fromServer = result.data.map((row) => {
            const seen = known.get(row.id)
            return seen ? fresher(seen, row) : row
          })
          const missing = [...local.current.values()]
            .filter((row) => !fromServer.some((item) => item.id === row.id))
            .map((row) => known.get(row.id) ?? row)
          return { data: [...missing, ...fromServer], nextCursor: result.nextCursor }
        })
      } catch (problem) {
        if (controller.signal.aborted) return
        if (isApiError(problem) && problem.status === 429)
          setRetryUntil(Date.now() + (problem.retryAfterMs ?? 1000))
        if (cursor) setPageError(problem)
        else setError(problem)
      } finally {
        if (!controller.signal.aborted) {
          busy.current = false
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [withToken],
  )

  useEffect(() => {
    active.current = true
    queueMicrotask(() => {
      if (active.current) void load()
    })
    return () => {
      active.current = false
      request.current?.abort()
      busy.current = false
    }
  }, [load])

  const hasActive = (page?.data ?? []).some(isActivePayout)
  useEffect(() => {
    if (!hasActive) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | null = null
    let pausedUntil = 0
    async function poll() {
      if (stopped || document.visibilityState === 'hidden') return
      const wait = pausedUntil - Date.now()
      if (wait > 0) return schedule(wait)
      controller = new AbortController()
      const signal = controller.signal
      for (const row of rows.current.filter(isActivePayout)) {
        if (stopped || signal.aborted) return
        try {
          const latest = await withToken((token) => getPayout(row.id, token, { signal }))
          if (stopped || signal.aborted) return
          // Only accept the payout we asked for.
          if (latest.id !== row.id || latest.sourceTxHash !== row.sourceTxHash) continue
          setPage((previous) =>
            previous ? { ...previous, data: merge(previous.data, [latest]) } : previous,
          )
          setPollError(null)
        } catch (problem) {
          if (stopped || signal.aborted) return
          setPollError(problem)
          if (isApiError(problem) && problem.status === 429) {
            pausedUntil = Date.now() + (problem.retryAfterMs ?? PAYOUT_POLL_MS)
            break
          }
          // 401 after one recovery: stop instead of looping on a dead session.
          if (isApiError(problem) && problem.status === 401) {
            stopped = true
            return
          }
        }
      }
      schedule(PAYOUT_POLL_MS)
    }
    function schedule(delay: number) {
      if (stopped) return
      clearTimeout(timer)
      timer = setTimeout(() => void poll(), Math.max(delay, 0))
    }
    const visible = () => {
      if (document.visibilityState === 'visible') schedule(0)
      else {
        clearTimeout(timer)
        controller?.abort()
      }
    }
    schedule(PAYOUT_POLL_MS)
    document.addEventListener('visibilitychange', visible)
    return () => {
      stopped = true
      clearTimeout(timer)
      controller?.abort()
      document.removeEventListener('visibilitychange', visible)
    }
  }, [hasActive, withToken])

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

  return {
    page,
    loading,
    loadingMore,
    error,
    pageError,
    pollError,
    retryUntil,
    reload: () => {
      if (retryUntil <= Date.now()) void load()
    },
    loadMore: () => {
      if (page?.nextCursor && retryUntil <= Date.now()) void load(page.nextCursor)
    },
    /** Adds a payout just registered by the transfer flow so it is polled too. */
    track: useCallback((payout: PayoutDto) => {
      if (!active.current) return
      local.current.set(payout.id, payout)
      setPage((previous) => ({
        data: merge(previous?.data ?? [], [payout], true),
        nextCursor: previous?.nextCursor ?? null,
      }))
    }, []),
    find: (id: string | undefined) => page?.data.find((row) => row.id === id) ?? null,
  }
}

export type FamilyPayoutsState = ReturnType<typeof useFamilyPayouts>
