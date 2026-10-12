import type { Stream } from '../../generated/prisma/client.js'
import type { Db } from '../../lib/prisma.js'
import type { StreamPageQuery } from './schemas.js'

/** Newest first. Ids are sequential on-chain, so `id < cursor` is the next page. */
const pageArgs = ({ limit, cursor }: StreamPageQuery) => ({
  ...(cursor ? { where: { id: { lt: BigInt(cursor) } } } : {}),
  take: limit + 1,
  orderBy: { id: 'desc' as const },
})

export function createStreamRepository(db: Db) {
  async function list(filter: { employer?: string; worker?: string }, page: StreamPageQuery) {
    const { where, ...rest } = pageArgs(page)
    return db.stream.findMany({ where: { ...filter, ...where }, ...rest })
  }

  return {
    /** Owner id and wallet of an active company, or null. Guards `/companies/:id/streams`. */
    async findCompanyOwner(companyId: string) {
      const company = await db.company.findFirst({
        where: { id: companyId, deletedAt: null },
        select: { ownerId: true, owner: { select: { address: true } } },
      })
      return company && { ownerId: company.ownerId, address: company.owner.address }
    },

    async findAddress(userId: string) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { address: true } })
      return user?.address ?? null
    },

    async listByEmployer(employer: string, page: StreamPageQuery): Promise<Stream[]> {
      return list({ employer }, page)
    },

    async listByWorker(worker: string, page: StreamPageQuery): Promise<Stream[]> {
      return list({ worker }, page)
    },

    /** Active workers of `companyId` among `addresses`, keyed by address. */
    async findWorkers(companyId: string, addresses: string[]) {
      const rows = await db.worker.findMany({
        where: { companyId, deletedAt: null, user: { address: { in: addresses } } },
        select: { id: true, displayName: true, user: { select: { address: true } } },
      })
      return new Map(rows.map((w) => [w.user.address, { id: w.id, displayName: w.displayName }]))
    },

    /** The active company owned by each of `addresses`, keyed by address. */
    async findCompanies(addresses: string[]) {
      const rows = await db.company.findMany({
        where: { deletedAt: null, owner: { address: { in: addresses } } },
        select: { id: true, name: true, owner: { select: { address: true } } },
      })
      return new Map(rows.map((c) => [c.owner.address, { id: c.id, name: c.name }]))
    },
  }
}

export type StreamRepository = ReturnType<typeof createStreamRepository>
