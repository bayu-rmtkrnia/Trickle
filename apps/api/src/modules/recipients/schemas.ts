import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import type { Recipient } from '../../generated/prisma/client.js'
import { Page, PageQuery } from '../../lib/pagination.js'
import { Address, errors, IdParams } from '../../lib/schemas.js'

const security = [{ bearerAuth: [] }]
const tags = ['Recipients']

export const RecipientInput = z.object({
  displayName: z.string().trim().min(1).max(80),
  relation: z.string().trim().min(1).max(40).nullable().optional().describe('e.g. "Ibu", "Istri"'),
})

export const CreateRecipientInput = RecipientInput.extend({
  address: Address.describe("The recipient's Trickle (Privy embedded) wallet address"),
})

export type RecipientInput = z.infer<typeof RecipientInput>
export type CreateRecipientInput = z.infer<typeof CreateRecipientInput>

export const RecipientDto = z
  .object({
    id: z.string(),
    ownerId: z.string().describe('User id of the worker who owns this entry'),
    userId: z.string(),
    address: z.string().describe('Pass this address as `recipient` to `setSplit`'),
    displayName: z.string(),
    relation: z.string().nullable(),
    addedAt: z.string(),
  })
  .meta({ id: 'Recipient' })

export type RecipientWithUser = Recipient & { user: { address: string } }

export const toRecipientDto = (r: RecipientWithUser) => ({
  id: r.id,
  ownerId: r.ownerId,
  userId: r.userId,
  address: r.user.address,
  displayName: r.displayName,
  relation: r.relation,
  addedAt: r.createdAt.toISOString(),
})

export const createRecipientSchema = {
  tags,
  summary: 'Add a family recipient by wallet address (worker)',
  description:
    'Alternative to a RECIPIENT invite when the worker already knows the address. ' +
    'Re-adding a removed recipient restores them. 409 `RECIPIENT_EXISTS` if already added.',
  security,
  body: CreateRecipientInput,
  response: { 201: RecipientDto, ...errors(400, 401, 403, 409, 422) },
} satisfies FastifySchema

export const listRecipientsSchema = {
  tags,
  summary: 'My recipients (worker)',
  description: 'Metadata only. The split percentage lives on-chain (`splitOf`).',
  security,
  querystring: PageQuery,
  response: { 200: Page(RecipientDto), ...errors(401, 403, 422) },
} satisfies FastifySchema

export const getRecipientSchema = {
  tags,
  summary: 'Get a recipient (their worker, or the recipient themself)',
  security,
  params: IdParams,
  response: { 200: RecipientDto, ...errors(401, 403, 404, 422) },
} satisfies FastifySchema

export const updateRecipientSchema = {
  tags,
  summary: 'Update one of my recipients',
  security,
  params: IdParams,
  body: RecipientInput.partial(),
  response: { 200: RecipientDto, ...errors(400, 401, 403, 404, 422) },
} satisfies FastifySchema

export const deleteRecipientSchema = {
  tags,
  summary: 'Remove one of my recipients (soft delete)',
  description:
    "Refused with 409 `SPLIT_ACTIVE` while the worker's on-chain split still sends to this recipient. " +
    'Call `setSplit(0x0, 0)` or point the split elsewhere first.',
  security,
  params: IdParams,
  response: { 204: z.null().describe('Removed'), ...errors(401, 403, 404, 409, 422) },
} satisfies FastifySchema
