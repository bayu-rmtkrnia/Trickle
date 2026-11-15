import type { Db } from './prisma.js'

/** One `SplitPaid` log as the split indexer stores it. Addresses are lowercased. */
export interface SplitPaymentRow {
  txHash: string
  logIndex: number
  blockNumber: bigint
  paidAt: Date
  streamId: bigint
  worker: string
  recipient: string
  amountUnits: string
}

/** How far the scan has read; see the `IndexerCursor` model. */
export interface ScanCursor {
  forwardBlock: bigint
  backfillBlock: bigint
  floorBlock: bigint
}

/** What the split indexer needs from Postgres. Tests use an in-memory copy. */
export interface SplitStore {
  cursor(): Promise<ScanCursor | null>
  /** Stores `rows` and moves the cursor in one transaction, so a crash never skips a range. */
  save(rows: SplitPaymentRow[], cursor: ScanCursor): Promise<void>
}

const NAME = 'split-paid'

export function createSplitStore(db: Db): SplitStore {
  return {
    async cursor() {
      const row = await db.indexerCursor.findUnique({ where: { name: NAME } })
      return (
        row && {
          forwardBlock: row.forwardBlock,
          backfillBlock: row.backfillBlock,
          floorBlock: row.floorBlock,
        }
      )
    },

    async save(rows, cursor) {
      await db.$transaction([
        // Ranges can be read twice (catch-up next to the loop); (txHash, logIndex) keeps one copy.
        db.splitPayment.createMany({ data: rows, skipDuplicates: true }),
        db.indexerCursor.upsert({
          where: { name: NAME },
          create: { name: NAME, ...cursor },
          update: cursor,
        }),
      ])
    },
  }
}
