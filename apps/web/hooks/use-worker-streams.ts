'use client'

import { useEffect, useRef, useState } from 'react'
import { getAddress, isAddress } from 'viem'
import { ApiError, isApiError } from '@/lib/api/errors'
import { listAllMyStreamIds } from '@/lib/api/streams'
import { payrollReader } from '@/lib/chain/viem-port'
import { estimateTimestamp, STALE_AFTER_MS } from '@/lib/chain/stream-math'
import type { WorkerSnapshot } from '@/lib/chain/types'
import type { SessionContextValue } from '@/providers/session-provider'

export interface WorkerStreamState {
  phase: 'unconfigured' | 'loading' | 'ready' | 'stale' | 'error'
  snapshot: WorkerSnapshot | null
  timestamp: bigint | null
  error: unknown
  refreshing: boolean
  refresh(): void
}
type Record = {
  wallet: string
  snapshot: WorkerSnapshot | null
  observedAt: number
  error: unknown
  refreshing: boolean
}
export function useWorkerStreams(
  address: string | null,
  session?: Pick<SessionContextValue, 'ensureSession' | 'refreshMe'>,
): WorkerStreamState {
  const wallet = address && isAddress(address) ? getAddress(address) : null
  const indexed = session !== undefined
  const currentSession = useRef(session)
  const [record, setRecord] = useState<Record | null>(null)
  const [clock, setClock] = useState(0)
  const retry = useRef<(() => void) | null>(null)
  useEffect(() => {
    currentSession.current = session
  }, [session])
  useEffect(() => {
    if (!wallet) return
    let active = true,
      pending = false,
      rerun = false
    let controller: AbortController | null = null
    async function refresh() {
      if (!active || pending || document.visibilityState === 'hidden') return
      pending = true
      controller = new AbortController()
      const signal = controller.signal
      const observedAt = performance.now()
      setRecord((previous) =>
        previous?.wallet === wallet
          ? { ...previous, refreshing: true }
          : { wallet: wallet!, snapshot: null, observedAt, error: null, refreshing: true },
      )
      try {
        let snapshot: WorkerSnapshot
        const api = currentSession.current
        if (indexed && api) {
          const discover = async () => {
            const token = await api.ensureSession()
            if (signal.aborted) return null
            if (!token) throw new ApiError('unauthorized', 'Sesi tidak tersedia', { status: 401 })
            return listAllMyStreamIds(token, { signal })
          }
          let ids: bigint[] | null
          try {
            ids = await discover()
          } catch (problem) {
            if (signal.aborted || !isApiError(problem) || problem.status !== 401) throw problem
            await api.refreshMe()
            ids = await discover()
          }
          if (!ids || signal.aborted) return
          snapshot = await payrollReader.readWorkerSnapshotForIds(wallet!, ids, signal)
        } else {
          snapshot = await payrollReader.readWorkerSnapshot(wallet!, signal)
        }
        if (!active || signal.aborted || rerun) return
        setClock(performance.now())
        setRecord((previous) => ({
          wallet: wallet!,
          snapshot,
          observedAt:
            previous?.wallet === wallet &&
            previous.snapshot?.blockNumber === snapshot.blockNumber &&
            previous.snapshot?.blockHash === snapshot.blockHash
              ? previous.observedAt
              : observedAt,
          error: null,
          refreshing: false,
        }))
      } catch (error) {
        if (!active || signal.aborted || rerun) return
        setRecord((previous) => ({
          wallet: wallet!,
          snapshot: previous?.wallet === wallet ? previous.snapshot : null,
          observedAt: previous?.wallet === wallet ? previous.observedAt : observedAt,
          error,
          refreshing: false,
        }))
      } finally {
        pending = false
        if (active && rerun && document.visibilityState === 'visible') {
          rerun = false
          void refresh()
        }
      }
    }
    const visible = () => {
      if (document.visibilityState === 'visible') {
        setClock(performance.now())
        void refresh()
      }
    }
    retry.current = () => {
      if (pending) rerun = true
      else void refresh()
    }
    queueMicrotask(() => {
      if (active) void refresh()
    })
    const poll = setInterval(() => {
      void refresh()
    }, 15000)
    const ticker = setInterval(() => {
      if (document.visibilityState !== 'hidden') setClock(performance.now())
    }, 1000)
    document.addEventListener('visibilitychange', visible)
    return () => {
      active = false
      retry.current = null
      controller?.abort()
      clearInterval(poll)
      clearInterval(ticker)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [indexed, wallet])
  const current = record?.wallet === wallet ? record : null
  const snapshot = current?.snapshot ?? null
  const elapsed = current ? Math.max(0, clock - current.observedAt) : 0
  const stale = !!snapshot && (!!current?.error || elapsed >= STALE_AFTER_MS)
  return {
    phase: !wallet
      ? 'unconfigured'
      : snapshot
        ? stale
          ? 'stale'
          : 'ready'
        : current?.error
          ? 'error'
          : 'loading',
    snapshot,
    timestamp: snapshot
      ? stale
        ? snapshot.blockTimestamp
        : estimateTimestamp(snapshot.blockTimestamp, elapsed)
      : null,
    error: current?.error ?? null,
    refreshing: current?.refreshing ?? false,
    refresh: () => retry.current?.(),
  }
}
