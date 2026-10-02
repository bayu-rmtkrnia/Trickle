import { describe, expect, it } from 'vitest'
import { PageQuery, pageArgs, toPage } from '../src/lib/pagination.js'

const rows = (...ids: string[]) => ids.map((id) => ({ id }))

describe('pagination helpers', () => {
  it('defaults the limit and coerces query strings', () => {
    expect(PageQuery.parse({})).toEqual({ limit: 20 })
    expect(PageQuery.parse({ limit: '5', cursor: 'abc' })).toEqual({ limit: 5, cursor: 'abc' })
    expect(PageQuery.safeParse({ limit: '101' }).success).toBe(false)
  })

  it('fetches one extra row and skips the cursor row itself', () => {
    expect(pageArgs({ limit: 10 })).toMatchObject({ take: 11 })
    expect(pageArgs({ limit: 10 })).not.toHaveProperty('cursor')
    expect(pageArgs({ limit: 10, cursor: 'x' })).toMatchObject({
      take: 11,
      cursor: { id: 'x' },
      skip: 1,
    })
  })

  it('returns a cursor only when there is another page', () => {
    expect(toPage(rows('a', 'b', 'c'), 2, (r) => r.id)).toEqual({
      data: ['a', 'b'],
      nextCursor: 'b',
    })
    expect(toPage(rows('a', 'b'), 2, (r) => r.id)).toEqual({ data: ['a', 'b'], nextCursor: null })
    expect(toPage([], 2, (r: { id: string }) => r.id)).toEqual({ data: [], nextCursor: null })
  })
})
