-- AlterTable
ALTER TABLE "Blocker" ADD COLUMN     "isSelfTracked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN     "isSelfTracked" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "cohortId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OrganizationMembership" ADD COLUMN     "selfTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "selfTrackingEnabledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "isSelfTracked" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "DailyReport_organizationId_menteeId_isSelfTracked_reportDat_idx" ON "DailyReport"("organizationId", "menteeId", "isSelfTracked", "reportDate");

-- CreateIndex
CREATE INDEX "Task_organizationId_createdById_isSelfTracked_idx" ON "Task"("organizationId", "createdById", "isSelfTracked");

-- Enforce one self-tracked personal daily log per user, organization, and date
CREATE UNIQUE INDEX "DailyReport_self_tracked_unique_idx"
ON "DailyReport" ("organizationId", "menteeId", "reportDate")
WHERE "cohortId" IS NULL AND "isSelfTracked" = true;
