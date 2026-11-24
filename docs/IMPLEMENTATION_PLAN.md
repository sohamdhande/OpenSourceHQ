# Implementation Plan

The build agent should execute this plan in order. It may work continuously in one session, but must verify each milestone before moving on.

## Phase 0 — Workspace inspection
- Inspect files and package manager.
- Preserve compatible existing setup.
- Read all specification files.
- Create implementation checklist.

## Phase 1 — Foundation
- Initialize Next.js App Router, TypeScript strict mode.
- Configure Tailwind and component system.
- Add Prisma and PostgreSQL configuration.
- Add Auth.js.
- Add user, organization, membership and platform role models.
- Implement invitation flow and organization switcher.
- Implement authorization policies and tenant context.
- Add seed data.
- Add theme switching and app shell.

Exit gate: auth, organization isolation and role-specific routing work.

## Phase 2 — Organization operations
- Cohorts, mentor assignment, mentee enrollment.
- Member directory and profile management.
- Organization admin dashboard.
- Mentor dashboard and cohort detail.
- Student dashboard shell.

Exit gate: admins can manage organization structure; mentors and mentees see correct scopes.

## Phase 3 — Mentorship workflow
- Daily reports and review history.
- Task creation, assignment, submissions and review.
- Feedback with visibility.
- Learning paths and milestones.
- In-app notifications.

Exit gate: end-to-end report and task workflows persist and enforce permissions.

## Phase 4 — GitHub
- GitHub OAuth linking.
- GitHub App setup and installation records.
- Webhook endpoint with signature verification.
- Idempotent delivery processing.
- Activity normalization.
- Repository management and cohort association.
- Activity timeline and sync health.
- Local fixture adapter for development.

Exit gate: real events process when credentials exist; fixture mode is visibly distinct.

## Phase 5 — Community and reporting
- Shared cohort feed and discussions.
- Announcements, events and attendance.
- Admin/mentor/student analytics.
- Audit logs.
- Notification preferences and email adapter.

Exit gate: all core pages use persisted data and privacy rules.

## Phase 6 — Hardening and delivery
- Authorization matrix tests.
- Tenant isolation tests.
- Validation and error handling.
- Responsive and accessibility review.
- Rate limiting and secure headers.
- Logging and health checks.
- Migrations and seed verified from clean database.
- Production build and documentation.

## Implementation rules
- Do not build all pages as static mockups first and stop there.
- Implement vertical slices: database → service → authorization → UI → tests.
- Use realistic fixtures only for local demo/testing.
- Every external integration must have a clear configuration status.
- Keep AI out of scope.
- Record any deviations in `docs/BUILD_NOTES.md`.
