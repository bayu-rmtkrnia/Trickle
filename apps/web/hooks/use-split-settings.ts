'use client'
import { useEffect, useRef, useState } from 'react'
import { getAddress, isAddress, type Hex } from 'viem'
import { requestGas } from '@/lib/api/gas'
import { useAccount } from '@/lib/account'
import { WithdrawalError } from '@/lib/chain/payroll-writer'
import type { Split } from '@/lib/chain/split'
import { createSplitPort, createSplitWriter } from '@/lib/chain/split-writer'
import { isRejected } from '@/lib/chain/withdrawal-coordinator'
import { useSession } from '@/providers/session-provider'

export type SplitPhase =
  'idle' | 'preparing' | 'signing' | 'pending' | 'success' | 'failed' | 'unknown'
export interface SplitState {
  phase: SplitPhase
  /** The list being saved; `[]` turns the split off. */
  splits: readonly Split[] | null
  hash: Hex | null
  error: unknown
}
const idle: SplitState = { phase: 'idle', splits: null, hash: null, error: null }

/**
 * Sends `setSplits` from the signed-in worker wallet. Only one save runs at a
 * time; a known hash is re-checked instead of signing again.
 */
export function useSplitSettings(
  address: string | null,
  onSuccess: () => void,
  onSigning?: () => void | Promise<void>,
) {
  const account = useAccount()
  const session = useSession()
  const wallet = address && isAddress(address) ? getAddress(address) : null
  const latest = useRef({ account, session, onSuccess, onSigning })
  const [state, setState] = useState<SplitState>(idle)
  const busy = useRef(false)
  const active = useRef(true)
  const owner = account.user?.id
  const backendUser = session.user?.id
  useEffect(() => {
    latest.current = { account, session, onSuccess, onSigning }
  })
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  // A different account never inherits another account's save state.
  const identity = `${wallet ?? ''}:${owner ?? ''}:${backendUser ?? ''}`
  const [stateIdentity, setStateIdentity] = useState(identity)
  if (stateIdentity !== identity) {
    setStateIdentity(identity)
    setState(idle)
  }

  function current() {
    const { account: a, session: s } = latest.current
    return (
      active.current &&
      !!wallet &&
      a.authenticated &&
      a.user?.id === owner &&
      s.status === 'ready' &&
      s.user?.id === backendUser &&
      a.walletAddress?.toLowerCase() === wallet.toLowerCase() &&
      s.user?.address.toLowerCase() === wallet.toLowerCase()
    )
  }
  function writer() {
    return createSplitWriter(
      createSplitPort(async (worker, signal) => {
        const token = await latest.current.session.ensureSession()
        if (!token || !current()) throw new WithdrawalError('WALLET_CHANGED')
        return requestGas(token, worker, { signal })
      }),
    )
  }
  function set(next: SplitState) {
    if (current()) setState(next)
  }

  async function settle(splits: readonly Split[], hash: Hex) {
    try {
      await writer().settle(wallet!, splits, hash)
      set({ phase: 'success', splits, hash, error: null })
      try {
        if (current()) latest.current.onSuccess()
      } catch {
        /* The split is saved even if the refresh fails. */
      }
    } catch (error) {
      const final =
        error instanceof WithdrawalError && ['REVERTED', 'REPLACED'].includes(error.code)
      set({ phase: final ? 'failed' : 'unknown', splits, hash, error })
    }
  }

  async function save(splits: readonly Split[]) {
    if (busy.current || !wallet || !current() || ['pending', 'unknown'].includes(state.phase))
      return
    busy.current = true
    setState({ phase: 'preparing', splits, hash: null, error: null })
    let sending = false
    try {
      const request = await writer().prepare(wallet, splits)
      if (!current()) return
      await latest.current.onSigning?.()
      if (!current()) throw new WithdrawalError('WALLET_CHANGED')
      sending = true
      set({ phase: 'signing', splits, hash: null, error: null })
      const { hash } = await latest.current.account.sendTransaction(request)
      if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new WithdrawalError('INVALID_HASH')
      set({ phase: 'pending', splits, hash, error: null })
      await settle(splits, hash)
    } catch (error) {
      // After the wallet was asked, an unclear failure may still have been sent.
      const unknown = sending && !isRejected(error)
      set({ phase: unknown ? 'unknown' : 'failed', splits, hash: null, error })
    } finally {
      busy.current = false
    }
  }

  async function recheck() {
    if (busy.current || state.phase !== 'unknown' || !state.hash || !state.splits || !current())
      return
    busy.current = true
    set({ ...state, phase: 'pending', error: null })
    try {
      await settle(state.splits, state.hash)
    } finally {
      busy.current = false
    }
  }

  return {
    state,
    ready: !!wallet,
    save: (splits: readonly Split[]) => void save(splits),
    recheck: () => void recheck(),
    reset: () => {
      if (!busy.current && !['pending', 'signing', 'preparing'].includes(state.phase))
        setState(idle)
    },
  }
}

export type SplitSettings = ReturnType<typeof useSplitSettings>
