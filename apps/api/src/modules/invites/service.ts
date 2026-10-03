import type { Env } from '../../env.js'
import type { InviteType, Prisma } from '../../generated/prisma/client.js'
import { inviteCode } from '../../lib/codes.js'
import { AppError, badRequest, conflict, forbidden, notFound } from '../../lib/errors.js'
import { centsToUsd } from '../../lib/money.js'
import { toPage, type PageQuery } from '../../lib/pagination.js'
import type { InviteRepository, InviteWithRefs } from './repository.js'
import type { CreateInvite, InviteDto } from './schemas.js'

const DAY_MS = 24 * 60 * 60 * 1000
const invalidLink = () => notFound('INVITE_NOT_FOUND', 'This invite link is not valid')
const alreadyAccepted = () =>
  conflict('INVITE_ALREADY_ACCEPTED', 'This invite has already been used')

interface Deps {
  repo: InviteRepository
  env: Pick<Env, 'INVITE_TTL_DAYS' | 'WEB_URL'>
}

export function createInviteService({ repo, env }: Deps) {
  const toDto = (i: InviteWithRefs): InviteDto => ({
    code: i.code,
    type: i.type,
    status: i.status === 'PENDING' && i.expiresAt < new Date() ? 'EXPIRED' : i.status,
    inviteeName: i.inviteeName,
    monthlySalaryUsd: i.monthlySalaryCents === null ? null : centsToUsd(i.monthlySalaryCents),
    relation: i.relation,
    invitedBy: {
      name: i.type === 'WORKER' ? (i.employer?.name ?? null) : i.createdBy.displayName,
      address: i.createdBy.address,
    },
    url: `${env.WEB_URL}/${i.type === 'WORKER' ? 'w' : 'f'}/invite/${i.code}`,
    expiresAt: i.expiresAt.toISOString(),
    acceptedAt: i.acceptedAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  })

  return {
    async create(userId: string, body: CreateInvite) {
      const expiresAt = new Date(Date.now() + env.INVITE_TTL_DAYS * DAY_MS)
      let data: Prisma.InviteUncheckedCreateInput

      if (body.type === 'WORKER') {
        const employerId = await repo.findEmployerIdByOwner(userId)
        if (!employerId) throw forbidden('Create a company profile before inviting workers')
        data = {
          code: inviteCode(),
          type: 'WORKER',
          createdById: userId,
          employerId,
          inviteeName: body.inviteeName,
          monthlySalaryCents: Math.round(body.monthlySalaryUsd * 100),
          expiresAt,
        }
      } else {
        if ((await repo.countEmployments(userId)) === 0) {
          throw forbidden('Only workers with an employer can invite family')
        }
        data = {
          code: inviteCode(),
          type: 'FAMILY',
          createdById: userId,
          inviteeName: body.inviteeName,
          relation: body.relation ?? null,
          expiresAt,
        }
      }

      return toDto(await repo.create(data))
    },

    async listMine(userId: string, type: InviteType | undefined, page: PageQuery) {
      const rows = await repo.listByCreator(userId, type, page)
      return toPage(rows, page.limit, toDto)
    },

    async getByCode(code: string) {
      const invite = await repo.findByCode(code)
      if (!invite) throw invalidLink()
      return toDto(invite)
    },

    async accept(code: string, userId: string) {
      const invite = await repo.findByCode(code)
      if (!invite) throw invalidLink()
      if (invite.status === 'ACCEPTED') throw alreadyAccepted()
      if (invite.status === 'REVOKED') {
        throw conflict('INVITE_REVOKED', 'This invite was cancelled by the sender')
      }
      if (invite.expiresAt < new Date()) {
        throw new AppError(410, 'INVITE_EXPIRED', 'This invite has expired. Ask for a new one.')
      }
      if (invite.createdById === userId) {
        throw badRequest('CANNOT_ACCEPT_OWN_INVITE', 'You cannot accept your own invite')
      }

      const result = await repo.accept(invite, userId)
      switch (result.status) {
        case 'accepted':
          return toDto(result.invite)
        case 'already-accepted':
          throw alreadyAccepted()
        case 'already-linked':
          throw conflict(
            'ALREADY_LINKED',
            invite.type === 'WORKER'
              ? 'You already work for this company'
              : 'You are already linked to this worker',
          )
      }
    },
  }
}

export type InviteService = ReturnType<typeof createInviteService>
