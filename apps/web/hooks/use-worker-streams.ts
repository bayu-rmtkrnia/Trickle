'use client'

import { useEffect, useRef, useState } from 'react'
import { getAddress, isAddress } from 'viem'
import { payrollReader } from '@/lib/chain/viem-port'
import { estimateTimestamp, STALE_AFTER_MS } from '@/lib/chain/stream-math'
import type { WorkerSnapshot } from '@/lib/chain/types'

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
export function useWorkerStreams(address: string | null): WorkerStreamState {
  const wallet = address && isAddress(address) ? getAddress(address) : null
  const [record, setRecord] = useState<Record | null>(null)
  const [clock, setClock] = useState(0)
  const retry = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (!wallet) return
    let active = true,
      pending = false
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
        const snapshot = await payrollReader.readWorkerSnapshot(wallet!, signal)
        if (!active || signal.aborted) return
        setClock(performance.now())
        setRecord({ wallet: wallet!, snapshot, observedAt, error: null, refreshing: false })
      } catch (error) {
        if (!active || signal.aborted) return
        setRecord((previous) => ({
          wallet: wallet!,
          snapshot: previous?.wallet === wallet ? previous.snapshot : null,
          observedAt: previous?.wallet === wallet ? previous.observedAt : observedAt,
          error,
          refreshing: false,
        }))
      } finally {
        pending = false
      }
    }
    const visible = () => {
      if (document.visibilityState === 'visible') {
        setClock(performance.now())
        void refresh()
      }
    }
    retry.current = () => {
      void refresh()
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
  }, [wallet])
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
