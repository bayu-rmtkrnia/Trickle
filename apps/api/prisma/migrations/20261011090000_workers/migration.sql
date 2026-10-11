-- EmployerWorker becomes Worker, and its user column becomes userId. Renames keep existing rows.
ALTER TABLE "EmployerWorker" RENAME TO "Worker";
ALTER TABLE "Worker" RENAME CONSTRAINT "EmployerWorker_pkey" TO "Worker_pkey";
ALTER TABLE "Worker" RENAME COLUMN "workerId" TO "userId";
ALTER TABLE "Worker" RENAME CONSTRAINT "EmployerWorker_companyId_fkey" TO "Worker_companyId_fkey";
ALTER TABLE "Worker" RENAME CONSTRAINT "EmployerWorker_workerId_fkey" TO "Worker_userId_fkey";
ALTER INDEX "EmployerWorker_companyId_workerId_key" RENAME TO "Worker_companyId_userId_key";
ALTER INDEX "EmployerWorker_workerId_idx" RENAME TO "Worker_userId_idx";

-- New columns. updatedAt gets a temporary default so existing rows can be filled.
ALTER TABLE "Worker" ADD COLUMN "position" TEXT;
ALTER TABLE "Worker" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Worker" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Worker" ALTER COLUMN "updatedAt" DROP DEFAULT;
