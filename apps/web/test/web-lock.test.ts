import { afterEach, describe, expect, it } from 'vitest'
import { createWebLock } from '@/lib/chain/web-lock'

/** Minimal Web Locks stand-in: one holder per name, `ifAvailable` returns null. */
function fakeLocks() {
  const held = new Set<string>()
  return {
    async request(
      name: string,
      options: { ifAvailable?: boolean },
      callback: (lock: { name: string } | null) => Promise<unknown>,
    ) {
      if (held.has(name)) return callback(null)
      held.add(name)
      try {
        return await callback({ name })
      } finally {
        held.delete(name)
      }
    },
  }
}
function install(value: unknown) {
  Object.defineProperty(globalThis.navigator, 'locks', { configurable: true, value })
}
afterEach(() => install(undefined))

describe('cross-tab web lock', () => {
  it('runs for the first holder and refuses a second while held', async () => {
    install(fakeLocks())
    const lock = createWebLock('trickle:test')
    let release!: () => void
    const first = lock(() => new Promise<string>((done) => (release = () => done('one'))))
    await expect(lock(async () => 'two')).resolves.toEqual({ acquired: false })
    release()
    await expect(first).resolves.toEqual({ acquired: true, value: 'one' })
    await expect(lock(async () => 'three')).resolves.toEqual({ acquired: true, value: 'three' })
  })

  it('propagates errors and releases the lock', async () => {
    install(fakeLocks())
    const lock = createWebLock('trickle:test')
    await expect(
      lock(async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    await expect(lock(async () => 1)).resolves.toEqual({ acquired: true, value: 1 })
  })

  it('refuses instead of running unlocked when Web Locks is missing', async () => {
    install(undefined)
    await expect(createWebLock('trickle:test')(async () => 1)).rejects.toMatchObject({
      code: 'LOCK_UNAVAILABLE',
    })
  })
})
