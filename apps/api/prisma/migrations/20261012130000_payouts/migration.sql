-- Payouts point at an encrypted BankAccount instead of copying the bank details
-- in plain text. The table was created in the first migration but never
-- written to, so it is emptied before the new NOT NULL column is added.
DELETE FROM "Payout";

ALTER TABLE "Payout" DROP COLUMN "bankCode",
DROP COLUMN "accountNumber",
DROP COLUMN "accountName",
ADD COLUMN "bankAccountId" TEXT NOT NULL,
ADD COLUMN "fxRate" DOUBLE PRECISION,
ADD COLUMN "fxSource" TEXT,
ADD COLUMN "failureReason" TEXT;

CREATE UNIQUE INDEX "Payout_providerRef_key" ON "Payout"("providerRef");
CREATE INDEX "Payout_bankAccountId_idx" ON "Payout"("bankAccountId");

ALTER TABLE "Payout" ADD CONSTRAINT "Payout_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
