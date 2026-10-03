import { describe, expect, it } from 'vitest'
import { createHealthService } from '../src/modules/health/service.js'

describe('health service', () => {
  it('reports ok when the database answers', async () => {
    const service = createHealthService({ ping: async () => {} })
    await expect(service.check()).resolves.toMatchObject({ status: 'ok', db: 'ok' })
  })

  it('reports degraded when the database is down', async () => {
    const service = createHealthService({
      ping: async () => {
        throw new Error('connection refused')
      },
    })
    await expect(service.check()).resolves.toMatchObject({ status: 'degraded', db: 'down' })
  })
})
