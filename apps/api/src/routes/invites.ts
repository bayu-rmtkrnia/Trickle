import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { Prisma, type Invite } from '../generated/prisma/client.js'
import { inviteCode } from '../lib/codes.js'
import { AppError, badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { Page, PageQuery, pageArgs, toPage } from '../lib/pagination.js'
import { errors } from '../lib/schemas.js'
import { centsToUsd } from './dto.js'

const InviteCode = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6,16}$/, 'invalid invite code'),
})

const CreateInvite = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('WORKER'),
    inviteeName: z.string().trim().min(1).max(100),
    monthlySalaryUsd: z
      .number()
      .positive()
      .max(1_000_000)
      .multipleOf(0.01)
      .describe('Gross monthly salary in USD, up to 2 decimals'),
  }),
  z.object({
    type: z.literal('FAMILY'),
    inviteeName: z.string().trim().min(1).max(100),
    relation: z.string().trim().min(1).max(40).optional().describe('e.g. "Ibu", "Istri"'),
  }),
])

const InviteDto = z
  .object({
    code: z.string(),
    type: z.enum(['WORKER', 'FAMILY']),
    status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']),
    inviteeName: z.string(),
    monthlySalaryUsd: z.number().nullable(),
    relation: z.string().nullable(),
    invitedBy: z.object({
      name: z.string().nullable().describe('Company name for WORKER, worker name for FAMILY'),
      address: z.string(),
    }),
    url: z.string().describe('Link to share with the invitee'),
    expiresAt: z.string(),
    acceptedAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .meta({ id: 'Invite' })

type InviteWithRefs = Invite & {
  createdBy: { address: string; displayName: string | null }
  employer: { name: string } | null
}

const invites: FastifyPluginAsyncZod = async (app) => {
  const { db, env } = app
  const security = [{ bearerAuth: [] }]
  const include = {
    createdBy: { select: { address: true, displayName: true } },
    employer: { select: { name: true } },
  } as const

  const toDto = (i: InviteWithRefs): z.infer<typeof InviteDto> => ({
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

  app.post(
    '/invites',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['Invites'],
        summary: 'Create a worker invite (employer) or a family invite (worker)',
        security,
        body: CreateInvite,
        response: { 201: InviteDto, ...errors(400, 401, 403, 422) },
      },
    },
    async (req, reply) => {
      const body = req.body
      const expiresAt = new Date(Date.now() + env.INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
      let data: Prisma.InviteUncheckedCreateInput

      if (body.type === 'WORKER') {
        const employer = await db.employer.findUnique({ where: { ownerId: req.user.sub } })
        if (!employer) throw forbidden('Create a company profile before inviting workers')
        data = {
          code: inviteCode(),
          type: 'WORKER',
          createdById: req.user.sub,
          employerId: employer.id,
          inviteeName: body.inviteeName,
          monthlySalaryCents: Math.round(body.monthlySalaryUsd * 100),
          expiresAt,
        }
      } else {
        const employments = await db.employerWorker.count({ where: { workerId: req.user.sub } })
        if (employments === 0) throw forbidden('Only workers with an employer can invite family')
        data = {
          code: inviteCode(),
          type: 'FAMILY',
          createdById: req.user.sub,
          inviteeName: body.inviteeName,
          relation: body.relation ?? null,
          expiresAt,
        }
      }

      const invite = await db.invite.create({ data, include })
      return reply.code(201).send(toDto(invite))
    },
  )

  app.get(
    '/invites',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['Invites'],
        summary: 'Invites created by the signed-in user',
        security,
        querystring: PageQuery.extend({ type: z.enum(['WORKER', 'FAMILY']).optional() }),
        response: { 200: Page(InviteDto), ...errors(401, 422) },
      },
    },
    async (req) => {
      const { type, ...page } = req.query
      const rows = await db.invite.findMany({
        where: { createdById: req.user.sub, type },
        include,
        ...pageArgs(page),
      })
      return toPage(rows, page.limit, toDto)
    },
  )

  app.get(
    '/invites/:code',
    {
      schema: {
        tags: ['Invites'],
        summary: 'Public invite details, shown before the invitee creates an account',
        params: InviteCode,
        response: { 200: InviteDto, ...errors(404, 422) },
      },
    },
    async (req) => {
      const invite = await db.invite.findUnique({ where: { code: req.params.code }, include })
      if (!invite) throw notFound('INVITE_NOT_FOUND', 'This invite link is not valid')
      return toDto(invite)
    },
  )

  app.post(
    '/invites/:code/accept',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['Invites'],
        summary: 'Accept an invite as the signed-in user',
        description:
          'WORKER invite: the user joins the company. FAMILY invite: the user is linked to the worker as a family recipient.',
        security,
        params: InviteCode,
        response: { 200: InviteDto, ...errors(400, 401, 404, 409, 410, 422) },
      },
    },
    async (req) => {
      const userId = req.user.sub
      const invite = await db.invite.findUnique({ where: { code: req.params.code }, include })
      if (!invite) throw notFound('INVITE_NOT_FOUND', 'This invite link is not valid')
      if (invite.status === 'ACCEPTED') {
        throw conflict('INVITE_ALREADY_ACCEPTED', 'This invite has already been used')
      }
      if (invite.status === 'REVOKED') {
        throw conflict('INVITE_REVOKED', 'This invite was cancelled by the sender')
      }
      if (invite.expiresAt < new Date()) {
        throw new AppError(410, 'INVITE_EXPIRED', 'This invite has expired. Ask for a new one.')
      }
      if (invite.createdById === userId) {
        throw badRequest('CANNOT_ACCEPT_OWN_INVITE', 'You cannot accept your own invite')
      }

      try {
        const accepted = await db.$transaction(async (tx) => {
          // Guarded update: only one request can flip PENDING -> ACCEPTED.
          const flipped = await tx.invite.updateMany({
            where: { id: invite.id, status: 'PENDING' },
            data: { status: 'ACCEPTED', acceptedById: userId, acceptedAt: new Date() },
          })
          if (flipped.count !== 1) {
            throw conflict('INVITE_ALREADY_ACCEPTED', 'This invite has already been used')
          }

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
          return tx.invite.findUniqueOrThrow({ where: { id: invite.id }, include })
        })
        return toDto(accepted)
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw conflict(
            'ALREADY_LINKED',
            invite.type === 'WORKER'
              ? 'You already work for this company'
              : 'You are already linked to this worker',
          )
        }
        throw err
      }
    },
  )
}

export default invites
