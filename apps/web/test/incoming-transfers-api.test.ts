import { describe, expect, it } from 'vitest'
import { listIncomingTransfers } from '@/lib/api/incoming-transfers'

const row = {
  id: 'sp-1',
  txHash: `0x${'a'.repeat(64)}`,
  streamId: '7',
  workerAddress: '0x1234567890abcdef1234567890abcdef12345678',
  amountUnits: '3200000',
  paidAt: '2026-11-15T07:02:00Z',
  sender: { id: 'u-siti', displayName: 'Siti' },
}
const reply = (body: unknown) => ({
  baseUrl: 'http://api.test/api/v1',
  fetcher: async () => Response.json(body),
})

describe('incoming transfers adapter', () => {
  it('asks for the next page with the session token', async () => {
    const page = await listIncomingTransfers('session', 'sp-9', {
      baseUrl: 'http://api.test/api/v1',
      fetcher: async (url, init) => {
        expect(String(url)).toBe('http://api.test/api/v1/users/me/incoming-transfers?cursor=sp-9')
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer session')
        return Response.json({
          data: [row, { ...row, id: 'sp-2', sender: null }],
          nextCursor: null,
        })
      },
    })
    expect(page.data.map((r) => r.id)).toEqual(['sp-1', 'sp-2'])
  })

  it.each([
    { ...row, amountUnits: '3.2' },
    { ...row, txHash: '0x12' },
    { ...row, paidAt: 'yesterday' },
    { ...row, sender: { displayName: 'Siti' } },
  ])('rejects a malformed transfer', async (bad) => {
    await expect(
      listIncomingTransfers('session', undefined, reply({ data: [bad], nextCursor: null })),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})
