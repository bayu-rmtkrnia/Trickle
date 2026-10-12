import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import type { Worker } from '../../generated/prisma/client.js'
import { centsToUsd } from '../../lib/money.js'
import { Page, PageQuery } from '../../lib/pagination.js'
import { Address, errors, IdParams } from '../../lib/schemas.js'

const security = [{ bearerAuth: [] }]
const tags = ['Workers']

const salary = z
  .number()
  .positive()
  .max(1_000_000)
  .describe('Reference monthly salary in USD, shown in the UI. Pay itself is the on-chain stream')

export const WorkerInput = z.object({
  displayName: z.string().trim().min(1).max(80),
  position: z.string().trim().min(1).max(80).nullable().optional().describe('Job title'),
  monthlySalaryUsd: salary,
})

export const CreateWorkerInput = WorkerInput.extend({
  address: Address.describe("The worker's Trickle (Privy embedded) wallet address"),
})

export type WorkerInput = z.infer<typeof WorkerInput>
export type CreateWorkerInput = z.infer<typeof CreateWorkerInput>

export const WorkerDto = z
  .object({
    id: z.string(),
    companyId: z.string(),
    userId: z.string(),
    address: z.string(),
    displayName: z.string(),
    position: z.string().nullable(),
    monthlySalaryUsd: z.number(),
    joinedAt: z.string(),
  })
  .meta({ id: 'Worker' })

export type WorkerWithUser = Worker & { user: { address: string } }

export const toWorkerDto = (w: WorkerWithUser) => ({
  id: w.id,
  companyId: w.companyId,
  userId: w.userId,
  address: w.user.address,
  displayName: w.displayName,
  position: w.position,
  monthlySalaryUsd: centsToUsd(w.monthlySalaryCents),
  joinedAt: w.createdAt.toISOString(),
})

export const createWorkerSchema = {
  tags,
  summary: 'Add a worker to my company by wallet address',
  description:
    'Alternative to a worker invite when the employer already knows the address. ' +
    'Re-adding a removed worker restores them. 409 `WORKER_EXISTS` if they already work here.',
  security,
  params: IdParams,
  body: CreateWorkerInput,
  response: { 201: WorkerDto, ...errors(400, 401, 403, 404, 409, 422) },
} satisfies FastifySchema

export const listWorkersSchema = {
  tags,
  summary: "My company's workers",
  description:
    'Metadata only. Stream balances come from the contract/indexer, never from this API.',
  security,
  params: IdParams,
  querystring: PageQuery,
  response: { 200: Page(WorkerDto), ...errors(401, 403, 404, 422) },
} satisfies FastifySchema

export const getWorkerSchema = {
  tags,
  summary: 'Get a worker (their employer, or the worker themself)',
  security,
  params: IdParams,
  response: { 200: WorkerDto, ...errors(401, 403, 404, 422) },
} satisfies FastifySchema

export const updateWorkerSchema = {
  tags,
  summary: 'Update a worker of my company',
  security,
  params: IdParams,
  body: WorkerInput.partial(),
  response: { 200: WorkerDto, ...errors(400, 401, 403, 404, 422) },
} satisfies FastifySchema

export const deleteWorkerSchema = {
  tags,
  summary: 'Remove a worker from my company (soft delete)',
  description:
    'Refused with 409 `STREAM_ACTIVE` while the employer still streams salary to this worker on-chain. Cancel the stream first.',
  security,
  params: IdParams,
  response: { 204: z.null().describe('Removed'), ...errors(401, 403, 404, 409, 422) },
} satisfies FastifySchema
