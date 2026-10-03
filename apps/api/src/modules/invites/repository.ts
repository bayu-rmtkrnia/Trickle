import { Prisma, type Invite, type InviteType } from '../../generated/prisma/client.js'
import { pageArgs, type PageQuery } from '../../lib/pagination.js'
import type { Db } from '../../lib/prisma.js'

const include = {
  createdBy: { select: { address: true, displayName: true } },
  employer: { select: { name: true } },
} as const

export type InviteWithRefs = Invite & {
  createdBy: { address: string; displayName: string | null }
  employer: { name: string } | null
}

/** Outcome of an accept attempt; the service turns each one into a response. */
export type AcceptResult =
  | { status: 'accepted'; invite: InviteWithRefs }
  | { status: 'already-accepted' }
  | { status: 'already-linked' }

export function createInviteRepository(db: Db) {
  return {
    async findEmployerIdByOwner(ownerId: string) {
      const employer = await db.employer.findUnique({ where: { ownerId }, select: { id: true } })
      return employer?.id ?? null
    },

    async countEmployments(workerId: string) {
      return db.employerWorker.count({ where: { workerId } })
    },

    async create(data: Prisma.InviteUncheckedCreateInput): Promise<InviteWithRefs> {
      return db.invite.create({ data, include })
    },

    async listByCreator(createdById: string, type: InviteType | undefined, page: PageQuery) {
      return db.invite.findMany({ where: { createdById, type }, include, ...pageArgs(page) })
    },

    async findByCode(code: string): Promise<InviteWithRefs | null> {
      return db.invite.findUnique({ where: { code }, include })
    },

    /**
     * Flips the invite to ACCEPTED and creates the employment or family link in
     * one transaction. Only one concurrent request can win the flip.
     */
    async accept(invite: Invite, userId: string): Promise<AcceptResult> {
      try {
        return await db.$transaction(async (tx): Promise<AcceptResult> => {
          // Guarded update: only one request can flip PENDING -> ACCEPTED.
          const flipped = await tx.invite.updateMany({
            where: { id: invite.id, status: 'PENDING' },
            data: { status: 'ACCEPTED', acceptedById: userId, acceptedAt: new Date() },
          })
          if (flipped.count !== 1) return { status: 'already-accepted' }

          if (invite.type === 'WORKER') {
            await tx.employerWorker.create({
              data: {
                employerId: invite.employerId!,
                workerId: userId,
                displayName: invite.inviteeName,
                monthlySalaryCents: invite.monthlySalaryCents!,
              },
            })
          } else {
            await tx.familyLink.create({
              data: {
                workerId: invite.createdById,
                relativeId: userId,
                displayName: invite.inviteeName,
                relation: invite.relation,
              },
            })
          }
          // Name the account after the invite if it has no name yet.
          await tx.user.updateMany({
            where: { id: userId, displayName: null },
            data: { displayName: invite.inviteeName },
          })
          const accepted = await tx.invite.findUniqueOrThrow({ where: { id: invite.id }, include })
          return { status: 'accepted', invite: accepted }
        })
      } catch (err) {
        // The unique constraint on the link rolls the whole transaction back.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return { status: 'already-linked' }
        }
        throw err
      }
    },
  }
}

export type InviteRepository = ReturnType<typeof createInviteRepository>
