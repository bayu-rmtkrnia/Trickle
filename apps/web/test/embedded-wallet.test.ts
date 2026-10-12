import { describe, expect, it, vi } from 'vitest'
import { sendEmbeddedTransaction } from '@/lib/chain/embedded-wallet'
const from = '0x2222222222222222222222222222222222222222' as const
const other = '0x3333333333333333333333333333333333333333' as const
const hash = `0x${'a'.repeat(64)}` as const
const request = { from, to: other, data: '0x1234' as const, chainId: 10143, value: BigInt(0) }
describe('embedded wallet signing boundary', () => {
  it('marks chain-switch failure as a definite failure before transaction submission', async () => {
    const send = vi.fn(async () => ({ hash }))
    await expect(
      sendEmbeddedTransaction(
        request,
        () => ({
          address: from,
          switchChain: async () => {
            throw Error('RPC unavailable')
          },
        }),
        send,
      ),
    ).rejects.toMatchObject({ code: 'WALLET_NOT_READY' })
    expect(send).not.toHaveBeenCalled()
  })
  it('explicitly selects the worker wallet and target chain', async () => {
    const switchChain = vi.fn(async () => {}),
      send = vi.fn(async () => ({ hash }))
    await sendEmbeddedTransaction(request, () => ({ address: from, switchChain }), send)
    expect(switchChain).toHaveBeenCalledWith(10143)
    expect(send).toHaveBeenCalledWith(request, { address: from })
  })
  it('refuses a signer different from the backend account', async () => {
    const send = vi.fn(async () => ({ hash }))
    await expect(
      sendEmbeddedTransaction(
        request,
        () => ({ address: other, switchChain: async () => {} }),
        send,
      ),
    ).rejects.toMatchObject({ code: 'WALLET_CHANGED' })
    expect(send).not.toHaveBeenCalled()
  })
  it('checks identity again after switching chains', async () => {
    let address: string = from
    const send = vi.fn(async () => ({ hash }))
    await expect(
      sendEmbeddedTransaction(
        request,
        () => ({
          address,
          switchChain: async () => {
            address = other
          },
        }),
        send,
      ),
    ).rejects.toMatchObject({ code: 'WALLET_CHANGED' })
    expect(send).not.toHaveBeenCalled()
  })
})
