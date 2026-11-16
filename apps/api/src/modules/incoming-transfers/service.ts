import type { FastifyBaseLogger } from 'fastify'
import { unauthorized } from '../../lib/errors.js'
import type { PageQuery } from '../../lib/pagination.js'
import { toPage } from '../../lib/pagination.js'
import type { SplitIndexer } from '../../lib/split-indexer.js'
import type { IncomingTransferRepository } from './repository.js'

/** Passed per call so log lines keep the request id. */
type Log = Pick<FastifyBaseLogger, 'warn'>

interface Deps {
  repo: IncomingTransferRepository
  /** `null` when PAYROLL_ADDRESS is unset: the list is served from what is stored. */
  splits: Pick<SplitIndexer, 'catchUp'> | null
}

export function createIncomingTransferService({ repo, splits }: Deps) {
  /** Reads the newest blocks so a withdrawal a moment ago shows up. A failing RPC only makes the list stale. */
  async function catchUp(log: Log) {
    try {
      await splits?.catchUp()
    } catch (err) {
      log.warn({ err }, 'incoming transfers served from the cache: split catch-up failed')
    }
  }

  return {
    async listMine(userId: string, query: PageQuery, log: Log) {
      const address = await repo.findAddress(userId)
      if (!address) throw unauthorized('Account no longer exists. Sign in again.')
      await catchUp(log)
      const rows = await repo.listByRecipient(address.toLowerCase(), query)
      const senders = await repo.findSenders([...new Set(rows.map((r) => r.worker))])
      return toPage(rows, query.limit, (r) => ({
        id: r.id,
        txHash: r.txHash,
        streamId: r.streamId.toString(),
        workerAddress: r.worker,
        amountUnits: r.amountUnits,
        paidAt: r.paidAt.toISOString(),
        sender: senders.get(r.worker) ?? null,
      }))
    },
  }
}

export type IncomingTransferService = ReturnType<typeof createIncomingTransferService>
