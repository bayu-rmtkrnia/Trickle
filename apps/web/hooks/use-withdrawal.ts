'use client'
import { useEffect, useState, useRef, useSyncExternalStore } from 'react'
import { getAddress, isAddress, type Hex } from 'viem'
import { useAccount } from '@/lib/account'
import { useSession } from '@/providers/session-provider'
import { requestGas } from '@/lib/api/gas'
import { createPayrollWriter, WithdrawalError } from '@/lib/chain/payroll-writer'
import { createWithdrawalPort } from '@/lib/chain/withdrawal-port'
import { WithdrawalCoordinator, type WithdrawalState } from '@/lib/chain/withdrawal-coordinator'
import { pendingWithdrawalStore } from '@/lib/chain/withdraw-storage'
const idle: WithdrawalState = {
  phase: 'idle',
  streamId: null,
  hash: null,
  result: null,
  error: null,
  checking: false,
}
export function useWithdrawal(
  address: string | null,
  onSuccess: () => void,
  onSigning?: () => void | Promise<void>,
) {
  const account = useAccount(),
    session = useSession()
  const wallet = address && isAddress(address) ? getAddress(address) : null
  const latest = useRef({ account, session, onSuccess, onSigning })
  const owner = account.user?.id,
    backendUser = session.user?.id
  const identity = wallet ? `${wallet}:${owner ?? ''}:${backendUser ?? ''}` : null
  const [record, setRecord] = useState<{
    identity: string
    coordinator: WithdrawalCoordinator
  } | null>(null)
  useEffect(() => {
    latest.current = { account, session, onSuccess, onSigning }
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
    const writer = createPayrollWriter(
      createWithdrawalPort(async (worker, signal) => {
        if (!current()) throw new WithdrawalError('WALLET_CHANGED')
        const token = await latest.current.session.ensureSession()
        if (!token || !current()) throw new WithdrawalError('WALLET_CHANGED')
        return requestGas(token, worker, { signal })
      }, abort.signal),
    )
    const coordinator = new WithdrawalCoordinator({
      worker: wallet,
      writer,
      get signal() {
        return abort.signal
      },
      store: pendingWithdrawalStore(wallet),
      isCurrent: current,
      submissionNonce: () => writer.submissionNonce(wallet),
      verifyAbandoned: (pending) =>
        writer.canAbandon(wallet, BigInt(pending.nonce!), BigInt(pending.afterBlock!)),
      send: async (request) => {
        if (!current()) throw new WithdrawalError('WALLET_CHANGED')
        await latest.current.onSigning?.()
        if (!current()) throw new WithdrawalError('WALLET_CHANGED')
        return latest.current.account.sendTransaction(request)
      },
      onSuccess: () => latest.current.onSuccess(),
    })
    queueMicrotask(() => {
      if (!active) return
      setRecord({ identity, coordinator })
      if (coordinator.getSnapshot().hash) void coordinator.resume()
    })
    return () => {
      active = false
      abort.abort()
    }
  }, [wallet, identity, owner, backendUser])
  const coordinator = record?.identity === identity ? record?.coordinator : null
  const state = useSyncExternalStore(
    coordinator?.subscribe ?? (() => () => {}),
    coordinator?.getSnapshot ?? (() => idle),
    () => idle,
  )
  return {
    state,
    ready: !!coordinator,
    choose: () => coordinator?.choose(),
    select: (id: bigint) => coordinator?.select(id),
    submit: () => {
      void coordinator?.submit()
    },
    resume: (hash?: Hex) => {
      void coordinator?.resume(hash)
    },
    abandon: () => {
      void coordinator?.abandon()
    },
  }
}
