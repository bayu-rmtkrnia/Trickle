import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import { apiRequest } from '@/lib/api/client'
import {
  SessionCoordinator,
  createSession,
  getMe,
  revokeSession,
  type SessionAccount,
  type SessionApi,
} from '@/lib/api/session'
import type { Me, SessionResponse } from '@/lib/api/worker-types'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-10T10:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const sessionOne: SessionResponse = {
  token: 'trickle-session-1',
  expiresAt: '2026-10-17T10:00:00.000Z',
  user: {
    id: 'user-1',
    address: '0x1111111111111111111111111111111111111111',
    displayName: 'Ayu',
    createdAt: '2026-10-10T10:00:00.000Z',
  },
}

const workerOne: Me = {
  ...sessionOne.user,
  companyId: null,
  roles: { employer: false, worker: true, recipient: false },
}

function account(userId = 'did:privy:worker-1'): SessionAccount {
  return {
    configured: true,
    ready: true,
    authenticated: true,
    userId,
    walletAddress: sessionOne.user.address,
    getAccessToken: async () => `privy-token-${userId}`,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function api(overrides: Partial<SessionApi> = {}): SessionApi {
  return {
    createSession: async () => sessionOne,
    getMe: async () => workerOne,
    revokeSession: async () => {},
    sleep: async () => {},
    ...overrides,
  }
}

describe('API client', () => {
  it.each([
    { header: '2', delay: 2000 },
    { header: '0', delay: 0 },
    { header: 'Sat, 10 Oct 2026 10:00:03 GMT', delay: 3000 },
    { header: 'Sat, 10 Oct 2026 09:59:59 GMT', delay: 0 },
    { header: 'not-a-delay', delay: undefined },
    { header: '-1', delay: undefined },
  ])('preserves Retry-After "$header" on rate-limited responses', async ({ header, delay }) => {
    await expect(
      apiRequest('sessions', {
        baseUrl: 'http://api.test/api/v1',
        fetcher: async () =>
          Response.json(
            { error: { code: 'RATE_LIMITED', message: 'Try later' } },
            { status: 429, headers: { 'retry-after': header } },
          ),
      }),
    ).rejects.toMatchObject({
      kind: 'rate-limited',
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterMs: delay,
    })
  })

  it('revokes with Trickle bearer auth and accepts a bodyless 204 response', async () => {
    const requests: Request[] = []
    const result = await revokeSession('trickle-session-1', {
      baseUrl: 'http://api.test/api/v1',
      fetcher: async (input, init) => {
        requests.push(new Request(input, init))
        return new Response(null, { status: 204 })
      },
    })

    expect(result).toBeUndefined()
    expect(requests[0]?.method).toBe('DELETE')
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer trickle-session-1')
  })

  it('preserves backend status, code, message, and validation details', async () => {
    const details = [{ path: 'displayName', message: 'Required' }]

    await expect(
      apiRequest('users/me', {
        baseUrl: 'http://api.test/api/v1',
        fetcher: async () =>
          new Response(
            JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid', details } }),
            {
              status: 422,
              headers: { 'content-type': 'application/json' },
            },
          ),
      }),
    ).rejects.toMatchObject({ status: 422, code: 'VALIDATION_ERROR', message: 'Invalid', details })
  })

  it('sends the Privy token only in the session body and the Trickle token as bearer auth', async () => {
    const requests: Request[] = []
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init)
      requests.push(request)
      if (request.url.endsWith('/sessions')) {
        return Response.json(sessionOne, { status: 201 })
      }
      return Response.json(workerOne)
    })

    await createSession('privy-access-token', { baseUrl: 'http://api.test/api/v1', fetcher })
    await getMe('trickle-session-1', { baseUrl: 'http://api.test/api/v1', fetcher })

    expect(requests[0]?.headers.get('authorization')).toBeNull()
    expect(await requests[0]?.json()).toEqual({ accessToken: 'privy-access-token' })
    expect(requests[1]?.headers.get('authorization')).toBe('Bearer trickle-session-1')
  })
})

describe('SessionCoordinator', () => {
  it('stores session expiry and shares one renewal after the cached token expires', async () => {
    const renewed = {
      ...sessionOne,
      token: 'renewed-session',
      expiresAt: '2026-10-24T10:00:00.000Z',
    }
    const pendingRenewal = deferred<SessionResponse>()
    const create = vi
      .fn<SessionApi['createSession']>()
      .mockResolvedValueOnce(sessionOne)
      .mockImplementationOnce(async () => pendingRenewal.promise)
    const coordinator = new SessionCoordinator(api({ createSession: create }))
    await coordinator.updateAccount(account())

    expect(coordinator.getSnapshot()).toMatchObject({ expiresAt: sessionOne.expiresAt })
    vi.setSystemTime(new Date(sessionOne.expiresAt))
    const first = coordinator.ensureSession()
    const second = coordinator.ensureSession()
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2))
    pendingRenewal.resolve(renewed)

    await expect(Promise.all([first, second])).resolves.toEqual([
      'renewed-session',
      'renewed-session',
    ])
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'ready',
      expiresAt: renewed.expiresAt,
    })
  })

  it('does not send an expired cached token when refreshing the profile', async () => {
    const renewed = {
      ...sessionOne,
      token: 'renewed-session',
      expiresAt: '2026-10-24T10:00:00.000Z',
    }
    const create = vi
      .fn<SessionApi['createSession']>()
      .mockResolvedValueOnce(sessionOne)
      .mockResolvedValueOnce(renewed)
    const readMe = vi.fn(async () => workerOne)
    const coordinator = new SessionCoordinator(api({ createSession: create, getMe: readMe }))
    await coordinator.updateAccount(account())
    readMe.mockClear()
    vi.setSystemTime(new Date(sessionOne.expiresAt))

    await expect(coordinator.refreshMe()).resolves.toEqual(workerOne)

    expect(readMe).not.toHaveBeenCalledWith(sessionOne.token)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('rejects an invalid backend expiry before using the session token', async () => {
    const readMe = vi.fn(async () => workerOne)
    const coordinator = new SessionCoordinator(
      api({ createSession: async () => ({ ...sessionOne, expiresAt: 'invalid' }), getMe: readMe }),
    )

    await coordinator.updateAccount(account())

    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'error',
      user: null,
      error: { code: 'INVALID_SESSION' },
    })
    expect(readMe).not.toHaveBeenCalled()
  })

  it('waits for an embedded wallet before exchanging a session', async () => {
    const create = vi.fn(async () => sessionOne)
    const coordinator = new SessionCoordinator(api({ createSession: create }))

    await coordinator.updateAccount({ ...account(), walletAddress: null })

    expect(create).not.toHaveBeenCalled()
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'error',
      error: { code: 'WALLET_NOT_READY' },
    })

    await coordinator.updateAccount(account())
    expect(create).toHaveBeenCalledTimes(1)
    expect(coordinator.getSnapshot().status).toBe('ready')
  })

  it('honors Retry-After before retrying a rate-limited session exchange', async () => {
    const create = vi
      .fn<SessionApi['createSession']>()
      .mockRejectedValueOnce(
        new ApiError('rate-limited', 'Try later', { status: 429, retryAfterMs: 3000 }),
      )
      .mockResolvedValueOnce(sessionOne)
    const delays: number[] = []
    const coordinator = new SessionCoordinator(
      api({ createSession: create, sleep: async (delay) => void delays.push(delay) }),
    )

    await coordinator.updateAccount(account())

    expect(delays).toEqual([3000])
    expect(create).toHaveBeenCalledTimes(2)
    expect(coordinator.getSnapshot().status).toBe('ready')
  })

  it('retries a rate-limited profile read without exchanging another session', async () => {
    const readMe = vi
      .fn<SessionApi['getMe']>()
      .mockRejectedValueOnce(
        new ApiError('rate-limited', 'Try later', { status: 429, retryAfterMs: 2000 }),
      )
      .mockResolvedValueOnce(workerOne)
    const create = vi.fn(async () => sessionOne)
    const delays: number[] = []
    const coordinator = new SessionCoordinator(
      api({
        createSession: create,
        getMe: readMe,
        sleep: async (delay) => void delays.push(delay),
      }),
    )

    await coordinator.updateAccount(account())

    expect(delays).toEqual([2000])
    expect(create).toHaveBeenCalledTimes(1)
    expect(coordinator.getSnapshot().status).toBe('ready')
  })

  it('bounds automatic 429 retries and preserves the cooldown for a manual retry', async () => {
    const attempts: number[] = []
    const delays: number[] = []
    const create = vi.fn(async () => {
      attempts.push(Date.now())
      if (attempts.length <= 3) {
        throw new ApiError('rate-limited', 'Try later', { status: 429, retryAfterMs: 1000 })
      }
      return sessionOne
    })
    const coordinator = new SessionCoordinator(
      api({
        createSession: create,
        sleep: async (delay) => {
          delays.push(delay)
          vi.setSystemTime(Date.now() + delay)
        },
      }),
    )

    await coordinator.updateAccount(account())
    expect(create).toHaveBeenCalledTimes(3)
    expect(delays).toEqual([1000, 1000])
    expect(coordinator.getSnapshot().status).toBe('error')

    await expect(coordinator.ensureSession()).resolves.toBe(sessionOne.token)
    expect(delays).toEqual([1000, 1000, 1000])
    expect(attempts[3]! - attempts[2]!).toBe(1000)
  })

  it('uses bounded fallback delays when a 429 response has no Retry-After', async () => {
    const create = vi.fn<SessionApi['createSession']>(async () => {
      throw new ApiError('rate-limited', 'Try later', { status: 429 })
    })
    const delays: number[] = []
    const coordinator = new SessionCoordinator(
      api({ createSession: create, sleep: async (delay) => void delays.push(delay) }),
    )

    await coordinator.updateAccount(account())

    expect(delays).toEqual([1000, 2000])
    expect(create).toHaveBeenCalledTimes(3)
    expect(coordinator.getSnapshot().status).toBe('error')
  })

  it('stops a pending rate-limit retry when logout changes the account', async () => {
    const cooldown = deferred<void>()
    const create = vi.fn<SessionApi['createSession']>(async () => {
      throw new ApiError('rate-limited', 'Try later', { status: 429, retryAfterMs: 1000 })
    })
    const sleep = vi.fn(async () => cooldown.promise)
    const coordinator = new SessionCoordinator(api({ createSession: create, sleep }))
    const update = coordinator.updateAccount(account())
    await vi.waitFor(() => expect(sleep).toHaveBeenCalledTimes(1))

    await coordinator.logout(async () => {})
    cooldown.resolve()
    await update

    expect(create).toHaveBeenCalledTimes(1)
    expect(coordinator.getSnapshot()).toMatchObject({ status: 'signed-out', user: null })
  })

  it('requires explicit retry after an exchange failure instead of retrying on SDK rerenders', async () => {
    const create = vi
      .fn<SessionApi['createSession']>()
      .mockRejectedValueOnce(new ApiError('server', 'Unavailable', { status: 503 }))
      .mockResolvedValueOnce(sessionOne)
    const coordinator = new SessionCoordinator(api({ createSession: create }))
    await coordinator.updateAccount(account())

    await coordinator.updateAccount(account())

    expect(create).toHaveBeenCalledTimes(1)
    expect(coordinator.getSnapshot().status).toBe('error')
    await expect(coordinator.ensureSession()).resolves.toBe(sessionOne.token)
    expect(coordinator.getSnapshot().status).toBe('ready')
  })

  it('invalidates the old token and exchanges again when the same Privy user changes wallet', async () => {
    const create = vi.fn(async () => sessionOne)
    const coordinator = new SessionCoordinator(api({ createSession: create }))
    await coordinator.updateAccount(account())
    await coordinator.updateAccount({
      ...account(),
      walletAddress: '0x2222222222222222222222222222222222222222',
    })
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('does not recreate a session from stale authenticated updates during logout', async () => {
    const revoke = deferred<void>()
    const create = vi.fn(async () => sessionOne)
    const coordinator = new SessionCoordinator(
      api({ createSession: create, revokeSession: async () => revoke.promise }),
    )
    await coordinator.updateAccount(account())
    const logout = coordinator.logout(async () => {})

    await coordinator.updateAccount(account())
    expect(coordinator.getSnapshot()).toMatchObject({ status: 'signed-out', user: null })
    expect(create).toHaveBeenCalledTimes(1)

    revoke.resolve()
    await logout
    await coordinator.updateAccount(account())
    await expect(coordinator.ensureSession()).resolves.toBeNull()

    await coordinator.updateAccount({ ...account(), authenticated: false, userId: null })
    await coordinator.updateAccount(account())
    expect(coordinator.getSnapshot().status).toBe('ready')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('discards a late session response after logout', async () => {
    const pending = deferred<SessionResponse>()
    const readMe = vi.fn(async () => workerOne)
    const coordinator = new SessionCoordinator(
      api({ createSession: async () => pending.promise, getMe: readMe }),
    )
    const update = coordinator.updateAccount(account())
    await Promise.resolve()

    await coordinator.logout(async () => {})
    pending.resolve(sessionOne)
    await update

    expect(coordinator.getSnapshot()).toMatchObject({ status: 'signed-out', user: null })
    expect(readMe).not.toHaveBeenCalled()
    await expect(coordinator.ensureSession()).resolves.toBeNull()
  })

  it('stops after one 401 recovery when the replacement token is also rejected', async () => {
    const create = vi.fn(async () => sessionOne)
    const readMe = vi.fn<SessionApi['getMe']>(async () => {
      throw new ApiError('unauthorized', 'Expired', { status: 401 })
    })
    const coordinator = new SessionCoordinator(api({ createSession: create, getMe: readMe }))

    await coordinator.updateAccount(account())

    expect(create).toHaveBeenCalledTimes(2)
    expect(readMe).toHaveBeenCalledTimes(2)
    expect(coordinator.getSnapshot().status).toBe('error')
  })

  it('discards an old profile response that arrives after expiry renewal', async () => {
    const oldProfile = deferred<Me>()
    const renewedProfile = { ...workerOne, displayName: 'Ayu Rahma' }
    const readMe = vi
      .fn<SessionApi['getMe']>()
      .mockResolvedValueOnce(workerOne)
      .mockImplementationOnce(async () => oldProfile.promise)
      .mockResolvedValueOnce(renewedProfile)
    const create = vi
      .fn<SessionApi['createSession']>()
      .mockResolvedValueOnce(sessionOne)
      .mockResolvedValueOnce({
        ...sessionOne,
        token: 'renewed-session',
        expiresAt: '2026-10-24T10:00:00.000Z',
      })
    const coordinator = new SessionCoordinator(api({ createSession: create, getMe: readMe }))
    await coordinator.updateAccount(account())
    const refresh = coordinator.refreshMe()
    await vi.waitFor(() => expect(readMe).toHaveBeenCalledTimes(2))

    vi.setSystemTime(new Date(sessionOne.expiresAt))
    await coordinator.ensureSession()
    oldProfile.resolve(workerOne)

    await expect(refresh).resolves.toBeNull()
    expect(coordinator.getSnapshot()).toMatchObject({ status: 'ready', user: renewedProfile })
  })

  it('notifies subscribers about state changes and stops after unsubscribe', async () => {
    const coordinator = new SessionCoordinator(api())
    const listener = vi.fn()
    const unsubscribe = coordinator.subscribe(listener)

    await coordinator.updateAccount({ ...account(), configured: false })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    await coordinator.updateAccount({ ...account(), ready: false })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('represents unconfigured, loading, and signed-out account states without exchanging a token', async () => {
    const create = vi.fn(async () => sessionOne)
    const coordinator = new SessionCoordinator(api({ createSession: create }))

    await coordinator.updateAccount({ ...account(), configured: false })
    expect(coordinator.getSnapshot().status).toBe('unconfigured')

    await coordinator.updateAccount({ ...account(), ready: false })
    expect(coordinator.getSnapshot().status).toBe('loading')

    await coordinator.updateAccount({ ...account(), authenticated: false, userId: null })
    expect(coordinator.getSnapshot().status).toBe('signed-out')
    expect(create).not.toHaveBeenCalled()
  })

  it('shares one session exchange between concurrent callers for the same identity', async () => {
    const pending = deferred<SessionResponse>()
    const create = vi.fn(async () => pending.promise)
    const coordinator = new SessionCoordinator(api({ createSession: create }))

    const update = coordinator.updateAccount(account())
    const first = coordinator.ensureSession()
    const second = coordinator.ensureSession()
    await Promise.resolve()
    expect(create).toHaveBeenCalledTimes(1)

    pending.resolve(sessionOne)
    await expect(Promise.all([update, first, second])).resolves.toEqual([
      undefined,
      'trickle-session-1',
      'trickle-session-1',
    ])
    expect(coordinator.getSnapshot()).toMatchObject({ status: 'ready', user: workerOne })
  })

  it('retries WALLET_NOT_READY with bounded 1, 2, 4, and 8 second delays', async () => {
    const create = vi
      .fn<SessionApi['createSession']>()
      .mockRejectedValueOnce(
        new ApiError('wallet-not-ready', 'Wallet pending', {
          status: 409,
          code: 'WALLET_NOT_READY',
        }),
      )
      .mockRejectedValueOnce(
        new ApiError('wallet-not-ready', 'Wallet pending', {
          status: 409,
          code: 'WALLET_NOT_READY',
        }),
      )
      .mockRejectedValueOnce(
        new ApiError('wallet-not-ready', 'Wallet pending', {
          status: 409,
          code: 'WALLET_NOT_READY',
        }),
      )
      .mockRejectedValueOnce(
        new ApiError('wallet-not-ready', 'Wallet pending', {
          status: 409,
          code: 'WALLET_NOT_READY',
        }),
      )
      .mockResolvedValueOnce(sessionOne)
    const delays: number[] = []
    const coordinator = new SessionCoordinator(
      api({ createSession: create, sleep: async (milliseconds) => void delays.push(milliseconds) }),
    )

    await coordinator.updateAccount(account())

    expect(delays).toEqual([1000, 2000, 4000, 8000])
    expect(create).toHaveBeenCalledTimes(5)
    expect(coordinator.getSnapshot().status).toBe('ready')
  })

  it('stops after the bounded wallet retries are exhausted', async () => {
    const create = vi.fn<SessionApi['createSession']>(async () => {
      throw new ApiError('wallet-not-ready', 'Wallet pending', {
        status: 409,
        code: 'WALLET_NOT_READY',
      })
    })
    const coordinator = new SessionCoordinator(api({ createSession: create }))

    await coordinator.updateAccount(account())

    expect(create).toHaveBeenCalledTimes(5)
    expect(coordinator.getSnapshot()).toMatchObject({ status: 'error', user: null })
  })

  it('recovers once when the first Trickle token is rejected with 401', async () => {
    const create = vi
      .fn<SessionApi['createSession']>()
      .mockResolvedValueOnce(sessionOne)
      .mockResolvedValueOnce({ ...sessionOne, token: 'trickle-session-2' })
    const readMe = vi
      .fn<SessionApi['getMe']>()
      .mockRejectedValueOnce(
        new ApiError('unauthorized', 'Expired', { status: 401, code: 'UNAUTHORIZED' }),
      )
      .mockResolvedValueOnce(workerOne)
    const coordinator = new SessionCoordinator(api({ createSession: create, getMe: readMe }))

    await coordinator.updateAccount(account())

    expect(create).toHaveBeenCalledTimes(2)
    expect(readMe).toHaveBeenCalledTimes(2)
    await expect(coordinator.ensureSession()).resolves.toBe('trickle-session-2')
  })

  it('refreshes the current backend profile without creating another session', async () => {
    const refreshed = { ...workerOne, displayName: 'Ayu Rahma' }
    const readMe = vi
      .fn<SessionApi['getMe']>()
      .mockResolvedValueOnce(workerOne)
      .mockResolvedValueOnce(refreshed)
    const create = vi.fn(async () => sessionOne)
    const coordinator = new SessionCoordinator(api({ createSession: create, getMe: readMe }))
    await coordinator.updateAccount(account())

    await expect(coordinator.refreshMe()).resolves.toEqual(refreshed)

    expect(create).toHaveBeenCalledTimes(1)
    expect(coordinator.getSnapshot()).toMatchObject({ status: 'ready', user: refreshed })
  })

  it('discards a late session response after the account identity changes', async () => {
    const first = deferred<SessionResponse>()
    const second = deferred<SessionResponse>()
    const create = vi
      .fn<SessionApi['createSession']>()
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise)
    const coordinator = new SessionCoordinator(
      api({
        createSession: create,
        getMe: async (token) =>
          token === 'second-token'
            ? { ...workerOne, id: 'user-2', displayName: 'Bima' }
            : workerOne,
      }),
    )

    const updateFirst = coordinator.updateAccount(account('did:privy:first'))
    await Promise.resolve()
    const updateSecond = coordinator.updateAccount(account('did:privy:second'))
    first.resolve(sessionOne)
    await updateFirst
    expect(coordinator.getSnapshot()).not.toMatchObject({ status: 'ready', user: workerOne })

    second.resolve({
      ...sessionOne,
      token: 'second-token',
      user: { ...sessionOne.user, id: 'user-2', displayName: 'Bima' },
    })
    await updateSecond
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'ready',
      user: { id: 'user-2', displayName: 'Bima' },
    })
    await expect(coordinator.ensureSession()).resolves.toBe('second-token')
  })

  it('clears local session state and logs out of Privy when server revoke fails', async () => {
    const revokeFailure = new ApiError('network', 'Offline')
    const logoutPrivy = vi.fn(async () => {})
    const coordinator = new SessionCoordinator(
      api({
        revokeSession: async () => {
          throw revokeFailure
        },
      }),
    )
    await coordinator.updateAccount(account())

    await expect(coordinator.logout(logoutPrivy)).rejects.toBe(revokeFailure)

    expect(logoutPrivy).toHaveBeenCalledTimes(1)
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'signed-out',
      user: null,
      logoutFailure: 'server',
    })
    await expect(coordinator.ensureSession()).resolves.toBeNull()
  })

  it('allows explicit recovery after a profile refresh fails', async () => {
    const readMe = vi
      .fn<SessionApi['getMe']>()
      .mockResolvedValueOnce(workerOne)
      .mockRejectedValueOnce(new ApiError('server', 'Unavailable', { status: 503 }))
      .mockResolvedValueOnce(workerOne)
    const create = vi.fn(async () => sessionOne)
    const coordinator = new SessionCoordinator(api({ createSession: create, getMe: readMe }))
    await coordinator.updateAccount(account())
    await expect(coordinator.refreshMe()).rejects.toMatchObject({ status: 503 })
    expect(coordinator.getSnapshot().status).toBe('error')
    await coordinator.ensureSession()
    expect(coordinator.getSnapshot().status).toBe('ready')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('reports Privy logout failure separately while keeping local tokens cleared', async () => {
    const coordinator = new SessionCoordinator(api())
    await coordinator.updateAccount(account())
    const failure = new Error('Privy unavailable')
    await expect(
      coordinator.logout(async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'signed-out',
      user: null,
      expiresAt: null,
      logoutFailure: 'privy',
    })
    await expect(coordinator.ensureSession()).resolves.toBeNull()
  })
})
