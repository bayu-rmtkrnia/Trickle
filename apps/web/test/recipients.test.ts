import { describe, expect, it } from 'vitest'
import { cancelInvitation } from '@/lib/api/invitations'
import { deleteRecipient, isRecipient, listRecipients } from '@/lib/api/recipients'

const base = 'http://api.test/api/v1'
const dto = {
  id: 'rec-1',
  ownerId: 'user-1',
  userId: 'user-2',
  address: '0x3333333333333333333333333333333333333333',
  displayName: 'Ibu',
  relation: 'Ibu',
  addedAt: '2026-10-12T10:00:00Z',
}
function capture(response: () => Response) {
  const requests: Request[] = []
  return {
    requests,
    options: {
      baseUrl: base,
      fetcher: async (url: string | URL | Request, init?: RequestInit) => {
        requests.push(new Request(url, init))
        return response()
      },
    },
  }
}

describe('recipient adapter', () => {
  it('lists recipients with a Trickle bearer and encoded cursor', async () => {
    const { requests, options } = capture(() => Response.json({ data: [dto], nextCursor: null }))
    await expect(listRecipients('s', 'a/b', options)).resolves.toEqual({
      data: [dto],
      nextCursor: null,
    })
    expect(requests[0]?.url).toBe(`${base}/recipients?cursor=a%2Fb`)
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer s')
  })

  it.each([
    { ...dto, address: '0x12' },
    { ...dto, displayName: '' },
    { ...dto, relation: '' },
    { ...dto, addedAt: 'later' },
  ])('rejects a malformed recipient %#', (bad) => {
    expect(isRecipient(bad)).toBe(false)
  })

  it('surfaces 409 SPLIT_ACTIVE on delete without retrying', async () => {
    const { requests, options } = capture(() =>
      Response.json({ error: { code: 'SPLIT_ACTIVE', message: 'x' } }, { status: 409 }),
    )
    await expect(deleteRecipient('rec/1', 's', options)).rejects.toMatchObject({
      status: 409,
      code: 'SPLIT_ACTIVE',
    })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe('DELETE')
    expect(requests[0]?.url).toBe(`${base}/recipients/rec%2F1`)
  })

  it('cancels an invite by id', async () => {
    const { requests, options } = capture(() => new Response(null, { status: 204 }))
    await expect(cancelInvitation('inv-1', 's', options)).resolves.toBeUndefined()
    expect(requests[0]?.method).toBe('DELETE')
    expect(requests[0]?.url).toBe(`${base}/invites/inv-1`)
  })
})
