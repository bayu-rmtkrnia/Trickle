'use client'

import { useEffect, useRef, useState } from 'react'
import { getUsdIdr, type FxQuoteDto } from '@/lib/api/fx'

export interface UsdIdrState {
  quote: FxQuoteDto | null
  error: unknown
  loading: boolean
  refresh(): void
}
type Record = { identity: string; quote: FxQuoteDto | null; error: unknown; loading: boolean }

/**
 * Loads the USD→IDR display rate with the Trickle session. A failure never
 * blocks the token balance; the caller shows rupiah as unavailable.
 */
export function useUsdIdr(
  identity: string | null,
  ensureSession: () => Promise<string | null>,
): UsdIdrState {
  const [record, setRecord] = useState<Record | null>(null)
  const [reload, setReload] = useState(0)
  const session = useRef(ensureSession)
  useEffect(() => {
    session.current = ensureSession
  })
  useEffect(() => {
    if (!identity) return
    const controller = new AbortController()
    async function load() {
      setRecord((previous) =>
        previous?.identity === identity
          ? { ...previous, loading: true }
          : { identity: identity!, quote: null, error: null, loading: true },
      )
      try {
        const token = await session.current()
        if (controller.signal.aborted) return
        if (!token) throw new Error('Session unavailable')
        const quote = await getUsdIdr(token, { signal: controller.signal })
        if (controller.signal.aborted) return
        setRecord({ identity: identity!, quote, error: null, loading: false })
      } catch (error) {
        if (controller.signal.aborted) return
        setRecord((previous) => ({
          identity: identity!,
          quote: previous?.identity === identity ? previous.quote : null,
          error,
          loading: false,
        }))
      }
    }
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load()
    })
    return () => controller.abort()
  }, [identity, reload])
  const current = record?.identity === identity ? record : null
  return {
    quote: current?.quote ?? null,
    error: current?.error ?? null,
    loading: identity ? (current?.loading ?? true) : false,
    refresh: () => setReload((value) => value + 1),
  }
}
