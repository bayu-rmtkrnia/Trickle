import type { PendingStore } from './withdrawal-coordinator'
import { payrollConfig as config } from './config'
import { WithdrawalError } from './payroll-writer'
export function pendingWithdrawalStore(wallet: string): PendingStore {
  const key = `trickle:withdraw:${config.chainId}:${config.payrollAddress.toLowerCase()}:${wallet.toLowerCase()}`
  return {
    read() {
      if (typeof window === 'undefined') return null
      try {
        const raw = window.localStorage.getItem(key)
        if (raw === null) return null
        const value = JSON.parse(raw)
        if (
          !value ||
          typeof value.streamId !== 'string' ||
          !/^[1-9]\d*$/.test(value.streamId) ||
          value.streamId.length > 78 ||
          (value.nonce !== undefined &&
            (typeof value.nonce !== 'string' || !/^\d{1,78}$/.test(value.nonce))) ||
          (value.attemptId !== undefined &&
            (typeof value.attemptId !== 'string' ||
              !/^[A-Za-z0-9-]{1,64}$/.test(value.attemptId))) ||
          (value.hash !== null &&
            (typeof value.hash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(value.hash))) ||
          (value.afterBlock !== undefined &&
            (typeof value.afterBlock !== 'string' || !/^\d{1,78}$/.test(value.afterBlock)))
        )
          throw Error('Invalid pending record')
        return {
          streamId: value.streamId,
          hash: value.hash,
          ...(value.nonce !== undefined ? { nonce: value.nonce } : {}),
          ...(value.attemptId !== undefined ? { attemptId: value.attemptId } : {}),
          ...(value.afterBlock !== undefined ? { afterBlock: value.afterBlock } : {}),
        }
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
  }
}
