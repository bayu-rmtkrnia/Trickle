import { ApiError } from './errors'

/** Alamat backend. Lokal: `pnpm dev` di apps/api (port 4000). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(
  /\/+$/,
  '',
)

export interface HttpOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Token sesi Trickle (bukan token Privy). */
  token?: string
  query?: Record<string, string | number | undefined>
  signal?: AbortSignal
}

/** Request ke `/api/v1/<path>`. Error selalu dilempar sebagai ApiError. */
export async function http<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const url = new URL(`${API_URL}/api/v1/${path.replace(/^\/+/, '')}`)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const headers: Record<string, string> = { accept: 'application/json' }
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.token) headers.authorization = `Bearer ${options.token}`

  let res: Response
  try {
    res = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError('network')
  }

  if (res.status === 204) return undefined as T
  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const error = (json as { error?: { code?: string; message?: string; details?: unknown } })
      ?.error
    throw ApiError.fromResponse(res.status, error?.code, error?.message, error?.details)
  }
  return json as T
}

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
