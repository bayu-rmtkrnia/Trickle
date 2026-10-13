import { apiRequest, type ApiRequestOptions } from './client'
import { ApiError, isApiError } from './errors'
import type { Me, SessionResponse } from './worker-types'

type ClientOptions = Pick<ApiRequestOptions, 'baseUrl' | 'fetcher' | 'signal'>

export interface SessionApi {
  createSession(accessToken: string): Promise<SessionResponse>
  getMe(token: string): Promise<Me>
  revokeSession(token: string): Promise<void>
  sleep(milliseconds: number): Promise<void>
}

export interface SessionAccount {
  configured: boolean
  ready: boolean
  authenticated: boolean
  userId: string | null
  walletAddress: string | null
  getAccessToken(): Promise<string | null>
}

export type SessionStatus =
  'unconfigured' | 'loading' | 'signed-out' | 'exchanging' | 'ready' | 'error'

export interface SessionSnapshot {
  status: SessionStatus
  user: Me | null
  error: Error | null
  expiresAt: string | null
  logoutFailure?: 'server' | 'privy'
}

const WALLET_RETRY_DELAYS = [1000, 2000, 4000, 8000] as const
const wait = async (milliseconds: number): Promise<void> => {
  const deadline = Date.now() + milliseconds
  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, Math.min(deadline - Date.now(), 2_147_483_647))
    })
  }
}

export async function createSession(
  accessToken: string,
  options: ClientOptions = {},
): Promise<SessionResponse> {
  return apiRequest<SessionResponse>('sessions', {
    ...options,
    method: 'POST',
    body: { accessToken },
  })
}

export async function getMe(token: string, options: ClientOptions = {}): Promise<Me> {
  return apiRequest<Me>('users/me', { ...options, token })
}

export async function revokeSession(token: string, options: ClientOptions = {}): Promise<void> {
  return apiRequest<void>('sessions/current', { ...options, method: 'DELETE', token })
}

export class SessionCoordinator {
  private snapshot: SessionSnapshot = {
    status: 'unconfigured',
    user: null,
    error: null,
    expiresAt: null,
  }
  private account: SessionAccount | null = null
  private token: string | null = null
  private expiresAt: string | null = null
  private rateLimitUntil = 0
  private loggingOut = false
  private blockedIdentity: string | null = null
  private generation = 0
  private pending: { identity: string; promise: Promise<string | null> } | null = null
  private readonly listeners = new Set<() => void>()

  constructor(private readonly api: SessionApi) {}

  getSnapshot(): SessionSnapshot {
    return this.snapshot
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private setSnapshot(snapshot: Omit<SessionSnapshot, 'expiresAt'>) {
    this.snapshot = { ...snapshot, expiresAt: snapshot.status === 'ready' ? this.expiresAt : null }
    for (const listener of this.listeners) listener()
  }

  private clearSession() {
    this.generation += 1
    this.token = null
    this.expiresAt = null
    this.pending = null
    this.rateLimitUntil = 0
  }

  async updateAccount(account: SessionAccount): Promise<void> {
    const previousIdentity = this.account?.userId ?? null
    const previousWallet = this.account?.walletAddress
    const previousUsable =
      this.account?.configured &&
      this.account.ready &&
      this.account.authenticated &&
      this.account.userId &&
      previousWallet
    if (!account.authenticated || (account.userId && account.userId !== this.blockedIdentity)) {
      this.blockedIdentity = null
    }
    if (this.loggingOut || (account.userId && account.userId === this.blockedIdentity)) return
    const usable = account.configured && account.ready && account.authenticated && account.userId
    if (
      previousIdentity !== account.userId ||
      !usable ||
      previousWallet?.toLowerCase() !== account.walletAddress?.toLowerCase()
    )
      this.clearSession()
    this.account = account

    if (!account.configured) {
      this.setSnapshot({ status: 'unconfigured', user: null, error: null })
      return
    }
    if (!account.ready) {
      this.setSnapshot({ status: 'loading', user: null, error: null })
      return
    }
    if (!account.authenticated || !account.userId) {
      this.setSnapshot({ status: 'signed-out', user: null, error: null })
      return
    }

    if (
      previousIdentity === account.userId &&
      previousUsable &&
      previousWallet === account.walletAddress &&
      this.snapshot.status === 'error'
    )
      return

    await this.ensureSession().then(
      () => undefined,
      () => undefined,
    )
  }

  async ensureSession(): Promise<string | null> {
    return this.startExchange(true)
  }

  async refreshMe(): Promise<Me | null> {
    const identity = this.account?.userId
    if (!identity) return null
    if (!this.token || !this.expiresAt || Date.parse(this.expiresAt) <= Date.now()) {
      return (await this.ensureSession()) ? this.snapshot.user : null
    }
    const token = this.token
    const generation = this.generation
    if (!token) return null

    try {
      const user = await this.rateLimited(() => this.api.getMe(token), identity, generation)
      if (!user) return null
      if (this.isCurrent(identity, generation)) {
        this.setSnapshot({ status: 'ready', user, error: null })
      }
      return this.isCurrent(identity, generation) ? user : null
    } catch (error) {
      if (isApiError(error) && error.status === 401 && this.isCurrent(identity, generation)) {
        this.token = null
        this.expiresAt = null
        this.generation += 1
        return (await this.startExchange(false)) ? this.snapshot.user : null
      }
      if (this.isCurrent(identity, generation)) {
        this.token = null
        this.expiresAt = null
        this.generation += 1
        this.pending = null
        this.setSnapshot({ status: 'error', user: null, error: asError(error) })
      }
      throw error
    }
  }

  async logout(logoutPrivy: () => Promise<void>): Promise<void> {
    const token = this.token
    const previousAccount = this.account
    this.loggingOut = true
    this.blockedIdentity = previousAccount?.userId ?? this.blockedIdentity
    this.clearSession()
    this.account = previousAccount
      ? { ...previousAccount, authenticated: false, userId: null }
      : null
    this.setSnapshot({ status: 'signed-out', user: null, error: null })

    let revokeFailure: unknown
    if (token) {
      try {
        await this.api.revokeSession(token)
      } catch (error) {
        revokeFailure = error
      }
    }

    try {
      await logoutPrivy()
    } catch (error) {
      this.setSnapshot({ status: 'signed-out', user: null, error: null, logoutFailure: 'privy' })
      throw error
    } finally {
      this.loggingOut = false
    }
    if (revokeFailure) {
      this.setSnapshot({ status: 'signed-out', user: null, error: null, logoutFailure: 'server' })
      throw revokeFailure
    }
  }

  private startExchange(allow401Recovery: boolean): Promise<string | null> {
    const account = this.account
    const identity = account?.userId
    if (
      this.loggingOut ||
      identity === this.blockedIdentity ||
      !account?.configured ||
      !account.ready ||
      !account.authenticated ||
      !identity
    ) {
      return Promise.resolve(null)
    }
    if (!account.walletAddress) {
      const error = new ApiError(
        'conflict',
        'Wallet belum siap. Coba lagi setelah wallet tersedia.',
        {
          status: 409,
          code: 'WALLET_NOT_READY',
        },
      )
      this.setSnapshot({ status: 'error', user: null, error })
      return Promise.reject(error)
    }
    if (this.token && this.expiresAt && Date.parse(this.expiresAt) > Date.now()) {
      return Promise.resolve(this.token)
    }
    if (this.token) this.clearSession()
    if (this.pending?.identity === identity) return this.pending.promise

    const generation = this.generation
    this.setSnapshot({ status: 'exchanging', user: null, error: null })
    const promise = this.exchange(identity, generation, allow401Recovery)
    this.pending = { identity, promise }
    void promise
      .finally(() => {
        if (this.pending?.promise === promise) this.pending = null
      })
      .catch(() => undefined)
    return promise
  }

  private async exchange(
    identity: string,
    generation: number,
    allow401Recovery: boolean,
  ): Promise<string | null> {
    try {
      let session = await this.exchangeOnce(identity, generation)
      if (!session) return null

      let user: Me | null
      try {
        user = await this.rateLimited(() => this.api.getMe(session!.token), identity, generation)
      } catch (error) {
        if (!(allow401Recovery && isApiError(error) && error.status === 401)) throw error
        session = await this.exchangeOnce(identity, generation)
        if (!session) return null
        user = await this.rateLimited(() => this.api.getMe(session!.token), identity, generation)
      }

      if (!user || !this.isCurrent(identity, generation)) return null
      this.token = session.token
      this.expiresAt = session.expiresAt
      this.setSnapshot({ status: 'ready', user, error: null })
      return session.token
    } catch (error) {
      if (this.isCurrent(identity, generation)) {
        this.token = null
        this.expiresAt = null
        this.setSnapshot({ status: 'error', user: null, error: asError(error) })
      }
      throw error
    }
  }

  private async exchangeOnce(identity: string, generation: number) {
    const account = this.account
    if (!account || !this.isCurrent(identity, generation)) return null
    const accessToken = await account.getAccessToken()
    if (!this.isCurrent(identity, generation)) return null
    if (!accessToken) {
      throw new ApiError('unauthorized', 'Sesi Privy tidak tersedia', {
        status: 401,
        code: 'PRIVY_TOKEN_UNAVAILABLE',
      })
    }

    for (let attempt = 0; ; attempt += 1) {
      try {
        const session = await this.rateLimited(
          () => this.api.createSession(accessToken),
          identity,
          generation,
        )
        if (!session) return null
        if (
          !session.token ||
          !Number.isFinite(Date.parse(session.expiresAt)) ||
          Date.parse(session.expiresAt) <= Date.now()
        ) {
          throw new ApiError('server', 'Sesi dari server tidak valid', { code: 'INVALID_SESSION' })
        }
        return this.isCurrent(identity, generation) ? session : null
      } catch (error) {
        const delay = WALLET_RETRY_DELAYS[attempt]
        if (!(isApiError(error) && error.code === 'WALLET_NOT_READY' && delay !== undefined)) {
          throw error
        }
        await this.api.sleep(delay)
        if (!this.isCurrent(identity, generation)) return null
      }
    }
  }

  private async rateLimited<T>(
    operation: () => Promise<T>,
    identity: string,
    generation: number,
  ): Promise<T | null> {
    for (let attempt = 0; ; attempt += 1) {
      const remaining = this.rateLimitUntil - Date.now()
      if (remaining > 0) {
        await this.api.sleep(remaining)
        if (!this.isCurrent(identity, generation)) return null
        this.rateLimitUntil = 0
      }
      if (!this.isCurrent(identity, generation)) return null
      try {
        return await operation()
      } catch (error) {
        if (!this.isCurrent(identity, generation)) return null
        if (!isApiError(error) || error.status !== 429) throw error
        this.rateLimitUntil = Date.now() + (error.retryAfterMs ?? 1000 * 2 ** Math.min(attempt, 1))
        if (attempt >= 2) throw error
      }
    }
  }

  private isCurrent(identity: string, generation: number) {
    return this.generation === generation && this.account?.userId === identity
  }
}

function asError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

export const defaultSessionApi: SessionApi = {
  createSession,
  getMe,
  revokeSession,
  sleep: wait,
}

// Jembatan untuk API area perusahaan (lib/api/real.ts). Tidak membuat sesi sendiri:
// token diambil dari SessionCoordinator di atas (lewat TrickleSessionProvider), jadi
// seluruh aplikasi memakai satu sesi yang sama, termasuk retry WALLET_NOT_READY,
// batas permintaan, dan logout.

export interface SessionSource {
  /** Id user Trickle pemilik sesi; ganti user = cache dibuang. */
  key: string
  /** Token sesi yang masih berlaku (coordinator membuat atau memperbaruinya bila perlu). */
  getToken(): Promise<string | null>
  /** Dipanggil saat server menolak token (401): minta coordinator memulihkan sesi. */
  recover(): Promise<unknown>
}

let source: SessionSource | null = null
let sourceCache = new Map<string, unknown>()
const sourceListeners = new Set<() => void>()

/** Dipasang oleh `useApiSession` saat sesi siap; `null` saat logout atau ganti akun. */
export function connectSessionSource(next: SessionSource | null) {
  const changed = next?.key !== source?.key
  source = next
  if (!changed) return
  sourceCache = new Map()
  sourceListeners.forEach((listener) => listener())
}

export function subscribeSessionSource(listener: () => void) {
  sourceListeners.add(listener)
  return () => sourceListeners.delete(listener)
}

/** Id user yang sumber sesinya sedang terpasang, atau `null`. */
export const connectedSessionKey = () => source?.key ?? null

async function sourceToken(): Promise<string> {
  const token = await source?.getToken()
  if (!token) throw new ApiError('unauthorized', 'Sign in required', { status: 401 })
  return token
}

/** Request dengan token sesi. Kalau ditolak (401), sesi dipulihkan sekali lalu dicoba lagi. */
export async function authed<T>(path: string, options: Omit<ApiRequestOptions, 'token'> = {}) {
  try {
    return await apiRequest<T>(path, { ...options, token: await sourceToken() })
  } catch (error) {
    if (!isApiError(error) || error.status !== 401 || !source) throw error
    await source.recover()
    return apiRequest<T>(path, { ...options, token: await sourceToken() })
  }
}

/** Cache kecil per user (mis. `companyId`). Dibuang saat ganti akun atau logout. */
export const sessionCache = {
  get: <T>(name: string) => sourceCache.get(name) as T | undefined,
  set: (name: string, value: unknown) => void sourceCache.set(name, value),
  clear: (name: string) => void sourceCache.delete(name),
}
