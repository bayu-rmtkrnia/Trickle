import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import type { Employer, User } from '../../generated/prisma/client.js'
import { Page, PageQuery } from '../../lib/pagination.js'
import { errors } from '../../lib/schemas.js'

const security = [{ bearerAuth: [] }]

export const EmployerInput = z.object({
  name: z.string().trim().min(2).max(100),
  country: z
    .string()
    .trim()
    .length(2)
    .toUpperCase()
    .optional()
    .describe('ISO 3166-1 alpha-2 country code, e.g. MY'),
})

export type EmployerInput = z.infer<typeof EmployerInput>

export const EmployerDto = z
  .object({
    id: z.string(),
    name: z.string(),
    country: z.string().nullable(),
    ownerAddress: z.string(),
    createdAt: z.string(),
  })
  .meta({ id: 'Employer' })

export const toEmployerDto = (e: Employer & { owner: Pick<User, 'address'> }) => ({
  id: e.id,
  name: e.name,
  country: e.country,
  ownerAddress: e.owner.address,
  createdAt: e.createdAt.toISOString(),
})

export const WorkerDto = z.object({
  id: z.string(),
  displayName: z.string(),
  address: z.string(),
  monthlySalaryUsd: z.number(),
  joinedAt: z.string(),
})

export const createEmployerSchema = {
  tags: ['Employers'],
  summary: 'Create the company profile for the signed-in user',
  security,
  body: EmployerInput,
  response: { 201: EmployerDto, ...errors(400, 401, 409, 422) },
} satisfies FastifySchema

export const getMyEmployerSchema = {
  tags: ['Employers'],
  summary: "The signed-in user's company profile",
  security,
  response: { 200: EmployerDto, ...errors(401, 404) },
} satisfies FastifySchema

export const updateMyEmployerSchema = {
  tags: ['Employers'],
  summary: 'Update the company profile',
  security,
  body: EmployerInput.partial(),
  response: { 200: EmployerDto, ...errors(400, 401, 404, 422) },
} satisfies FastifySchema

export const listMyWorkersSchema = {
  tags: ['Employers'],
  summary: 'Workers who accepted an invite from this company',
  description:
    'Metadata only. Stream balances come from the contract/indexer, never from this API.',
  security,
  querystring: PageQuery,
  response: { 200: Page(WorkerDto), ...errors(401, 404, 422) },
} satisfies FastifySchema
