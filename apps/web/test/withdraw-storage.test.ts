// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { pendingWithdrawalStore } from '@/lib/chain/withdraw-storage'
const worker = '0x2222222222222222222222222222222222222222' as const
const other = '0x3333333333333333333333333333333333333333' as const
const hash = `0x${'a'.repeat(64)}` as const
beforeEach(() => localStorage.clear())
describe('pending withdrawal storage', () => {
  it('isolates pending transactions by wallet and preserves uncertain submissions', () => {
    const store = pendingWithdrawalStore(worker)
    store.write({ streamId: '1', hash })
    expect(pendingWithdrawalStore(other).read()).toBeNull()
    expect(pendingWithdrawalStore(worker.toUpperCase()).read()?.hash).toBe(hash)
    store.write({ streamId: '1', hash: null })
    expect(store.read()).toEqual({ streamId: '1', hash: null })
    store.write(null)
    expect(store.read()).toBeNull()
  })
  it('does not mistake corrupt storage for permission to send again', () => {
    pendingWithdrawalStore(worker).write({ streamId: '1', hash })
    localStorage.setItem(localStorage.key(0)!, '{"streamId":"0","hash":"bad"}')
    expect(() => pendingWithdrawalStore(worker).read()).toThrow()
  })
})
