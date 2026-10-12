import { pageArgs, type PageQuery } from '../../lib/pagination.js'
import type { Db } from '../../lib/prisma.js'
import type { WorkerWithUser } from './schemas.js'

const withUser = { user: { select: { address: true } } } as const
/** A worker is visible while neither they nor their company is soft-deleted. */
const active = { deletedAt: null, company: { deletedAt: null } }

type WorkerData = { displayName: string; position?: string | null; monthlySalaryCents: number }

export function createWorkerRepository(db: Db) {
  return {
    /** Owner of an active company, or null. Guards `/companies/:id/workers`. */
    async findCompanyOwnerId(companyId: string) {
      const company = await db.company.findFirst({
        where: { id: companyId, deletedAt: null },
        select: { ownerId: true },
      })
      return company?.ownerId ?? null
    },

    /** Who may read an active worker: the company owner and the worker themself. */
    async findAccess(id: string) {
      const worker = await db.worker.findFirst({
        where: { id, ...active },
        select: { userId: true, company: { select: { ownerId: true } } },
      })
      return worker && { ownerId: worker.company.ownerId, userId: worker.userId }
    },

    async findActive(id: string): Promise<WorkerWithUser | null> {
      return db.worker.findFirst({ where: { id, ...active }, include: withUser })
    },

    /** Addresses of both ends of the payroll stream. */
    async findStreamParties(id: string) {
      const worker = await db.worker.findFirst({
        where: { id, ...active },
        select: {
          user: { select: { address: true } },
          company: { select: { owner: { select: { address: true } } } },
        },
      })
      return (
        worker && {
          employer: worker.company.owner.address as `0x${string}`,
          worker: worker.user.address as `0x${string}`,
        }
      )
    },

    /** The user behind an address, created if they never signed in (linked on first Privy login). */
    async findOrCreateUser(address: `0x${string}`) {
      return db.user.upsert({ where: { address }, create: { address }, update: {} })
    },

    async findMembership(companyId: string, userId: string) {
      return db.worker.findUnique({
        where: { companyId_userId: { companyId, userId } },
        select: { id: true, deletedAt: true },
      })
    },

    /** Creates the worker, or restores a removed one with fresh data. */
    async upsert(companyId: string, userId: string, data: WorkerData): Promise<WorkerWithUser> {
      return db.worker.upsert({
        where: { companyId_userId: { companyId, userId } },
        create: { companyId, userId, ...data },
        update: { ...data, deletedAt: null, createdAt: new Date() },
        include: withUser,
      })
    },

    async update(id: string, data: Partial<WorkerData>): Promise<WorkerWithUser> {
      return db.worker.update({ where: { id }, data, include: withUser })
    },

    async softDelete(id: string) {
      await db.worker.update({ where: { id }, data: { deletedAt: new Date() } })
    },

    async list(companyId: string, page: PageQuery): Promise<WorkerWithUser[]> {
      return db.worker.findMany({
        where: { companyId, deletedAt: null },
        include: withUser,
        ...pageArgs(page),
      })
    },
  }
}

export type WorkerRepository = ReturnType<typeof createWorkerRepository>
