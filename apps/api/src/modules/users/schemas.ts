import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import type { User } from '../../generated/prisma/client.js'
import { errors } from '../../lib/schemas.js'

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
  roles: z.object({
    employer: z.boolean(),
    worker: z.boolean(),
    family: z.boolean(),
  }),
}).meta({ id: 'Me' })

export const UpdateMeInput = z.object({
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .nullable()
    .describe('Name shown to employers and family. `null` clears it'),
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
