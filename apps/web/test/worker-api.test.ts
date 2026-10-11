import { describe, expect, it, vi } from 'vitest'
import { listMyEmployments } from '@/lib/api/worker'

const page = {
  data: [
    {
      id: 'job-1',
      displayName: 'Siti',
      monthlySalaryUsd: 800,
      joinedAt: '2026-10-11T00:00:00Z',
      employer: { id: 'company-1', name: 'PT Maju', country: null, ownerAddress: '0x1111' },
    },
  ],
  nextCursor: null,
}
describe('worker employment API contract (pending backend)', () => {
  it('uses the authenticated-user endpoint with bearer, encoded cursor and cancellation', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(page)))
    const controller = new AbortController()
    expect(
      await listMyEmployments('token', 'a/b&c', {
        baseUrl: 'http://api/api/v1',
        fetcher,
        signal: controller.signal,
      }),
    ).toEqual(page)
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://api/api/v1/users/me/employments?cursor=a%2Fb%26c')
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer token')
    expect(options.signal).toBe(controller.signal)
  })
  it('accepts an empty page and preserves 404 as a failure', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [], nextCursor: null })))
    expect(await listMyEmployments('token', undefined, { baseUrl: 'http://api', fetcher })).toEqual(
      { data: [], nextCursor: null },
    )
    await expect(
      listMyEmployments('token', undefined, {
        baseUrl: 'http://api',
        fetcher: async () => new Response('', { status: 404 }),
      }),
    ).rejects.toMatchObject({ status: 404 })
  })
  it.each([
    null,
    { data: [] },
    { ...page, nextCursor: 42 },
    { ...page, data: [{ ...page.data[0], monthlySalaryUsd: '800' }] },
    { ...page, data: [{ ...page.data[0], monthlySalaryUsd: -1 }] },
    { ...page, data: [{ ...page.data[0], joinedAt: 'invalid' }] },
    { ...page, data: [{ ...page.data[0], employer: null }] },
  ])('rejects malformed responses rather than rendering invented metadata (%j)', async (value) => {
    await expect(
      listMyEmployments('token', undefined, {
        baseUrl: 'http://api',
        fetcher: async () => new Response(JSON.stringify(value)),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})
