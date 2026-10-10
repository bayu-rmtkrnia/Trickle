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
  getAccessToken(): Promise<string | null>
}

export type SessionStatus =
  'unconfigured' | 'loading' | 'signed-out' | 'exchanging' | 'ready' | 'error'

export interface SessionSnapshot {
  status: SessionStatus
  user: Me | null
  error: Error | null
}

const WALLET_RETRY_DELAYS = [1000, 2000, 4000, 8000] as const
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, milliseconds)
  })

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
  private snapshot: SessionSnapshot = { status: 'unconfigured', user: null, error: null }
  private account: SessionAccount | null = null
  private token: string | null = null
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

  private setSnapshot(snapshot: SessionSnapshot) {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }

  private clearSession() {
    this.generation += 1
    this.token = null
    this.pending = null
  }

  async updateAccount(account: SessionAccount): Promise<void> {
    const previousIdentity = this.account?.userId ?? null
    const usable = account.configured && account.ready && account.authenticated && account.userId
    if (previousIdentity !== account.userId || !usable) this.clearSession()
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
    const generation = this.generation
    let token = this.token
    if (!identity) return null
    if (!token) token = await this.ensureSession()
    if (!token) return null

    try {
      const user = await this.api.getMe(token)
      if (this.isCurrent(identity, generation)) {
        this.setSnapshot({ status: 'ready', user, error: null })
      }
      return this.isCurrent(identity, generation) ? user : null
    } catch (error) {
      if (isApiError(error) && error.status === 401 && this.isCurrent(identity, generation)) {
        this.token = null
        return (await this.startExchange(false)) ? this.snapshot.user : null
      }
      if (this.isCurrent(identity, generation)) {
        this.setSnapshot({ status: 'error', user: null, error: asError(error) })
      }
      throw error
    }
  }

  async logout(logoutPrivy: () => Promise<void>): Promise<void> {
    const token = this.token
    const previousAccount = this.account
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

    await logoutPrivy()
    if (revokeFailure) throw revokeFailure
  }

  private startExchange(allow401Recovery: boolean): Promise<string | null> {
    const account = this.account
    const identity = account?.userId
    if (!account?.configured || !account.ready || !account.authenticated || !identity) {
      return Promise.resolve(null)
    }
    if (this.token) return Promise.resolve(this.token)
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

      let user: Me
      try {
        user = await this.api.getMe(session.token)
      } catch (error) {
        if (!(allow401Recovery && isApiError(error) && error.status === 401)) throw error
        session = await this.exchangeOnce(identity, generation)
        if (!session) return null
        user = await this.api.getMe(session.token)
      }

      if (!this.isCurrent(identity, generation)) return null
      this.token = session.token
      this.setSnapshot({ status: 'ready', user, error: null })
      return session.token
    } catch (error) {
      if (this.isCurrent(identity, generation)) {
        this.token = null
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
        const session = await this.api.createSession(accessToken)
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
