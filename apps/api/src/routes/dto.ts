import { z } from 'zod'
import type { Employer, User } from '../generated/prisma/client.js'

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

export const centsToUsd = (cents: number) => cents / 100
