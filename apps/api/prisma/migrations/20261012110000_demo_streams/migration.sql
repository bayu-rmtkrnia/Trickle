-- Judge mode: one demo stream per account (PLAN §3.1 step 5).
CREATE TYPE "DemoStreamStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "DemoStream" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "amountUnits" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "status" "DemoStreamStatus" NOT NULL DEFAULT 'PENDING',
    "streamId" TEXT,
    "txHash" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "error" TEXT,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoStream_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DemoStream_userId_key" ON "DemoStream"("userId");
CREATE INDEX "DemoStream_createdAt_idx" ON "DemoStream"("createdAt");
CREATE INDEX "DemoStream_ip_createdAt_idx" ON "DemoStream"("ip", "createdAt");

ALTER TABLE "DemoStream" ADD CONSTRAINT "DemoStream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
