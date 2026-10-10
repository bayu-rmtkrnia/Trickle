import { describe, expect, it, vi } from 'vitest'
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
  roles: { employer: false, worker: true, family: false },
}

function account(userId = 'did:privy:worker-1'): SessionAccount {
  return {
    configured: true,
    ready: true,
    authenticated: true,
    userId,
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
    expect(coordinator.getSnapshot()).toMatchObject({ status: 'signed-out', user: null })
    await expect(coordinator.ensureSession()).resolves.toBeNull()
  })
})
