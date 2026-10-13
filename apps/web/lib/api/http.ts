// Request ke backend lewat `apiRequest` (./client.ts) dan `authed` (./session.ts).
// File ini hanya berisi helper pagination untuk endpoint list.

/** Ambil semua halaman dari endpoint ber-cursor (`{ data, nextCursor }`). */
export async function fetchAllPages<T>(
  request: (cursor: string | undefined) => Promise<{ data: T[]; nextCursor: string | null }>,
  maxPages = 20,
): Promise<T[]> {
  const items: T[] = []
  let cursor: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const result = await request(cursor)
    items.push(...result.data)
    if (!result.nextCursor) break
    cursor = result.nextCursor
  }
  return items
}
