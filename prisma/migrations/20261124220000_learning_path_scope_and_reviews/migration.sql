-- Allow learning paths to target an entire organization or a specific cohort.
ALTER TABLE "LearningPath" ADD COLUMN "cohortId" TEXT;
ALTER TABLE "LearningPath" ALTER COLUMN "visibility" SET DEFAULT 'ORGANIZATION';
UPDATE "LearningPath" SET "visibility" = 'ORGANIZATION' WHERE "cohortId" IS NULL;
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_cohortId_fkey"
  FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "LearningPath_organizationId_visibility_idx" ON "LearningPath"("organizationId", "visibility");
CREATE INDEX "LearningPath_cohortId_idx" ON "LearningPath"("cohortId");

-- Store mentor feedback on evidence reviews so requested changes are actionable.
ALTER TABLE "MenteeMilestone" ADD COLUMN "reviewComment" TEXT;
