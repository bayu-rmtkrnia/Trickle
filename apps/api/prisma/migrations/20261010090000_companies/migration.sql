-- Employer becomes Company. Renames keep existing rows, ids and foreign keys.
ALTER TABLE "Employer" RENAME TO "Company";
ALTER TABLE "Company" RENAME CONSTRAINT "Employer_pkey" TO "Company_pkey";
ALTER TABLE "Company" RENAME CONSTRAINT "Employer_ownerId_fkey" TO "Company_ownerId_fkey";

-- Soft delete. One owner may have several rows (old, deleted companies), so the
-- unique index on ownerId becomes a plain index.
ALTER TABLE "Company" ADD COLUMN "deletedAt" TIMESTAMP(3);
DROP INDEX "Employer_ownerId_key";
CREATE INDEX "Company_ownerId_idx" ON "Company"("ownerId");

-- EmployerWorker.employerId -> companyId
ALTER TABLE "EmployerWorker" RENAME COLUMN "employerId" TO "companyId";
ALTER TABLE "EmployerWorker" RENAME CONSTRAINT "EmployerWorker_employerId_fkey" TO "EmployerWorker_companyId_fkey";
ALTER INDEX "EmployerWorker_employerId_workerId_key" RENAME TO "EmployerWorker_companyId_workerId_key";

-- Invite.employerId -> companyId
ALTER TABLE "Invite" RENAME COLUMN "employerId" TO "companyId";
ALTER TABLE "Invite" RENAME CONSTRAINT "Invite_employerId_fkey" TO "Invite_companyId_fkey";
ALTER INDEX "Invite_employerId_idx" RENAME TO "Invite_companyId_idx";
