-- Repository identities are scoped to an organization. This lets the same
-- GitHub repository be connected independently to more than one tenant.
DROP INDEX IF EXISTS "Repository_providerRepositoryId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Repository_organizationId_providerRepositoryId_key"
  ON "Repository" ("organizationId", "providerRepositoryId");

-- A member may choose the same repository in two different organizations.
DROP INDEX IF EXISTS "MenteeRepository_menteeId_repositoryId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "UserRepository_organizationId_userId_repositoryId_key"
  ON "MenteeRepository" ("organizationId", "menteeId", "repositoryId");

-- A GitHub activity event is unique within a tenant, not across tenants.
DROP INDEX IF EXISTS "GitHubActivity_providerEventId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "GitHubActivity_organizationId_providerEventId_key"
  ON "GitHubActivity" ("organizationId", "providerEventId");
