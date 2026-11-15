import { describe, expect, it } from 'vitest'
import { startDemoStream } from '@/lib/api/demo'

const address = '0x2222222222222222222222222222222222222222'
const dto = {
  id: 'demo-1',
  workerAddress: address,
  amountUsd: '50',
  durationSeconds: 3600,
  status: 'SENT',
  streamId: '7',
  txHash: `0x${'a'.repeat(64)}`,
  startsAt: '2026-11-15T00:00:00Z',
  endsAt: '2026-11-15T01:00:00Z',
  alreadyStarted: false,
  createdAt: '2026-11-15T00:00:00Z',
}

describe('demo stream adapter', () => {
  it('posts with the session token and returns the stream', async () => {
    const result = await startDemoStream('session', address, {
      baseUrl: 'http://api.test/api/v1',
      fetcher: async (url, init) => {
        expect(String(url)).toBe('http://api.test/api/v1/demo-streams')
        expect(init?.method).toBe('POST')
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer session')
        return Response.json(dto, { status: 201 })
      },
    })
    expect(result.streamId).toBe('7')
  })

  it.each([
    { ...dto, workerAddress: '0x3333333333333333333333333333333333333333' },
    { ...dto, streamId: null },
    { ...dto, status: 'DONE' },
  ])('rejects malformed or other-account responses', async (bad) => {
    await expect(
      startDemoStream('session', address, {
        baseUrl: 'http://api.test',
        fetcher: async () => Response.json(bad),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})
