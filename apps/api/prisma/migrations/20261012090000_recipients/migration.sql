-- FamilyLink becomes Recipient (PLAN §6.3 resource `recipients`). workerId is the
-- owning worker, relativeId the recipient's account. Renames keep existing rows.
ALTER TABLE "FamilyLink" RENAME TO "Recipient";
ALTER TABLE "Recipient" RENAME CONSTRAINT "FamilyLink_pkey" TO "Recipient_pkey";
ALTER TABLE "Recipient" RENAME COLUMN "workerId" TO "ownerId";
ALTER TABLE "Recipient" RENAME COLUMN "relativeId" TO "userId";
ALTER TABLE "Recipient" RENAME CONSTRAINT "FamilyLink_workerId_fkey" TO "Recipient_ownerId_fkey";
ALTER TABLE "Recipient" RENAME CONSTRAINT "FamilyLink_relativeId_fkey" TO "Recipient_userId_fkey";
ALTER INDEX "FamilyLink_workerId_relativeId_key" RENAME TO "Recipient_ownerId_userId_key";
ALTER INDEX "FamilyLink_relativeId_idx" RENAME TO "Recipient_userId_idx";

-- New columns. updatedAt gets a temporary default so existing rows can be filled.
ALTER TABLE "Recipient" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Recipient" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Recipient" ALTER COLUMN "updatedAt" DROP DEFAULT;
