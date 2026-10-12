-- Stream indexer: cache of on-chain TricklePayroll streams.
CREATE TABLE "Stream" (
    "id" BIGINT NOT NULL,
    "employer" TEXT NOT NULL,
    "worker" TEXT NOT NULL,
    "amountUnits" TEXT NOT NULL,
    "withdrawnUnits" TEXT NOT NULL,
    "refundedUnits" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "canceled" BOOLEAN NOT NULL,
    "settled" BOOLEAN NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Stream_employer_worker_idx" ON "Stream"("employer", "worker");
CREATE INDEX "Stream_worker_idx" ON "Stream"("worker");
CREATE INDEX "Stream_settled_idx" ON "Stream"("settled");
