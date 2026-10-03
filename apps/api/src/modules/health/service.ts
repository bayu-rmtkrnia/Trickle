import type { HealthRepository } from './repository.js'
import type { Health } from './schemas.js'

export function createHealthService(repo: HealthRepository) {
  return {
    async check(): Promise<Health> {
      let db: Health['db'] = 'ok'
      try {
        await repo.ping()
      } catch {
        db = 'down'
      }
      return {
        status: db === 'ok' ? 'ok' : 'degraded',
        db,
        uptimeSeconds: Math.round(process.uptime()),
        time: new Date().toISOString(),
      }
    },
  }
}

export type HealthService = ReturnType<typeof createHealthService>
