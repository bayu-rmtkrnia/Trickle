import { describe, expect, it } from 'vitest'
import {
  acceptInvitation,
  createFamilyInvitation,
  getInvitation,
  listFamilyInvitations,
} from '@/lib/api/invitations'

describe('real invitation HTTP adapters', () => {
  it('loads public invitations with cancellation and without authorization', async () => {
    const abort = new AbortController()
    let request!: Request
    const data = { code: 'WORKER1234', status: 'EXPIRED' }
    const value = await getInvitation('worker/code', abort.signal, {
      baseUrl: 'https://api.example.com/api/v1',
      fetcher: async (url, init) => {
        request = new Request(url, init)
        expect(init?.signal).toBe(abort.signal)
        return Response.json(data)
      },
    })
    expect(request.url).toBe('https://api.example.com/api/v1/invites/worker%2Fcode')
    expect(request.headers.has('authorization')).toBe(false)
    expect(value).toEqual(data)
  })

  it('posts acceptance to /acceptance once with a Trickle bearer and no replay on 401', async () => {
    const requests: Request[] = []
    await expect(
      acceptInvitation('WORKER1234', 'trickle-session', {
        baseUrl: 'https://api.example.com/api/v1',
        fetcher: async (url, init) => {
          requests.push(new Request(url, init))
          return Response.json(
            { error: { code: 'UNAUTHORIZED', message: 'Expired' } },
            { status: 401 },
          )
        },
      }),
    ).rejects.toMatchObject({ kind: 'unauthorized', status: 401 })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://api.example.com/api/v1/invites/WORKER1234/acceptance')
    expect(requests[0]?.method).toBe('POST')
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer trickle-session')
    expect(await requests[0]?.text()).toBe('')
  })

  it('creates RECIPIENT invitations with the real discriminated body', async () => {
    let body: unknown
    await createFamilyInvitation({ inviteeName: 'Ibu', relation: 'Ibu' }, 'trickle-session', {
      baseUrl: 'https://api.example.com/api/v1',
      fetcher: async (url, init) => {
        body = await new Request(url, init).json()
        return Response.json({ code: 'FAMILY1234' })
      },
    })
    expect(body).toEqual({ type: 'RECIPIENT', inviteeName: 'Ibu', relation: 'Ibu' })
  })

  it('lists RECIPIENT invitations with an encoded cursor', async () => {
    let requestedUrl = ''
    const page = await listFamilyInvitations('trickle-session', 'cursor/with space', {
      baseUrl: 'https://api.example.com/api/v1',
      fetcher: async (url) => {
        requestedUrl = String(url)
        return Response.json({ data: [], nextCursor: null })
      },
    })
    expect(requestedUrl).toBe(
      'https://api.example.com/api/v1/invites?type=RECIPIENT&cursor=cursor%2Fwith+space',
    )
    expect(page).toEqual({ data: [], nextCursor: null })
  })
})
