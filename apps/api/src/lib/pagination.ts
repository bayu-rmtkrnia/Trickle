import { z } from 'zod'

/**
 * Cursor pagination for list endpoints (PLAN §6.3): `?limit=&cursor=`.
 * The cursor is the id of the last item on the previous page, so pages stay
 * stable when new rows are inserted at the top (unlike `?page=` offsets).
 */
export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('Items per page, 1–100'),
  cursor: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe('`nextCursor` from the previous page. Omit for the first page.'),
})

export type PageQuery = z.infer<typeof PageQuery>

export const Page = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    nextCursor: z
      .string()
      .nullable()
      .describe('Pass as `cursor` to get the next page. `null` on the last page.'),
  })

/**
 * Prisma `findMany` arguments for one page, newest first. Fetches one extra row
 * so `toPage` can tell whether another page exists without a COUNT query.
 * `id` breaks ties between rows created in the same millisecond.
 */
export const pageArgs = ({ limit, cursor }: PageQuery) => ({
  take: limit + 1,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
})

export function toPage<T extends { id: string }, R>(
  rows: T[],
  limit: number,
  toDto: (row: T) => R,
) {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  return {
    data: items.map(toDto),
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
  }
}
