import { describe, expect, it } from 'vitest'
import { requestGas } from '@/lib/api/gas'
import { withdrawalMessage } from '@/lib/copy/withdraw'
const address = '0x2222222222222222222222222222222222222222'
const hash = `0x${'a'.repeat(64)}`
const dto = {
  address,
  status: 'SENT',
  amountMon: '0.05',
  txHash: hash,
  alreadyDripped: false,
  createdAt: '2026-10-11T00:00:00Z',
}
describe('real gas drip adapter', () => {
  it('uses the signed-in session and actual backend DTO', async () => {
    const result = await requestGas('session', address, {
      baseUrl: 'http://api.test/api/v1',
      fetcher: async (url, init) => {
        expect(String(url)).toBe('http://api.test/api/v1/gas-drips')
        expect(init?.method).toBe('POST')
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer session')
        return Response.json(dto)
      },
    })
    expect(result.status).toBe('SENT')
    expect(result.txHash).toBe(hash)
  })
  it.each([
    { ...dto, address: '0x3333333333333333333333333333333333333333' },
    { ...dto, txHash: null },
    { ...dto, status: 'SUCCESS' },
  ])('rejects malformed or other-account gas responses', async (bad) => {
    await expect(
      requestGas('session', address, {
        baseUrl: 'http://api.test',
        fetcher: async () => Response.json(bad),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it.each([
    [401, 'UNAUTHORIZED', 'Masuk kembali'],
    [429, 'RATE_LIMITED', 'Terlalu banyak'],
    [429, 'DRIP_DAILY_LIMIT', 'besok'],
    [502, 'DRIP_FAILED', 'belum berhasil'],
    [503, 'DRIP_UNAVAILABLE', 'belum dikonfigurasi'],
  ])('shows a useful message for %i %s', async (status, code, expected) => {
    const error = await requestGas('session', address, {
      baseUrl: 'http://api.test/api/v1',
      fetcher: async () => Response.json({ error: { code } }, { status }),
    }).catch((cause: unknown) => cause)
    expect(withdrawalMessage(error)).toContain(expected)
  })
})
