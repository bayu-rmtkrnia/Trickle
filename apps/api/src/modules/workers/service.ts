import type { FastifyBaseLogger } from 'fastify'
import { badRequest, conflict, notFound } from '../../lib/errors.js'
import { toPage, type PageQuery } from '../../lib/pagination.js'
import type { StreamReader } from '../../lib/streams.js'
import type { WorkerRepository } from './repository.js'
import { toWorkerDto, type CreateWorkerInput, type WorkerInput } from './schemas.js'

export const workerNotFound = () => notFound('WORKER_NOT_FOUND', 'Worker not found')

/** Passed per call so log lines keep the request id. */
type Log = Pick<FastifyBaseLogger, 'warn'>

interface Deps {
  repo: WorkerRepository
  streams: Pick<StreamReader, 'hasActiveStream' | 'verified'>
}

const toCents = (usd: number) => Math.round(usd * 100)

/**
 * Methods taking a company or worker id assume the route already checked
 * ownership. They still answer 404 if the row vanished in between.
 */
export function createWorkerService({ repo, streams }: Deps) {
  async function find(id: string) {
    const worker = await repo.findActive(id)
    if (!worker) throw workerNotFound()
    return worker
  }

  return {
    async create(companyId: string, ownerId: string, input: CreateWorkerInput) {
      const user = await repo.findOrCreateUser(input.address)
      if (user.id === ownerId) {
        throw badRequest('CANNOT_EMPLOY_SELF', 'You cannot add yourself as a worker')
      }
      const existing = await repo.findMembership(companyId, user.id)
      if (existing && !existing.deletedAt) {
        throw conflict('WORKER_EXISTS', 'This person already works for your company')
      }
      const worker = await repo.upsert(companyId, user.id, {
        displayName: input.displayName,
        position: input.position ?? null,
        monthlySalaryCents: toCents(input.monthlySalaryUsd),
      })
      return toWorkerDto(worker)
    },

    async list(companyId: string, page: PageQuery) {
      const rows = await repo.list(companyId, page)
      return toPage(rows, page.limit, toWorkerDto)
    },

    async get(id: string) {
      return toWorkerDto(await find(id))
    },

    async update(id: string, input: Partial<WorkerInput>) {
      await find(id)
      const { monthlySalaryUsd, ...rest } = input
      const worker = await repo.update(id, {
        ...rest,
        ...(monthlySalaryUsd === undefined
          ? {}
          : { monthlySalaryCents: toCents(monthlySalaryUsd) }),
      })
      return toWorkerDto(worker)
    },

    async remove(id: string, log: Log) {
      const parties = await repo.findStreamParties(id)
      if (!parties) throw workerNotFound()
      if (await streams.hasActiveStream(parties.employer, parties.worker)) {
        throw conflict(
          'STREAM_ACTIVE',
          'This worker still has an active salary stream. Cancel the stream first.',
        )
      }
      if (!streams.verified) {
        log.warn({ workerId: id }, 'worker removed without an on-chain stream check')
      }
      await repo.softDelete(id)
    },
  }
}

export type WorkerService = ReturnType<typeof createWorkerService>
