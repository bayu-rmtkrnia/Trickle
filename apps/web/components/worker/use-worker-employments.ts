'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, isApiError } from '@/lib/api/errors'
import { listMyEmployments, type EmploymentPage } from '@/lib/api/worker'
import type { SessionContextValue } from '@/providers/session-provider'

export function useWorkerEmployments(session: SessionContextValue) {
  const currentSession = useRef(session)
  const request = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const [page, setPage] = useState<EmploymentPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [pageError, setPageError] = useState<unknown>(null)
  const [retryUntil, setRetryUntil] = useState(0)
  useEffect(() => {
    currentSession.current = session
  }, [session])

  const load = useCallback(async (cursor?: string) => {
    if (busy.current) return
    busy.current = true
    const controller = new AbortController()
    request.current = controller
    const api = currentSession.current
    if (cursor) {
      setLoadingMore(true)
      setPageError(null)
    } else {
      setLoading(true)
      setError(null)
      setPage(null)
    }
    try {
      const get = async () => {
        const token = await api.ensureSession()
        if (controller.signal.aborted) return null
        if (!token) throw new ApiError('unauthorized', 'Sesi tidak tersedia', { status: 401 })
        return listMyEmployments(token, cursor, { signal: controller.signal })
      }
      let result: EmploymentPage | null
      try {
        result = await get()
      } catch (problem) {
        if (controller.signal.aborted || !isApiError(problem) || problem.status !== 401)
          throw problem
        await api.refreshMe()
        result = await get()
      }
      if (controller.signal.aborted || !result) return
      if (cursor && result.nextCursor === cursor)
        throw new ApiError('server', 'Cursor tidak berubah', { code: 'INVALID_RESPONSE' })
      setPage((previous) => ({
        data: cursor
          ? [
              ...new Map(
                [...(previous?.data ?? []), ...result.data].map((row) => [row.id, row]),
              ).values(),
            ]
          : result.data,
        nextCursor: result.nextCursor,
      }))
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
  }, [])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void load()
    })
    return () => {
      active = false
      request.current?.abort()
      busy.current = false
    }
  }, [load])
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
    retryUntil,
    reload: () => {
      if (retryUntil <= Date.now()) void load()
    },
    loadMore: () => {
      if (page?.nextCursor && retryUntil <= Date.now()) void load(page.nextCursor)
    },
  }
}
