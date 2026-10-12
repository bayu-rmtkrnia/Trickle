// Sesi Trickle: token akses Privy ditukar ke `POST /sessions`, lalu token sesi
// dikirim sebagai `Authorization: Bearer` di semua endpoint yang dilindungi.

import { ApiError, isApiError } from './errors'
import { http, type HttpOptions } from './http'

interface StoredSession {
  key: string
  token: string
  expiresAt: number
}

const STORAGE_KEY = 'trickle:session'
/** Perbarui sesi 1 menit sebelum habis. */
const EXPIRY_MARGIN_MS = 60_000
/** Wallet Privy baru dibuat beberapa detik setelah login pertama (409 WALLET_NOT_READY). */
const WALLET_RETRIES = 4
const WALLET_RETRY_MS = 1500

let accessTokenGetter: (() => Promise<string | null>) | null = null
let accountKey: string | null = null
let session: StoredSession | null = null
let pending: Promise<string> | null = null
let cache = new Map<string, unknown>()
const listeners = new Set<() => void>()

function readStored(key: string): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const stored = raw ? (JSON.parse(raw) as StoredSession) : null
    return stored?.key === key ? stored : null
  } catch {
    return null
  }
}

function writeStored(value: StoredSession | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Penyimpanan diblokir (mode privat): sesi tetap jalan di memori.
  }
}

/**
 * Dipanggil saat status login Privy berubah. `key` = id user Privy, atau null
 * kalau belum/tidak login. Ganti akun = sesi dan cache lama dibuang.
 */
export function configureSession(
  getter: (() => Promise<string | null>) | null,
  key: string | null,
) {
  accessTokenGetter = getter
  if (key === accountKey) return
  accountKey = key
  session = key ? readStored(key) : null
  if (!key) writeStored(null)
  pending = null
  cache = new Map()
  listeners.forEach((listener) => listener())
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Akun yang sedang dikonfigurasi; dipakai untuk tahu kapan API siap dipanggil. */
export const configuredAccount = () => accountKey

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function exchange(key: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const accessToken = await accessTokenGetter?.()
    if (!accessToken) throw new ApiError('unauthorized')
    try {
      const res = await http<{ token: string; expiresAt: string }>('sessions', {
        method: 'POST',
        body: { accessToken },
      })
      const next = { key, token: res.token, expiresAt: Date.parse(res.expiresAt) }
      if (accountKey === key) {
        session = next
        writeStored(next)
      }
      return res.token
    } catch (err) {
      if (isApiError(err) && err.code === 'WALLET_NOT_READY' && attempt < WALLET_RETRIES) {
        await sleep(WALLET_RETRY_MS)
        continue
      }
      throw err
    }
  }
}

async function sessionToken(): Promise<string> {
  const key = accountKey
  if (!key) throw new ApiError('unauthorized')
  if (session && session.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return session.token
  pending ??= exchange(key).finally(() => {
    pending = null
  })
  return pending
}

function dropSession() {
  session = null
  writeStored(null)
}

/** Request dengan token sesi. Kalau ditolak (401), sesi dibuat ulang sekali. */
export async function authed<T>(path: string, options: Omit<HttpOptions, 'token'> = {}) {
  try {
    return await http<T>(path, { ...options, token: await sessionToken() })
  } catch (err) {
    if (!isApiError(err) || err.status !== 401 || !session) throw err
    dropSession()
    return http<T>(path, { ...options, token: await sessionToken() })
  }
}

/** Cache kecil per akun (mis. companyId dari `users/me`). Hilang saat ganti akun. */
export const sessionCache = {
  get: <T>(name: string) => cache.get(name) as T | undefined,
  set: (name: string, value: unknown) => void cache.set(name, value),
  clear: (name: string) => void cache.delete(name),
}
