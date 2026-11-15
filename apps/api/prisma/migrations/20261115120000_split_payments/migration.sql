-- Split indexer: SplitPaid events (family incoming transfers) and the log scan cursor.
CREATE TABLE "SplitPayment" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "streamId" BIGINT NOT NULL,
    "worker" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "amountUnits" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SplitPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IndexerCursor" (
    "name" TEXT NOT NULL,
    "forwardBlock" BIGINT NOT NULL,
    "backfillBlock" BIGINT NOT NULL,
    "floorBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerCursor_pkey" PRIMARY KEY ("name")
);

CREATE UNIQUE INDEX "SplitPayment_txHash_logIndex_key" ON "SplitPayment"("txHash", "logIndex");
CREATE INDEX "SplitPayment_recipient_blockNumber_idx" ON "SplitPayment"("recipient", "blockNumber");
