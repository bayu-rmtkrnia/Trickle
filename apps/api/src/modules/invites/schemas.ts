import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { Page, PageQuery } from '../../lib/pagination.js'
import { errors } from '../../lib/schemas.js'

const security = [{ bearerAuth: [] }]

export const InviteCode = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6,16}$/, 'invalid invite code'),
})

export const CreateInvite = z.discriminatedUnion('type', [
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

export type CreateInvite = z.infer<typeof CreateInvite>

export const InviteType = z.enum(['WORKER', 'FAMILY'])

export const InviteDto = z
  .object({
    code: z.string(),
    type: InviteType,
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

export type InviteDto = z.infer<typeof InviteDto>

export const createInviteSchema = {
  tags: ['Invites'],
  summary: 'Create a worker invite (employer) or a family invite (worker)',
  security,
  body: CreateInvite,
  response: { 201: InviteDto, ...errors(400, 401, 403, 422) },
} satisfies FastifySchema

export const listInvitesSchema = {
  tags: ['Invites'],
  summary: 'Invites created by the signed-in user',
  security,
  querystring: PageQuery.extend({ type: InviteType.optional() }),
  response: { 200: Page(InviteDto), ...errors(401, 422) },
} satisfies FastifySchema

export const getInviteSchema = {
  tags: ['Invites'],
  summary: 'Public invite details, shown before the invitee creates an account',
  params: InviteCode,
  response: { 200: InviteDto, ...errors(404, 422) },
} satisfies FastifySchema

export const acceptInviteSchema = {
  tags: ['Invites'],
  summary: 'Accept an invite as the signed-in user',
  description:
    'WORKER invite: the user joins the company. FAMILY invite: the user is linked to the worker as a family recipient.',
  security,
  params: InviteCode,
  response: { 200: InviteDto, ...errors(400, 401, 404, 409, 410, 422) },
} satisfies FastifySchema
