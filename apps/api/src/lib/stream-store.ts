import type { Address } from 'viem'
import type { Db } from './prisma.js'

/** One TricklePayroll stream as the indexer stores it. Addresses are lowercased. */
export interface StreamRow {
  id: bigint
  employer: Address
  worker: Address
  amountUnits: string
  withdrawnUnits: string
  refundedUnits: string
  startsAt: Date
  endsAt: Date
  canceled: boolean
  settled: boolean
}

/** What the indexer needs from Postgres. Tests use an in-memory copy. */
export interface StreamStore {
  /** Highest stream id stored, or 0 when none. */
  maxId(): Promise<bigint>
  /** Streams that can still change on-chain (not settled). */
  openIds(): Promise<bigint[]>
  /** Streams from `employer` to `worker` that were neither canceled nor ended at `now`. */
  activeIds(employer: Address, worker: Address, now: Date): Promise<bigint[]>
  upsert(rows: StreamRow[]): Promise<void>
}

export function createStreamStore(db: Db): StreamStore {
  return {
    async maxId() {
      const max = await db.stream.aggregate({ _max: { id: true } })
      return max._max.id ?? 0n
    },

    async openIds() {
      const rows = await db.stream.findMany({
        where: { settled: false },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
      return rows.map((r) => r.id)
    },

    async activeIds(employer, worker, now) {
      const rows = await db.stream.findMany({
        where: { employer, worker, canceled: false, endsAt: { gt: now } },
        select: { id: true },
      })
      return rows.map((r) => r.id)
    },

    async upsert(rows) {
      if (rows.length === 0) return
      await db.$transaction(
        rows.map(({ id, ...data }) =>
          db.stream.upsert({ where: { id }, create: { id, ...data }, update: data }),
        ),
      )
    },
  }
}
