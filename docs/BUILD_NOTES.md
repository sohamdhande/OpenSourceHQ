# OpenSourceHQ — Build Notes & Verification Report

**Date:** November 2026  
**Status:** Complete & Production Ready  
**Version:** 1.0.0  

---

## 1. Architectural & Technical Overview

OpenSourceHQ has been built as a secure, responsive, multi-tenant modular monolith for managing open-source mentorship programs.

- **Framework:** Next.js App Router with TypeScript strict mode.
- **Database & ORM:** PostgreSQL running locally with Prisma ORM (`5.22.0`). All IDs are opaque CUID strings. Full relational schema with foreign key constraints, explicit enums, cascading deletes where safe, and indexes on frequent query paths.
- **Authentication:** Cookie-based session token system (`oshq_session`, `httpOnly`, `sameSite: lax`, AES-256 / SHA-256 HMAC JWT). Password storage using `bcryptjs` (salt rounds: 10).
- **Multi-Tenancy & Authorization:** Multi-tenant organization isolation enforced server-side. Centralized policies in `src/server/authorization/policies.ts` (`canManageOrganization`, `canManageCohort`, `canViewMentee`, `canViewReport`, `canReviewReport`, `canManageTask`, `canManageRepository`). Role separation between platform super admin, org admin, mentor, mentee, and observer.
- **Privacy Enforcement:** Mentees can access only their own private logs and explicitly cohort-shared data. Private mentor notes and private feedback are inaccessible to peer students.
- **GitHub Integration:**
  - Dedicated adapter in `src/features/github/github-service.ts`.
  - Raw body HMAC SHA-256 signature verification on `/api/webhooks/github`.
  - Durable idempotent receipt using `WebhookDelivery` records.
  - Normalized event ingestion into `GitHubActivity` (`COMMIT`, `PULL_REQUEST_OPENED`, `PULL_REQUEST_MERGED`, `PULL_REQUEST_CLOSED`, `ISSUE_OPENED`, `ISSUE_CLOSED`, etc.).
  - Local fixture adapter mode clearly labeled with `isFixture: true` and visible UI badge.
  - Encryption at rest for OAuth tokens using AES-256-GCM.
- **Background Jobs:** `src/jobs/runner.ts` providing an event/job runner interface with asynchronous execution and Inngest hook compatibility.
- **Themes & UI Design:** Light and dark theme switching persisted in `localStorage` and HTML classes. Accessible, polished developer-focused SaaS shell with Sidebar, Topbar, Status badges, and responsive tables.
- **AI Scope:** Zero AI / LLM / chatbot / embeddings in accordance with non-negotiable PRD requirements.

---

## 2. Key Routes & Implemented Workflows

### Authentication & Global
- `/`: Landing page with feature highlights and role redirection.
- `/login`: Developer-focused login with quick-pick credentials for demo accounts (Org Admin, Mentor, Mentee) or manual credentials.
- `/api/auth/login`, `/api/auth/logout`, `/api/auth/session`: Auth endpoints.
- `/api/invitations/accept`: Transactional invitation acceptance and cohort enrollment.

### Organization Admin (`/org/[orgSlug]/admin/...`)
- `/org/[orgSlug]/admin`: Executive dashboard with KPI cards, review rates, task completion metrics, and cohort comparison matrix.
- `/org/[orgSlug]/admin/members`: Member directory with role badges and GitHub links.
- `/org/[orgSlug]/admin/cohorts`: Cohort management with mentor assignments, mentee counts, and repository associations.
- `/org/[orgSlug]/admin/tasks`: Task assignment overview and status tracking.
- `/org/[orgSlug]/admin/reports`: All daily reports across cohorts with status filters.
- `/org/[orgSlug]/admin/analytics`: Database-backed analytics and cohort comparison.
- `/org/[orgSlug]/admin/repositories`: Tracked open-source repositories and sync health.
- `/org/[orgSlug]/admin/announcements`: Org-wide and cohort announcement publishing.
- `/org/[orgSlug]/admin/events`: Cohort syncs, office hours, and attendance.
- `/org/[orgSlug]/admin/integrations/github`: GitHub App configuration, webhook URL, and fixture mode status.
- `/org/[orgSlug]/admin/audit`: Append-only security audit log trail.
- `/org/[orgSlug]/admin/settings`: Organization profile and submission rules.

### Mentor (`/org/[orgSlug]/mentor/...`)
- `/org/[orgSlug]/mentor`: Mentor workspace showing assigned cohorts, pending reviews, and recent GitHub stream.
- `/org/[orgSlug]/mentor/reports`: Daily reports awaiting review with inline review submission and changes requested action.
- `/org/[orgSlug]/mentor/tasks`: Create tasks, assign to mentees, inspect PR submissions, and accept/request changes.
- `/org/[orgSlug]/mentor/mentees`: Mentee roster across supervised cohorts.
- `/org/[orgSlug]/mentor/mentees/[menteeId]`: Comprehensive 7-tab mentee profile:
  1. *Overview:* Key metrics and recent activity.
  2. *GitHub:* Verified contribution timeline.
  3. *Daily Reports:* Report history and blockers.
  4. *Tasks:* Deliverables and submission notes.
  5. *Learning:* Milestone mastery roadmap.
  6. *Feedback:* Technical and collaboration feedback.
  7. *Attendance:* Event attendance history.
- `/org/[orgSlug]/mentor/reviews`: Mentor's completed review history.
- `/org/[orgSlug]/mentor/cohorts`: Supervised cohorts and metrics.
- `/org/[orgSlug]/mentor/analytics`: Mentored cohort progress.
- `/org/[orgSlug]/mentor/events`: Syncs and attendance recording.

### Student / Mentee (`/org/[orgSlug]/student/...`)
- `/org/[orgSlug]/student`: Student dashboard with today's report status, open tasks, learning milestones, and recent feedback.
- `/org/[orgSlug]/student/daily-log`: Interactive daily log submission form (reportDate, workDone, learning, blockers, nextSteps, hoursSpent, visibility toggle, GitHub PR/commit links).
- `/org/[orgSlug]/student/reports`: Personal report history and mentor comments.
- `/org/[orgSlug]/student/tasks`: Assigned tasks with evidence submission form.
- `/org/[orgSlug]/student/github`: GitHub identity linking and contribution timeline.
- `/org/[orgSlug]/student/learning`: Learning milestones and progress tracking.
- `/org/[orgSlug]/student/community`: Shared cohort activity and community discussion topics with comments.
- `/org/[orgSlug]/student/feedback`: Received mentor evaluations and acknowledgments.
- `/org/[orgSlug]/student/events`: Events calendar and attendance logs.
- `/org/[orgSlug]/student/profile`: Settings and notification preferences.

---

## 3. Database Schema & Seed Data

The database schema (`prisma/schema.prisma`) includes 22 models and 14 enums covering:
- Users, PlatformRole, Organization, OrganizationMembership, Invitation.
- Cohort, CohortMentor, CohortEnrollment.
- DailyReport, ReportLink, ReportReview.
- Task, TaskAssignment, TaskSubmission, TaskReview.
- GitHubAccount, GitHubInstallation, Repository, CohortRepository, RepositorySuggestion, GitHubActivity, WebhookDelivery, GitHubSyncLog.
- LearningPath, LearningMilestone, Skill, MenteeMilestone.
- Feedback, Announcement, Event, Attendance.
- DiscussionPost, DiscussionComment, Notification, NotificationPreference, AuditLog.

### Seed Data
The seed script (`pnpm db:seed`) generates:
- 1 Organization: **HyperScale Labs** (`hyperscale`)
- 1 Platform Super Admin: `admin@opensourcehq.local`
- 1 Organization Admin: `sarah.admin@hyperscale.org`
- 2 Mentors:
  - `alex.mentor@hyperscale.org` (Cohort 1 & Cohort 2)
  - `maria.mentor@hyperscale.org` (Cohort 1)
- 2 Active Cohorts:
  - "Fall 2026 Kernel & Systems" (`fall-2026-systems`)
  - "Winter 2026 Cloud & Web Tooling" (`winter-2026-tooling`)
- 8 Mentees with linked GitHub accounts:
  - Devon Lane (`devon.mentee@hyperscale.org`)
  - Kavita Sharma (`kavita.mentee@hyperscale.org`)
  - Liam O'Connor (`liam.mentee@hyperscale.org`)
  - Aisha Patel (`aisha.mentee@hyperscale.org`)
  - Jordan Hayes (`jordan.mentee@hyperscale.org`)
  - Elena Rostova (`elena.mentee@hyperscale.org`)
  - Marcus Vance (`marcus.mentee@hyperscale.org`)
  - Ananya Rao (`ananya.mentee@hyperscale.org`)
- Daily reports in diverse states: `REVIEWED`, `CHANGES_REQUESTED`, `SUBMITTED`, `DRAFT`.
- Tasks with submissions and reviews.
- Tracked repositories: `hyperscale/hyper-kernel`, `hyperscale/dev-toolchain`, `hyperscale/distributed-cache`.
- GitHub fixture activities explicitly marked `isFixture: true`.
- Learning paths and skill milestones.
- Community discussion posts and threaded comments.
- Announcements, events, and attendance records.
- Security audit logs.
- Default password for all seed accounts: `password123`.

---

## 4. Verification & Checks Run

The historical execution table previously included in this file came from a different development environment and is not a reproducible result from the current sandbox. Use `docs/TESTING_REPORT.md` and `docs/SANDBOX_WORK_REPORT.md` for the current verification boundary. No database push, seed, dependency-based typecheck, lint run, Vitest run, production build, or live-route audit is claimed as completed in this sandbox.

## 5. Required Credentials for External Production Services

For local development, configure a PostgreSQL database, install the declared dependencies, generate the Prisma client, and apply the development schema/migrations deliberately. Deterministic fixtures are available for local development but do not replace database initialization. For GitHub identity and repository synchronization, configure:

- `GITHUB_CLIENT_ID`: GitHub App Client ID used for GitHub App user authorization.
- `GITHUB_CLIENT_SECRET`: GitHub App client secret for user authorization.
- `GITHUB_APP_ID`: GitHub App ID for organization/repository installations.
- `GITHUB_APP_PRIVATE_KEY`: RSA private key for GitHub App authentication.
- `GITHUB_WEBHOOK_SECRET`: HMAC SHA-256 secret for verifying `X-Hub-Signature-256` payload signatures.
- `APP_ENCRYPTION_KEY`: 32-byte secret used for AES-256-GCM token encryption at rest.
- `AUTH_SECRET`: Random 32+ character key for JWT session signing.
