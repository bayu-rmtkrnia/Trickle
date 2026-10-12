'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getAddress, isAddress, type Hex } from 'viem'
import { getBankAccount } from '@/lib/api/bank-accounts'
import { ApiError } from '@/lib/api/errors'
import { requestGas } from '@/lib/api/gas'
import { createPayout } from '@/lib/api/payouts'
import { useAccount } from '@/lib/account'
import { payoutAddress } from '@/lib/chain/payout-config'
import { PayoutCoordinator, type FamilyPayoutState } from '@/lib/chain/payout-coordinator'
import { pendingPayoutStore } from '@/lib/chain/payout-storage'
import { createPayoutPort, createPayoutWriter, PayoutError } from '@/lib/chain/payout-writer'
import { useSession } from '@/providers/session-provider'

const idle: FamilyPayoutState = {
  phase: 'idle',
  amountUnits: null,
  bankAccountId: null,
  hash: null,
  payout: null,
  error: null,
  checking: false,
  unreadable: false,
}

/**
 * Family payout flow for the signed-in recipient wallet. One coordinator per
 * wallet + Privy user + backend user; it is dropped as soon as any of them
 * changes, and its callbacks refuse to act for a stale identity.
 */
export function useFamilyPayout(
  address: string | null,
  onTransferred: () => void,
  onSigning?: () => void | Promise<void>,
) {
  const account = useAccount()
  const session = useSession()
  const wallet = address && isAddress(address) ? getAddress(address) : null
  const latest = useRef({ account, session, onTransferred, onSigning })
  const owner = account.user?.id
  const backendUser = session.user?.id
  const identity = wallet ? `${wallet}:${owner ?? ''}:${backendUser ?? ''}` : null
  const [record, setRecord] = useState<{
    identity: string
    coordinator: PayoutCoordinator
  } | null>(null)
  useEffect(() => {
    latest.current = { account, session, onTransferred, onSigning }
  })
  useEffect(() => {
    if (!wallet || !identity) return
    let active = true
    const abort = new AbortController()
    const current = () =>
      active &&
      latest.current.account.authenticated &&
      latest.current.account.user?.id === owner &&
      latest.current.session.status === 'ready' &&
      latest.current.session.user?.id === backendUser &&
      latest.current.account.walletAddress?.toLowerCase() === wallet.toLowerCase() &&
      latest.current.session.user?.address.toLowerCase() === wallet.toLowerCase()
    const token = async () => {
      if (!current()) throw new PayoutError('WALLET_CHANGED')
      const value = await latest.current.session.ensureSession()
      if (!value || !current())
        throw new ApiError('unauthorized', 'Sesi tidak tersedia', { status: 401 })
      return value
    }
    const writer = createPayoutWriter(
      createPayoutPort(
        async (target, signal) => requestGas(await token(), target, { signal }),
        abort.signal,
      ),
    )
    const coordinator = new PayoutCoordinator({
      wallet,
      destination: payoutAddress,
      writer,
      store: pendingPayoutStore(wallet),
      isCurrent: current,
      get signal() {
        return abort.signal
      },
      checkReady: async (bankAccountId, signal) => {
        const me = await latest.current.session.refreshMe()
        if (!current() || !me?.roles.recipient) throw new PayoutError('NOT_RECIPIENT')
        await getBankAccount(bankAccountId, await token(), { signal })
      },
      register: async (input) => createPayout(input, await token()),
      send: async (request) => {
        if (!current()) throw new PayoutError('WALLET_CHANGED')
        await latest.current.onSigning?.()
        if (!current()) throw new PayoutError('WALLET_CHANGED')
        return latest.current.account.sendTransaction(request)
      },
      onTransferred: () => latest.current.onTransferred(),
    })
    queueMicrotask(() => {
      if (!active) return
      setRecord({ identity, coordinator })
      // A stored hash is checked right away; it never triggers a new transfer.
      if (coordinator.getSnapshot().phase === 'transfer-pending') void coordinator.resume()
    })
    return () => {
      active = false
      abort.abort()
    }
  }, [wallet, identity, owner, backendUser])
  const coordinator = record?.identity === identity ? record.coordinator : null
  const state = useSyncExternalStore(
    coordinator?.subscribe ?? (() => () => {}),
    coordinator?.getSnapshot ?? (() => idle),
    () => idle,
  )
  return {
    state,
    ready: !!coordinator,
    configured: payoutAddress !== null,
    destination: payoutAddress,
    start: () => coordinator?.start(),
    cancel: () => coordinator?.cancel(),
    submit: (input: { amountUnits: bigint; bankAccountId: string }) => {
      void coordinator?.submit(input)
    },
    resume: (hash?: Hex) => {
      void coordinator?.resume(hash)
    },
    retryRegistration: () => {
      void coordinator?.retryRegistration()
    },
    changeBank: (id: string) => {
      void coordinator?.changeBank(id)
    },
    abandon: () => {
      void coordinator?.abandon()
    },
    dismiss: () => coordinator?.dismiss(),
    discardUnreadable: (confirmed: boolean) => coordinator?.discardUnreadable(confirmed),
  }
}

export type FamilyPayout = ReturnType<typeof useFamilyPayout>
