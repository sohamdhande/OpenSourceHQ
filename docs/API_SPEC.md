# API and Server Action Specification

Use Next.js Route Handlers and/or server actions. Choose one consistent pattern per feature. All inputs validated with Zod. All mutations authenticated, authorized, tenant-scoped and audited where sensitive.

## Conventions
- JSON responses for API routes.
- Standard error shape: `{ error: { code, message, requestId } }`.
- Paginate lists with `cursor` or `page` + `pageSize`; cap page size.
- Use ISO-8601 timestamps in API payloads.
- Never return access tokens, password hashes or private provider credentials.
- Do not trust organization/user IDs from the client without policy checks.

## Auth and onboarding
- `POST /api/invitations` — authorized invite.
- `POST /api/invitations/accept` — accept valid invite token.
- `GET /api/session` — current user and active organization context.
- Auth.js routes/provider callbacks as configured.

## Organizations and memberships
- `GET /api/organizations`
- `POST /api/organizations` (platform authorized or permitted onboarding)
- `GET /api/orgs/:orgId/members`
- `POST /api/orgs/:orgId/members/invite`
- `PATCH /api/orgs/:orgId/members/:membershipId`
- `DELETE /api/orgs/:orgId/members/:membershipId`

## Cohorts
- `GET /api/orgs/:orgId/cohorts`
- `POST /api/orgs/:orgId/cohorts`
- `GET /api/cohorts/:cohortId`
- `PATCH /api/cohorts/:cohortId`
- `POST /api/cohorts/:cohortId/mentors`
- `POST /api/cohorts/:cohortId/enrollments`
- `PATCH /api/cohorts/:cohortId/enrollments/:enrollmentId`

## Mentees and profiles
- `GET /api/mentees`
- `GET /api/mentees/:menteeId`
- `PATCH /api/mentees/:menteeId/profile`
- `GET /api/mentees/:menteeId/activity`

## Reports
- `POST /api/reports`
- `GET /api/reports`
- `GET /api/reports/:reportId`
- `PATCH /api/reports/:reportId`
- `POST /api/reports/:reportId/submit`
- `POST /api/reports/:reportId/reviews`

## Tasks
- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/:taskId`
- `PATCH /api/tasks/:taskId`
- `POST /api/tasks/:taskId/assignments`
- `PATCH /api/task-assignments/:assignmentId`
- `POST /api/task-assignments/:assignmentId/submissions`
- `POST /api/task-assignments/:assignmentId/reviews`

## GitHub
- `GET /api/github/connect` — begin OAuth/linking flow.
- `GET /api/github/callback` — validate state and complete linking.
- `POST /api/github/disconnect`
- `GET /api/github/accounts`
- `GET /api/github/activities`
- `GET /api/github/repositories`
- `POST /api/github/repositories/suggestions`
- `POST /api/github/repositories/:repositoryId/approve`
- `POST /api/webhooks/github` — raw body signature verification, idempotent receipt.

## Learning, feedback and community
- CRUD routes for learning paths/milestones subject to role policies.
- `POST /api/feedback`, `GET /api/feedback`.
- `GET/POST /api/community/posts`.
- `GET/POST /api/community/posts/:postId/comments`.
- `POST /api/community/posts/:postId/report`.

## Announcements, events and notifications
- CRUD announcements.
- CRUD events and attendance.
- `GET /api/notifications`.
- `POST /api/notifications/:id/read`.
- `PATCH /api/settings/notifications`.

## Analytics
- `GET /api/analytics/organization`
- `GET /api/analytics/cohorts/:cohortId`
- `GET /api/analytics/mentees/:menteeId`
Analytics endpoints must apply role and visibility constraints and return metric definitions/date range.

## Internal service boundaries
Expose typed functions for:
- `ReportService.submit`, `ReportService.review`
- `TaskService.assign`, `TaskService.submit`, `TaskService.review`
- `CohortService.enroll`, `CohortService.assignMentor`
- `GitHubService.linkAccount`, `GitHubService.processWebhook`, `GitHubService.syncRepository`
- `AnalyticsService.getOrganizationSummary`, `getCohortSummary`
Route handlers should call services, not contain domain logic.
