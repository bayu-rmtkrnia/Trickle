'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, isApiError } from '@/lib/api/errors'
import {
  listIncomingTransfers,
  type IncomingTransferDto,
  type IncomingTransferPage,
} from '@/lib/api/incoming-transfers'
import type { SessionContextValue } from '@/providers/session-provider'

/** How often the first page is fetched again while the tab is visible. */
export const INCOMING_POLL_MS = 30000

const unauthorized = () => new ApiError('unauthorized', 'Sesi tidak tersedia', { status: 401 })

/** New ids first, then the rows already shown; a row is never listed twice. */
function prepend(rows: IncomingTransferDto[], fresh: IncomingTransferDto[]) {
  const known = new Set(rows.map((row) => row.id))
  return [...fresh.filter((row) => !known.has(row.id)), ...rows]
}

/**
 * Transfers the signed-in family member received through salary splits.
 * The first page is fetched again every 30 s while the tab is visible, so a
 * worker's withdrawal shows up without a reload; a failed background refresh
 * keeps what is shown. Mount it with a key per account.
 */
export function useIncomingTransfers(session: SessionContextValue) {
  const currentSession = useRef(session)
  const busy = useRef(false)
  const request = useRef<AbortController | null>(null)
  const [page, setPage] = useState<IncomingTransferPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [pageError, setPageError] = useState<unknown>(null)
  useEffect(() => {
    currentSession.current = session
  }, [session])

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

  /** `mode`: first load, next page, or a quiet refresh of the first page. */
  const load = useCallback(
    async (mode: 'first' | 'more' | 'refresh', cursor?: string) => {
      if (busy.current) return
      busy.current = true
      const controller = new AbortController()
      request.current = controller
      if (mode === 'more') {
        setLoadingMore(true)
        setPageError(null)
      } else if (mode === 'first') {
        setLoading(true)
        setError(null)
      }
      try {
        const result = await withToken((token) =>
          listIncomingTransfers(token, cursor, { signal: controller.signal }),
        )
        if (controller.signal.aborted) return
        setPage((previous) => {
          if (mode === 'more')
            return {
              data: [
                ...(previous?.data ?? []),
                ...result.data.filter((row) => !previous?.data.some((seen) => seen.id === row.id)),
              ],
              nextCursor: result.nextCursor,
            }
          // A refresh only adds new rows on top, so pages already loaded stay.
          if (mode === 'refresh' && previous)
            return { ...previous, data: prepend(previous.data, result.data) }
          return result
        })
        if (mode === 'refresh') setError(null)
      } catch (problem) {
        if (controller.signal.aborted) return
        if (mode === 'more') setPageError(problem)
        else if (mode === 'first') setError(problem)
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
    let active = true
    queueMicrotask(() => {
      if (active) void load('first')
    })
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load('refresh')
    }, INCOMING_POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
      request.current?.abort()
      busy.current = false
    }
  }, [load])

  return {
    page,
    loading,
    loadingMore,
    error,
    pageError,
    reload: () => void load('first'),
    loadMore: () => {
      if (page?.nextCursor) void load('more', page.nextCursor)
    },
  }
}

export type IncomingTransfersState = ReturnType<typeof useIncomingTransfers>
