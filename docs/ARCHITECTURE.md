# Architecture Specification

## 1. Architectural style
Use a modular monolith. One deployable Next.js application with well-separated domain modules, a relational database and background workers. Do not split into microservices for MVP.

## 2. Logical layers
1. Presentation: Next.js App Router pages, layouts, server components and client components.
2. Application: use cases/actions, orchestration, DTOs and authorization checks.
3. Domain: entities, enums, policies, domain events and business rules.
4. Infrastructure: Prisma repositories, GitHub adapter, email adapter, storage adapter, job adapter and logging.

Suggested source layout:
- `src/app`: routes and layouts only.
- `src/features/<domain>`: schemas, services, queries, components and types.
- `src/server/auth`: session and identity helpers.
- `src/server/authorization`: permission policies and tenant context.
- `src/server/db`: Prisma client and repositories.
- `src/integrations/github`: GitHub App, OAuth, webhook verification and API client.
- `src/integrations/email`: provider interface and implementation.
- `src/jobs`: job definitions and local/provider runner.
- `src/components`: shared UI primitives and navigation.
- `src/lib`: formatting, validation helpers and utilities.

## 3. Multi-tenancy
A user may be a member of multiple organizations. Organization membership carries the role within that organization. Do not put a single global role on the user record.

Every organization-owned object must be scoped by organization ID directly or through a validated parent relationship. Resolve active organization from a verified membership, not from an untrusted client parameter. For APIs that accept organizationId, verify membership and role before querying data.

Platform super admin is a platform-level role, separate from organization membership. Access to organization data for support should be audited and explicit.

## 4. Authorization model
Implement centralized policies such as:
- `canManageOrganization(user, organizationId)`
- `canManageCohort(user, cohortId)`
- `canViewMentee(user, menteeId)`
- `canViewReport(user, reportId)`
- `canReviewReport(user, reportId)`
- `canManageTask(user, taskId)`
- `canViewGithubActivity(user, activityId)`
- `canManageRepository(user, repositoryId)`

Do not duplicate ad-hoc role checks throughout UI components. UI hiding is not authorization.

## 5. Domain modules
- identity
- organizations
- memberships
- cohorts
- mentees
- reports
- tasks
- github
- repositories
- learning
- feedback
- community
- announcements
- events
- attendance
- notifications
- analytics
- audit

Each module exposes typed service methods and uses repositories/data access functions. Keep cross-module calls explicit.

## 6. Integration architecture
Define provider interfaces, e.g.:
- `SourceControlProvider`: connect identity, list repositories, fetch activity, verify webhook.
- `NotificationProvider`: send email or other delivery.
- `ObjectStorageProvider`: upload/read/delete attachment.
- `JobScheduler`: enqueue and schedule work.

GitHub is the first source-control adapter. Keep provider-specific fields in integration tables or JSON metadata, not spread through all business entities.

## 7. Event and job processing
Use internal domain events for:
- report submitted/reviewed
- task assigned/submitted/completed
- cohort member added
- GitHub activity received
- announcement published
- event reminder due

Use background jobs for:
- webhook processing
- repository sync/reconciliation
- notification delivery
- scheduled reminders
- analytics aggregation if required

Jobs must be retryable and idempotent. A local development mode must work without a paid job provider. Use an adapter so Inngest or another service can be added.

## 8. GitHub event pipeline
Webhook endpoint:
1. Read raw request body.
2. Verify `X-Hub-Signature-256`.
3. Validate delivery ID and event headers.
4. Persist delivery record with unique delivery ID.
5. Enqueue processing.
6. Normalize relevant event into internal activity.
7. Resolve GitHub account/repository and organization scope.
8. Upsert activity with provider event identity.
9. Mark delivery processed; retry safely on failure.

Do not perform expensive API calls inside the webhook request. Respond promptly after durable receipt.

## 9. Data and caching
PostgreSQL is the source of truth. Use Prisma transactions for multi-row state transitions. Add indexes for organization, cohort, user, status and time filters. Cache only derived, non-sensitive data and ensure cache keys include tenant scope. Avoid caching private student data across sessions.

## 10. Observability
Structured logs with request IDs and job IDs. Redact tokens, cookies, passwords, report content and private feedback. Add error monitoring adapter and health endpoints for database and job processing.

## 11. Deployment topology
- Next.js application on Vercel or compatible Node hosting.
- Managed PostgreSQL (Supabase or equivalent).
- Background job provider (Inngest or compatible).
- Object storage (Supabase Storage or compatible).
- GitHub App registered by operator.
- Email provider optional; in-app notifications must work without it.

## 12. Future extension points
No AI implementation now. Keep optional integration registry and provider interfaces so future modules can be introduced without changing core mentorship entities. Avoid premature plugin marketplace or generic workflow engine.
