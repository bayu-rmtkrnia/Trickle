import type { PendingStore, PendingWithdrawal } from './withdrawal-coordinator'
import { payrollConfig as config } from './config'
import { WithdrawalError } from './payroll-writer'

const MAX_STASHED = 5

function parse(value: unknown): PendingWithdrawal {
  const v = value as Record<string, unknown> | null
  if (
    !v ||
    typeof v.streamId !== 'string' ||
    !/^[1-9]\d*$/.test(v.streamId) ||
    v.streamId.length > 78 ||
    (v.nonce !== undefined && (typeof v.nonce !== 'string' || !/^\d{1,78}$/.test(v.nonce))) ||
    (v.attemptId !== undefined &&
      (typeof v.attemptId !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(v.attemptId))) ||
    (v.hash !== null && (typeof v.hash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(v.hash))) ||
    (v.afterBlock !== undefined &&
      (typeof v.afterBlock !== 'string' || !/^\d{1,78}$/.test(v.afterBlock))) ||
    (v.leaseUntil !== undefined &&
      v.leaseUntil !== null &&
      (typeof v.leaseUntil !== 'string' || !/^\d{1,16}$/.test(v.leaseUntil)))
  )
    throw Error('Invalid pending record')
  return {
    streamId: v.streamId,
    hash: v.hash as PendingWithdrawal['hash'],
    ...(v.nonce !== undefined ? { nonce: v.nonce as string } : {}),
    ...(v.attemptId !== undefined ? { attemptId: v.attemptId as string } : {}),
    ...(v.afterBlock !== undefined ? { afterBlock: v.afterBlock as string } : {}),
    ...(v.leaseUntil !== undefined ? { leaseUntil: v.leaseUntil as string | null } : {}),
  }
}

export function withdrawalLockName(wallet: string) {
  return `trickle:withdraw-lock:${config.chainId}:${config.payrollAddress.toLowerCase()}:${wallet.toLowerCase()}`
}

export function pendingWithdrawalStore(wallet: string): PendingStore {
  const key = `trickle:withdraw:${config.chainId}:${config.payrollAddress.toLowerCase()}:${wallet.toLowerCase()}`
  const stashKey = `${key}:stash`
  function readStash(): PendingWithdrawal[] {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(stashKey)
      if (raw === null) return []
      const list = JSON.parse(raw) as unknown
      if (!Array.isArray(list)) throw Error('Invalid stash')
      return list.map(parse)
    } catch {
      throw new WithdrawalError('STORAGE_UNAVAILABLE')
    }
  }
  function writeStash(list: PendingWithdrawal[]) {
    try {
      if (list.length === 0) window.localStorage.removeItem(stashKey)
      else window.localStorage.setItem(stashKey, JSON.stringify(list))
    } catch {
      throw new WithdrawalError('STORAGE_UNAVAILABLE')
    }
  }
  return {
    read() {
      if (typeof window === 'undefined') return null
      try {
        const raw = window.localStorage.getItem(key)
        if (raw === null) return null
        return parse(JSON.parse(raw))
      } catch {
        throw new WithdrawalError('STORAGE_UNAVAILABLE')
      }
    },
    write(value) {
      try {
        if (value === null) window.localStorage.removeItem(key)
        else window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        throw new WithdrawalError('STORAGE_UNAVAILABLE')
      }
    },
    stash(value) {
      const list = readStash().filter(
        (item) => !(item.attemptId && item.attemptId === value.attemptId),
      )
      // Signed records are kept first; never drop one to make room.
      const next = [...list, value].sort((a, b) => Number(!a.hash) - Number(!b.hash))
      if (next.length > MAX_STASHED && !next[MAX_STASHED]!.hash) next.length = MAX_STASHED
      writeStash(next)
    },
    takeStashed() {
      const list = readStash()
      const first = list.shift() ?? null
      if (first) writeStash(list)
      return first
    },
  }
}
