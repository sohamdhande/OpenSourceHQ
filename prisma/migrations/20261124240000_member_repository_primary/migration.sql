-- Repair historical duplicate primary selections, keeping the most recently assigned
-- primary repository for each organization/member pair.
WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "organizationId", "menteeId"
           ORDER BY "isPrimary" DESC, "assignedAt" DESC, "id" DESC
         ) AS primary_rank
  FROM "MenteeRepository"
  WHERE "isPrimary" = TRUE
)
UPDATE "MenteeRepository" AS selection
SET "isPrimary" = FALSE
FROM ranked
WHERE selection."id" = ranked."id"
  AND ranked.primary_rank > 1;

-- Prisma schema cannot currently express PostgreSQL partial unique indexes.
-- Keep this invariant in SQL and use serializable API transactions for writes.
CREATE UNIQUE INDEX "UserRepository_one_primary_per_member_key"
ON "MenteeRepository"("organizationId", "menteeId")
WHERE "isPrimary" = TRUE;
