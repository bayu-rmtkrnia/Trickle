import { pageArgs, type PageQuery } from '../../lib/pagination.js'
import type { Db } from '../../lib/prisma.js'
import type { CompanyInput, CompanyWithOwner } from './schemas.js'

const withOwner = { owner: { select: { address: true } } } as const
/** Soft-deleted companies are invisible to every read. */
const active = { deletedAt: null }

export function createCompanyRepository(db: Db) {
  return {
    async findActiveByOwner(ownerId: string) {
      return db.company.findFirst({ where: { ownerId, ...active }, select: { id: true } })
    },

    /** Owner of an active company, or null. Used by `app.requireOwnership`. */
    async findOwnerId(id: string) {
      const company = await db.company.findFirst({
        where: { id, ...active },
        select: { ownerId: true },
      })
      return company?.ownerId ?? null
    },

    async findActive(id: string): Promise<CompanyWithOwner | null> {
      return db.company.findFirst({ where: { id, ...active }, include: withOwner })
    },

    async create(ownerId: string, data: CompanyInput): Promise<CompanyWithOwner> {
      return db.company.create({ data: { ...data, ownerId }, include: withOwner })
    },

    async update(id: string, data: Partial<CompanyInput>): Promise<CompanyWithOwner> {
      return db.company.update({ where: { id }, data, include: withOwner })
    },

    async countWorkers(companyId: string) {
      return db.employerWorker.count({ where: { companyId } })
    },

    /** Marks the company deleted and revokes its pending invites in one transaction. */
    async softDelete(id: string) {
      await db.$transaction([
        db.company.update({ where: { id }, data: { deletedAt: new Date() } }),
        db.invite.updateMany({
          where: { companyId: id, status: 'PENDING' },
          data: { status: 'REVOKED' },
        }),
      ])
    },

    /** One page of workers, plus one extra row for `toPage` to detect the next page. */
    async listWorkers(companyId: string, page: PageQuery) {
      return db.employerWorker.findMany({
        where: { companyId },
        include: { worker: { select: { address: true } } },
        ...pageArgs(page),
      })
    },
  }
}

export type CompanyRepository = ReturnType<typeof createCompanyRepository>
