-- A linked source (daily report, task, learning milestone, GitHub record) may have
-- at most one blocker per mentee and organization. Keep the most recently updated
-- duplicate before applying the constraint; general blockers have NULL sourceId
-- and remain freely repeatable under PostgreSQL's NULL uniqueness semantics.
WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "organizationId", "menteeId", "source", "sourceId"
           ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
         ) AS duplicate_rank
  FROM "Blocker"
  WHERE "sourceId" IS NOT NULL
)
DELETE FROM "Blocker" AS blocker
USING ranked
WHERE blocker."id" = ranked."id"
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX "Blocker_organizationId_menteeId_source_sourceId_key"
ON "Blocker"("organizationId", "menteeId", "source", "sourceId");
