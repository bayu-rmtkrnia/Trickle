import type { FastifyBaseLogger } from 'fastify'
import { unauthorized } from '../../lib/errors.js'
import type { StreamReader } from '../../lib/streams.js'
import { companyNotFound } from '../companies/service.js'
import type { StreamRepository } from './repository.js'
import { toStreamFields, type StreamPageQuery } from './schemas.js'

/** Passed per call so log lines keep the request id. */
type Log = Pick<FastifyBaseLogger, 'warn'>

interface Deps {
  repo: StreamRepository
  streams: Pick<StreamReader, 'syncNew'>
  now?: () => Date
}

export function createStreamService({ repo, streams, now = () => new Date() }: Deps) {
  /** Catches streams created since the last indexer round. A failing RPC only makes the list stale. */
  async function catchUp(log: Log) {
    try {
      await streams.syncNew()
    } catch (err) {
      log.warn({ err }, 'stream list served from the cache: indexer catch-up failed')
    }
  }

  /** `toPage` for stream rows: the cursor is the last id on the page. */
  function page<T>(rows: { id: bigint }[], limit: number, items: T[]) {
    const hasMore = rows.length > limit
    return {
      data: items.slice(0, limit),
      nextCursor: hasMore ? (rows[limit - 1]?.id.toString() ?? null) : null,
    }
  }

  return {
    /** Assumes the route already checked that the caller owns the company. */
    async listForCompany(companyId: string, query: StreamPageQuery, log: Log) {
      const owner = await repo.findCompanyOwner(companyId)
      if (!owner) throw companyNotFound()
      await catchUp(log)
      const rows = await repo.listByEmployer(owner.address, query)
      const workers = await repo.findWorkers(companyId, [...new Set(rows.map((r) => r.worker))])
      const at = now()
      return page(
        rows,
        query.limit,
        rows.map((r) => ({ ...toStreamFields(r, at), worker: workers.get(r.worker) ?? null })),
      )
    },

    async listMine(userId: string, query: StreamPageQuery, log: Log) {
      const address = await repo.findAddress(userId)
      if (!address) throw unauthorized('Account no longer exists. Sign in again.')
      await catchUp(log)
      const rows = await repo.listByWorker(address, query)
      const companies = await repo.findCompanies([...new Set(rows.map((r) => r.employer))])
      const at = now()
      return page(
        rows,
        query.limit,
        rows.map((r) => ({ ...toStreamFields(r, at), company: companies.get(r.employer) ?? null })),
      )
    },
  }
}

export type StreamService = ReturnType<typeof createStreamService>
