import type { FastifyBaseLogger } from 'fastify'
import { badRequest, conflict, notFound } from '../../lib/errors.js'
import { toPage, type PageQuery } from '../../lib/pagination.js'
import type { StreamReader } from '../../lib/streams.js'
import type { RecipientRepository } from './repository.js'
import { toRecipientDto, type CreateRecipientInput, type RecipientInput } from './schemas.js'

export const recipientNotFound = () => notFound('RECIPIENT_NOT_FOUND', 'Recipient not found')

/** Passed per call so log lines keep the request id. */
type Log = Pick<FastifyBaseLogger, 'warn'>

interface Deps {
  repo: RecipientRepository
  streams: Pick<StreamReader, 'splitOf'>
}

/**
 * Methods taking a recipient id assume the route already checked ownership.
 * They still answer 404 if the row vanished in between.
 */
export function createRecipientService({ repo, streams }: Deps) {
  async function find(id: string) {
    const recipient = await repo.findActive(id)
    if (!recipient) throw recipientNotFound()
    return recipient
  }

  return {
    async create(ownerId: string, input: CreateRecipientInput) {
      const user = await repo.findOrCreateUser(input.address)
      if (user.id === ownerId) {
        throw badRequest('CANNOT_ADD_SELF', 'You cannot add yourself as a recipient')
      }
      const existing = await repo.findLink(ownerId, user.id)
      if (existing && !existing.deletedAt) {
        throw conflict('RECIPIENT_EXISTS', 'This person is already one of your recipients')
      }
      const recipient = await repo.upsert(ownerId, user.id, {
        displayName: input.displayName,
        relation: input.relation ?? null,
      })
      return toRecipientDto(recipient)
    },

    async list(ownerId: string, page: PageQuery) {
      const rows = await repo.list(ownerId, page)
      return toPage(rows, page.limit, toRecipientDto)
    },

    async get(id: string) {
      return toRecipientDto(await find(id))
    },

    async update(id: string, input: Partial<RecipientInput>) {
      await find(id)
      return toRecipientDto(await repo.update(id, input))
    },

    async remove(id: string, log: Log) {
      const parties = await repo.findSplitParties(id)
      if (!parties) throw recipientNotFound()
      const split = await streams.splitOf(parties.worker)
      if (!split) {
        log.warn({ recipientId: id }, 'recipient removed without an on-chain split check')
      } else if (split.bps > 0 && split.recipient === parties.recipient) {
        throw conflict(
          'SPLIT_ACTIVE',
          'Your salary split still sends to this recipient. Turn the split off or change it first.',
        )
      }
      await repo.softDelete(id)
    },
  }
}

export type RecipientService = ReturnType<typeof createRecipientService>
