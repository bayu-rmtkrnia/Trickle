import { WithdrawalError } from './payroll-writer'
import type { WithdrawalLock } from './withdrawal-coordinator'

/**
 * Cross-tab lock from the Web Locks API, which grants a name to at most one
 * holder across every tab of the origin and releases it when a tab closes.
 * Without it there is no atomic way to claim the signing step, so the
 * withdrawal is refused instead of risking two wallet prompts.
 */
export function createWebLock(name: string): WithdrawalLock {
  return async (run) => {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
    if (!locks) throw new WithdrawalError('LOCK_UNAVAILABLE')
    let outcome: Awaited<ReturnType<WithdrawalLock>> = { acquired: false }
    await locks.request(name, { ifAvailable: true }, async (lock) => {
      if (!lock) return
      outcome = { acquired: true, value: await run() }
    })
    return outcome as never
  }
}
