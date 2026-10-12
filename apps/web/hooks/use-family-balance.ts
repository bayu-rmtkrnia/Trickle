'use client'

import { useEffect, useRef, useState } from 'react'
import { getAddress, isAddress } from 'viem'
import { readFamilyBalance, type FamilyBalanceSnapshot } from '@/lib/chain/family-balance'
import { STALE_AFTER_MS } from '@/lib/chain/stream-math'

export const FAMILY_POLL_MS = 15000

export interface FamilyBalanceState {
  phase: 'unconfigured' | 'loading' | 'ready' | 'stale' | 'error'
  snapshot: FamilyBalanceSnapshot | null
  /** `Date.now()` of the read that produced `snapshot`. */
  readAt: number | null
  error: unknown
  refreshing: boolean
  refresh(): void
}
type Record = {
  wallet: string
  snapshot: FamilyBalanceSnapshot | null
  observedAt: number
  readAt: number | null
  error: unknown
  refreshing: boolean
}

/**
 * Polls `balanceOf(wallet)` every 15 seconds while the page is visible. The
 * balance only changes on transfers, so there is no per-second ticker; the
 * poll interval also advances the clock that marks data stale after 30 s.
 */
export function useFamilyBalance(address: string | null): FamilyBalanceState {
  const wallet = address && isAddress(address) ? getAddress(address) : null
  const [record, setRecord] = useState<Record | null>(null)
  const [clock, setClock] = useState(0)
  const retry = useRef<(() => void) | null>(null)
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
          : {
              wallet: wallet!,
              snapshot: null,
              observedAt,
              readAt: null,
              error: null,
              refreshing: true,
            },
      )
      try {
        const snapshot = await readFamilyBalance(wallet!, signal)
        if (!active || signal.aborted || rerun) return
        setClock(performance.now())
        setRecord({
          wallet: wallet!,
          snapshot,
          observedAt,
          readAt: Date.now(),
          error: null,
          refreshing: false,
        })
      } catch (error) {
        if (!active || signal.aborted || rerun) return
        setRecord((previous) => ({
          wallet: wallet!,
          snapshot: previous?.wallet === wallet ? previous.snapshot : null,
          observedAt: previous?.wallet === wallet ? previous.observedAt : observedAt,
          readAt: previous?.wallet === wallet ? previous.readAt : null,
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
      if (document.visibilityState !== 'hidden') setClock(performance.now())
      void refresh()
    }, FAMILY_POLL_MS)
    document.addEventListener('visibilitychange', visible)
    return () => {
      active = false
      retry.current = null
      controller?.abort()
      clearInterval(poll)
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
    readAt: current?.readAt ?? null,
    error: current?.error ?? null,
    refreshing: current?.refreshing ?? false,
    refresh: () => retry.current?.(),
  }
}
