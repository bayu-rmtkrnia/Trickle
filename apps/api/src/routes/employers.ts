import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { conflict, notFound } from '../lib/errors.js'
import { errors } from '../lib/schemas.js'
import { EmployerDto, centsToUsd, toEmployerDto } from './dto.js'

const EmployerInput = z.object({
  name: z.string().trim().min(2).max(100),
  country: z
    .string()
    .trim()
    .length(2)
    .toUpperCase()
    .optional()
    .describe('ISO 3166-1 alpha-2 country code, e.g. MY'),
})

const WorkerDto = z.object({
  id: z.string(),
  displayName: z.string(),
  address: z.string(),
  monthlySalaryUsd: z.number(),
  joinedAt: z.string(),
})

const employers: FastifyPluginAsyncZod = async (app) => {
  const { db } = app
  const secured = { onRequest: [app.authenticate] }
  const security = [{ bearerAuth: [] }]

  app.post(
    '/employers',
    {
      ...secured,
      schema: {
        tags: ['Employers'],
        summary: 'Create the company profile for the signed-in user',
        security,
        body: EmployerInput,
        response: { 201: EmployerDto, ...errors(400, 401, 409) },
      },
    },
    async (req, reply) => {
      const existing = await db.employer.findUnique({ where: { ownerId: req.user.sub } })
      if (existing) throw conflict('EMPLOYER_EXISTS', 'You already have a company profile')

      const employer = await db.employer.create({
        data: { ...req.body, ownerId: req.user.sub },
        include: { owner: { select: { address: true } } },
      })
      return reply.code(201).send(toEmployerDto(employer))
    },
  )

  app.get(
    '/employers/me',
    {
      ...secured,
      schema: {
        tags: ['Employers'],
        summary: "The signed-in user's company profile",
        security,
        response: { 200: EmployerDto, ...errors(401, 404) },
      },
    },
    async (req) => {
      const employer = await db.employer.findUnique({
        where: { ownerId: req.user.sub },
        include: { owner: { select: { address: true } } },
      })
      if (!employer) throw notFound('EMPLOYER_NOT_FOUND', 'You have no company profile yet')
      return toEmployerDto(employer)
    },
  )

  app.patch(
    '/employers/me',
    {
      ...secured,
      schema: {
        tags: ['Employers'],
        summary: 'Update the company profile',
        security,
        body: EmployerInput.partial(),
        response: { 200: EmployerDto, ...errors(400, 401, 404) },
      },
    },
    async (req) => {
      const existing = await db.employer.findUnique({ where: { ownerId: req.user.sub } })
      if (!existing) throw notFound('EMPLOYER_NOT_FOUND', 'You have no company profile yet')
      const employer = await db.employer.update({
        where: { id: existing.id },
        data: req.body,
        include: { owner: { select: { address: true } } },
      })
      return toEmployerDto(employer)
    },
  )

  app.get(
    '/employers/me/workers',
    {
      ...secured,
      schema: {
        tags: ['Employers'],
        summary: 'Workers who accepted an invite from this company',
        description:
          'Metadata only. Stream balances come from the contract/indexer, never from this API.',
        security,
        response: { 200: z.object({ workers: z.array(WorkerDto) }), ...errors(401, 404) },
      },
    },
    async (req) => {
      const employer = await db.employer.findUnique({
        where: { ownerId: req.user.sub },
        include: {
          workers: {
            include: { worker: { select: { address: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      })
      if (!employer) throw notFound('EMPLOYER_NOT_FOUND', 'You have no company profile yet')
      return {
        workers: employer.workers.map((w) => ({
          id: w.id,
          displayName: w.displayName,
          address: w.worker.address,
          monthlySalaryUsd: centsToUsd(w.monthlySalaryCents),
          joinedAt: w.createdAt.toISOString(),
        })),
      }
    },
  )
}

export default employers
