import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import type { User, Worker } from '../../generated/prisma/client.js'
import { centsToUsd } from '../../lib/money.js'
import { Page, PageQuery } from '../../lib/pagination.js'
import { errors } from '../../lib/schemas.js'
import { CompanyDto, toCompanyDto, type CompanyWithOwner } from '../companies/schemas.js'

const security = [{ bearerAuth: [] }]

export const UserDto = z
  .object({
    id: z.string(),
    address: z.string(),
    displayName: z.string().nullable(),
    createdAt: z.string(),
  })
  .meta({ id: 'User' })

export const toUserDto = (u: User) => ({
  id: u.id,
  address: u.address,
  displayName: u.displayName,
  createdAt: u.createdAt.toISOString(),
})

export const MeDto = UserDto.extend({
  companyId: z
    .string()
    .nullable()
    .describe('My active company, for `/api/v1/companies/{id}`. `null` if I am not an employer'),
  roles: z.object({
    employer: z.boolean(),
    worker: z.boolean(),
    recipient: z.boolean().describe("Receives part of a worker's salary (family)"),
  }),
}).meta({ id: 'Me' })

export const UpdateMeInput = z.object({
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .nullable()
    .describe('Name shown to employers and recipients. `null` clears it'),
})

export type UpdateMeInput = z.infer<typeof UpdateMeInput>

export const getMeSchema = {
  tags: ['Users'],
  summary: 'Current user and the roles they hold',
  security,
  response: { 200: MeDto, ...errors(401) },
} satisfies FastifySchema

export const updateMeSchema = {
  tags: ['Users'],
  summary: 'Update my profile',
  security,
  body: UpdateMeInput,
  response: { 200: MeDto, ...errors(400, 401, 422) },
} satisfies FastifySchema

export const EmploymentDto = z
  .object({
    id: z.string().describe('Worker id, for `/api/v1/workers/{id}`'),
    displayName: z.string().describe('My name as this employer knows me'),
    position: z.string().nullable(),
    monthlySalaryUsd: z.number(),
    joinedAt: z.string(),
    employer: CompanyDto,
  })
  .meta({ id: 'Employment' })

export type EmploymentRow = Worker & { company: CompanyWithOwner }

export const toEmploymentDto = (w: EmploymentRow) => ({
  id: w.id,
  displayName: w.displayName,
  position: w.position,
  monthlySalaryUsd: centsToUsd(w.monthlySalaryCents),
  joinedAt: w.createdAt.toISOString(),
  employer: toCompanyDto(w.company),
})

export const listMyEmploymentsSchema = {
  tags: ['Users'],
  summary: 'Companies I work for (worker dashboard)',
  description:
    'My active employments, newest first. Answers an empty list for accounts that are not workers. ' +
    'Salary is a reference; the pay itself is the on-chain stream from `employer.ownerAddress`.',
  security,
  querystring: PageQuery,
  response: { 200: Page(EmploymentDto), ...errors(401, 422) },
} satisfies FastifySchema
