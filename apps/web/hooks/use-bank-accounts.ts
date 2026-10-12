'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createBankAccount,
  deleteBankAccount,
  listBankAccounts,
  updateBankAccount,
  type BankAccountDto,
  type BankAccountPage,
  type CreateBankAccountInput,
  type UpdateBankAccountInput,
} from '@/lib/api/bank-accounts'
import { ApiError, isApiError } from '@/lib/api/errors'
import type { SessionContextValue } from '@/providers/session-provider'

const unauthorized = () => new ApiError('unauthorized', 'Sesi tidak tersedia', { status: 401 })

/**
 * Bank accounts of the signed-in recipient. Mount it with a key per account so
 * a switch starts from an empty list. Reads may recover a 401 once; mutations
 * are never replayed automatically.
 */
export function useBankAccounts(session: SessionContextValue) {
  const currentSession = useRef(session)
  const request = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const active = useRef(true)
  const [page, setPage] = useState<BankAccountPage | null>(null)
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
    }
    try {
      const get = async () => {
        const token = await api.ensureSession()
        if (controller.signal.aborted) return null
        if (!token) throw unauthorized()
        return listBankAccounts(token, cursor, { signal: controller.signal })
      }
      let result: BankAccountPage | null
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

  async function token() {
    const value = await currentSession.current.ensureSession()
    if (!value) throw unauthorized()
    return value
  }
  function upsert(row: BankAccountDto, first: boolean) {
    if (!active.current) return
    setPage((previous) => {
      const rest = (previous?.data ?? []).filter((item) => item.id !== row.id)
      const replaced = previous?.data.some((item) => item.id === row.id)
      return {
        data: replaced
          ? (previous?.data ?? []).map((item) => (item.id === row.id ? row : item))
          : first
            ? [row, ...rest]
            : [...rest, row],
        nextCursor: previous?.nextCursor ?? null,
      }
    })
  }
  function drop(id: string) {
    if (!active.current) return
    setPage((previous) =>
      previous ? { ...previous, data: previous.data.filter((item) => item.id !== id) } : previous,
    )
  }

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
    /** A restored account comes back with its old id and replaces that row. */
    async create(input: CreateBankAccountInput) {
      const created = await createBankAccount(input, await token())
      upsert(created, true)
      return created
    },
    async update(id: string, input: UpdateBankAccountInput) {
      const updated = await updateBankAccount(id, input, await token())
      upsert(updated, false)
      return updated
    },
    async remove(id: string) {
      try {
        await deleteBankAccount(id, await token())
      } catch (problem) {
        // Already gone on the server: reflect that instead of keeping a stale row.
        if (isApiError(problem) && problem.status === 404) drop(id)
        throw problem
      }
      drop(id)
    },
    /** Drops a row the server no longer has (e.g. 404 while editing). */
    forget: drop,
  }
}

export type BankAccountsState = ReturnType<typeof useBankAccounts>
