import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import type { Company, User } from '../../generated/prisma/client.js'
import { Page, PageQuery } from '../../lib/pagination.js'
import { errors, IdParams } from '../../lib/schemas.js'

const security = [{ bearerAuth: [] }]
const tags = ['Companies']

export const CompanyInput = z.object({
  name: z.string().trim().min(2).max(100),
  country: z
    .string()
    .trim()
    .length(2)
    .toUpperCase()
    .optional()
    .describe('ISO 3166-1 alpha-2 country code, e.g. MY'),
})

export type CompanyInput = z.infer<typeof CompanyInput>

export const CompanyDto = z
  .object({
    id: z.string(),
    name: z.string(),
    country: z.string().nullable(),
    ownerAddress: z.string(),
    createdAt: z.string(),
  })
  .meta({ id: 'Company' })

export type CompanyWithOwner = Company & { owner: Pick<User, 'address'> }

export const toCompanyDto = (c: CompanyWithOwner) => ({
  id: c.id,
  name: c.name,
  country: c.country,
  ownerAddress: c.owner.address,
  createdAt: c.createdAt.toISOString(),
})

export const WorkerDto = z.object({
  id: z.string(),
  displayName: z.string(),
  address: z.string(),
  monthlySalaryUsd: z.number(),
  joinedAt: z.string(),
})

export const createCompanySchema = {
  tags,
  summary: 'Create a company (makes the caller an employer)',
  description:
    'One active company per account. The new id is also returned as `companyId` by `GET /api/v1/users/me`.',
  security,
  body: CompanyInput,
  response: { 201: CompanyDto, ...errors(400, 401, 409, 422) },
} satisfies FastifySchema

export const getCompanySchema = {
  tags,
  summary: 'Get a company I own',
  security,
  params: IdParams,
  response: { 200: CompanyDto, ...errors(401, 403, 404, 422) },
} satisfies FastifySchema

export const updateCompanySchema = {
  tags,
  summary: 'Update a company I own',
  security,
  params: IdParams,
  body: CompanyInput.partial(),
  response: { 200: CompanyDto, ...errors(400, 401, 403, 404, 422) },
} satisfies FastifySchema

export const deleteCompanySchema = {
  tags,
  summary: 'Delete a company I own (soft delete)',
  description:
    'Refused with 409 `COMPANY_HAS_WORKERS` while workers are still linked. Pending invites are revoked. ' +
    'The row is kept for history, but the company disappears from the API and the caller can create a new one.',
  security,
  params: IdParams,
  response: { 204: z.null().describe('Deleted'), ...errors(401, 403, 404, 409, 422) },
} satisfies FastifySchema

export const listCompanyWorkersSchema = {
  tags,
  summary: 'Workers who accepted an invite from this company',
  description:
    'Metadata only. Stream balances come from the contract/indexer, never from this API.',
  security,
  params: IdParams,
  querystring: PageQuery,
  response: { 200: Page(WorkerDto), ...errors(401, 403, 404, 422) },
} satisfies FastifySchema
