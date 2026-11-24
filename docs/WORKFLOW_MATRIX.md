# OpenSourceHQ — Workflow Matrix & State Machine Specification

This document details the 11 end-to-end workflows (A through K) implemented across the OpenSourceHQ platform, documenting user roles, route entry points, state transitions, tenant isolation, and automated verification.

---

## Workflow A: Member Invitation & Onboarding

- **Primary Roles:** Organization Admin (`ORG_ADMIN`), Mentee / Mentor / Observer
- **User Intent:** Invite an external developer or student to join an organization with a specific cohort assignment and platform role.
- **Entry Points:**
  - UI: `/org/[orgSlug]/admin/members` -> "Invite Member" modal
  - API: `POST /api/orgs/[orgId]/members/invite`
  - Accept UI: `/invitations/accept?token=[token]`
  - Accept API: `POST /api/invitations/accept`
- **Entities & Transitions:**
  1. `Invitation` record created (`status: PENDING`, `expiresAt: now + 7d`, `token: cryptographically secure string`).
  2. On accept:
     - `User` record created or updated.
     - `OrganizationMembership` created with assigned `OrgRole` (`ACTIVE`).
     - `CohortEnrollment` created if `cohortId` specified.
     - `Invitation.acceptedAt` set.
- **Authorization & Security:**
  - Inviting requires `canManageOrganization(session, orgId)`.
  - Accept endpoint verifies token existence and expiry before applying mutations in a Prisma transaction.
- **Audit & Notifications:**
  - Audit: `INVITATION_SENT`, `INVITATION_ACCEPTED`.
  - Notification: In-app invitation confirmation.
- **Automated Verification:** Verified in `tests/workflows.test.ts` (Workflow A).

---

## Workflow B: Daily Progress Report Lifecycle

- **Primary Roles:** Mentee (`MENTEE`), Assigned Mentor (`MENTOR`), Org Admin
- **User Intent:** Daily accountability log detailing work completed, learning insights, blockers, hours spent, and GitHub artifacts.
- **Entry Points:**
  - Mentee UI: `/org/[orgSlug]/student/daily-log`
  - Mentee API: `POST /api/reports`, `PATCH /api/reports/[id]`
  - Mentor Review UI: `/org/[orgSlug]/mentor/reports`
  - Mentor Review API: `POST /api/reports/[reportId]/reviews`
- **State Machine Transitions:**
  ```
  [DRAFT] 
     │
     ▼ (Mentee submits)
  [SUBMITTED] ◄──────────────┐
     │                       │ (Mentee edits & resubmits)
     ▼ (Mentor review)       │
  [CHANGES_REQUESTED] ───────┘
     │
     ▼ (Mentor approves)
  [REVIEWED]
  ```
- **Entities & Transitions:**
  - `DailyReport` (`id`, `reportDate`, `workDone`, `learning`, `blockers`, `hoursSpent`, `status`, `visibility`).
  - `ReportLink` (URLs pointing to verified GitHub pull requests, commits, issues).
  - `ReportReview` (`reviewerId`, `status: REVIEWED | CHANGES_REQUESTED`, `comment`, `createdAt`).
- **Authorization & Security:**
  - Only the authoring mentee can edit their own draft or returned report.
  - Only assigned mentors of that cohort or organization admins can review reports.
  - Cohort-shared visibility (`COHORT`) displays in cohort stream; `MENTORS_ONLY` reports are inaccessible to peer mentees.
- **Audit & Notifications:**
  - Audit: `REPORT_SUBMITTED`, `REPORT_REVIEWED`.
  - Notifications: Assigned mentor notified on submission (`REPORT_SUBMITTED`); mentee notified on review feedback (`REPORT_REVIEWED`).
- **Automated Verification:** Verified in `tests/workflows.test.ts` (Workflow B) and `tests/policies.test.ts`.

---

## Workflow C: Task Assignment & Evaluation

- **Primary Roles:** Mentor (`MENTOR`), Mentee (`MENTEE`), Org Admin
- **User Intent:** Distribute structured code deliverables, track status (`TODO` -> `IN_PROGRESS` -> `SUBMITTED`), evaluate submitted PRs, and record acceptances or revisions.
- **Entry Points:**
  - Mentor UI: `/org/[orgSlug]/mentor/tasks` -> "Create New Task" & "Evaluate Submission"
  - Mentor API: `POST /api/tasks`, `POST /api/task-assignments/[assignmentId]/reviews`
  - Mentee UI: `/org/[orgSlug]/student/tasks` -> "Start Task" & "Submit Deliverable"
  - Mentee API: `POST /api/task-assignments/[assignmentId]/submissions`
- **State Machine Transitions:**
  ```
  [TODO] ──► [IN_PROGRESS] ──► [SUBMITTED] ──► [CHANGES_REQUESTED] ──► [RESUBMITTED] ──► [COMPLETED]
  ```
- **Entities & Transitions:**
  - `Task` (`title`, `description`, `priority`, `category`, `dueAt`, `repositoryId`, `cohortId`).
  - `TaskAssignment` (`menteeId`, `status`, `assignedById`).
  - `TaskSubmission` (`notes`, `evidenceUrl`, `submittedById`, `submittedAt`).
  - `TaskReview` (`reviewerId`, `decision: ACCEPTED | CHANGES_REQUESTED`, `comment`).
- **Authorization & Security:**
  - Only assigned mentors and admins can create tasks and post reviews.
  - Mentees can only submit evidence for their own assigned tasks.
- **Audit & Notifications:**
  - Notifications: `TASK_ASSIGNED` sent to all assignees; `TASK_REVIEWED` sent to mentee upon mentor evaluation.
  - Audit: `TASK_CREATED`, `TASK_SUBMITTED`, `TASK_REVIEWED`.
- **Automated Verification:** Verified in `tests/workflows.test.ts` (Workflow C).

---

## Workflow D: Blocker Triage & Unblocking Lifecycle

- **Primary Roles:** Mentee (`MENTEE`), Mentor (`MENTOR`)
- **User Intent:** Mentees encounter technical/logistical blockers and raise urgent alerts; mentors inspect and provide actionable unblocking guidance.
- **Entry Points:**
  - Mentee UI: `/org/[orgSlug]/student/blockers` -> "Raise Blocker"
  - Mentee API: `POST /api/blockers`, `POST /api/blockers/[id]/reopen`
  - Mentor Triage UI: `/org/[orgSlug]/mentor/blockers` -> "Triage Pane"
  - Mentor API: `PATCH /api/blockers/[id]`
- **State Machine Transitions:**
  ```
  [OPEN] (Mentee creates)
     │
     ▼ (Mentor provides guidance)
  [IN_PROGRESS]
     │
     ▼ (Resolution confirmed)
  [RESOLVED]
     │
     ▼ (Mentee reopens if problem persists)
  [REOPENED]
  ```
- **Entities & Transitions:**
  - `Blocker` (`title`, `description`, `category`, `urgency: LOW | MEDIUM | HIGH | CRITICAL`, `status: OPEN | IN_PROGRESS | RESOLVED | REOPENED`, `response`, `firstRespondedAt`, `resolvedAt`, `mentorId`).
- **Authorization & Security:**
  - Mentees only view blockers they created.
  - Mentors only triage blockers for mentees enrolled in cohorts they mentor.
- **Audit & Notifications:**
  - Notifications: `BLOCKER_RAISED` sent to assigned cohort mentor; `BLOCKER_RESPONDED` sent to mentee with mentor guidance.
  - Audit: `BLOCKER_RAISED`, `BLOCKER_RESOLVED`, `BLOCKER_REOPENED`.
- **Automated Verification:** Verified in `tests/workflows.test.ts` (Workflow D).

---

## Workflow E: Learning Milestones & Skills Verification

- **Primary Roles:** Mentee (`MENTEE`), Mentor (`MENTOR`)
- **User Intent:** Progressive curriculum tracking where students submit evidence of competency for technical milestones.
- **Entry Points:**
  - Mentee UI: `/org/[orgSlug]/student/learning` -> "Submit Evidence"
  - Mentee API: `POST /api/learning/milestones/[milestoneId]/submit`
  - Mentor UI: `/org/[orgSlug]/mentor/mentees/[menteeId]?tab=learning`
  - Mentor API: `POST /api/learning/milestones/[milestoneId]/review`
- **State Machine Transitions:**
  ```
  [NOT_STARTED] ──► [IN_PROGRESS] ──► [SUBMITTED] ──► [APPROVED] | [CHANGES_REQUESTED]
  ```
- **Entities & Transitions:**
  - `LearningPath`, `LearningMilestone`, `Skill`.
  - `MenteeMilestone` (`notes`, `evidenceUrl`, `status`, `reviewedById`, `reviewedAt`).
- **Audit & Notifications:**
  - Notification: Mentor notified upon student submission; student notified upon approval.
  - Audit: `MILESTONE_SUBMITTED`, `MILESTONE_REVIEWED`.
- **Automated Verification:** Verified in `tests/workflows.test.ts` (Workflow E).

---

## Workflow F: Verified GitHub Webhook Ingestion

- **Primary Roles:** GitHub App / OAuth Service, Automated System Ingestion
- **User Intent:** Ingest real-time developer activity (commits, pull requests, issues, reviews) into verifiable database activity records.
- **Entry Points:**
  - Endpoint: `POST /api/webhooks/github`
  - Headers: `x-hub-signature-256`, `x-github-delivery`, `x-github-event`.
- **Processing Pipeline:**
  1. HMAC SHA-256 signature verification using `GITHUB_WEBHOOK_SECRET`.
  2. Idempotency check against `WebhookDelivery.deliveryId`. Duplicate deliveries return `{ alreadyProcessed: true }`.
  3. Delivery record created (`status: PROCESSING`).
  4. Activity normalization into `GitHubActivity` (`COMMIT`, `PULL_REQUEST`, `ISSUE`, `REVIEW`).
  5. Delivery marked `PROCESSED`.
- **Automated Verification:** Verified in `tests/workflows.test.ts` (Workflow F) and `tests/github-webhook.test.ts`.

---

## Workflow G: Structured Mentor Feedback & Evaluation

- **Primary Roles:** Mentor (`MENTOR`), Mentee (`MENTEE`)
- **User Intent:** Formal weekly/sprint evaluations evaluating technical strengths, improvement areas, code quality, and confidential notes.
- **Entry Points:**
  - Mentor UI: `/org/[orgSlug]/mentor/mentees/[menteeId]?tab=feedback`
  - Mentor API: `POST /api/feedback`
  - Mentee UI: `/org/[orgSlug]/student/feedback`
  - Mentee API: `POST /api/feedback/[id]/respond`
- **Privacy & Field-Level Access:**
  - `privateNotes` are stripped by `/api/feedback` whenever the requesting session user is a mentee.
  - Mentees can submit acknowledgments and clarification responses.
- **Automated Verification:** Verified in `tests/workflows.test.ts` (Workflow G).

---

## Workflow H: Cohort Discussions & Community

- **Primary Roles:** Mentee, Mentor, Org Admin
- **User Intent:** Async cohort collaboration, architecture questions, and peer problem-solving.
- **Entry Points:**
  - UI: `/org/[orgSlug]/community`
  - API: `POST /api/community/posts`, `POST /api/community/posts/[postId]/comments`
- **Entities & Hierarchy:**
  - `DiscussionPost` (`title`, `content`, `cohortId`, `isPinned`, `isLocked`).
  - `DiscussionComment` (`content`, `postId`, `parentId` for threaded nested conversations).
- **Automated Verification:** Verified in `tests/workflows.test.ts` (Workflow H).

---

## Workflow I: Events, RSVPs & Attendance Verification

- **Primary Roles:** Org Admin (`ORG_ADMIN`), Mentor (`MENTOR`), Mentee (`MENTEE`)
- **User Intent:** Schedule cohort workshops and office hours, collect student RSVPs, and record verified attendance.
- **Entry Points:**
  - Admin/Mentor UI: `/org/[orgSlug]/admin/events`
  - Admin/Mentor API: `POST /api/events`, `POST /api/events/[id]/attendance`
  - Mentee UI: `/org/[orgSlug]/student/events`
  - Mentee API: `POST /api/events/[id]/rsvp`
- **Entities & Transitions:**
  - `Event` (`title`, `description`, `startsAt`, `endsAt`, `meetingUrl`, `cohortId`).
  - `EventRsvp` (`userId`, `status: YES | NO | MAYBE`, `isExcuseRequested`, `excuseReason`).
  - `Attendance` (`userId`, `status: PRESENT | ABSENT | EXCUSED`, `recordedById`).
- **Automated Verification:** Verified in `tests/workflows.test.ts` (Workflow I).

---

## Workflow J: Mentor Scoping & Cohort Supervisions

- **Primary Roles:** Mentor, Organization Admin
- **User Intent:** Ensure mentors only access student profiles, reports, and blockers within cohorts assigned to them.
- **Enforcement Rules:**
  - Mentors have access to mentees with active enrollments in their assigned cohorts (`canViewMentee`).
  - Cross-cohort private data access without admin privileges is rejected with HTTP 403 / policy denial.
- **Automated Verification:** Verified in `tests/workflows.test.ts` (Workflow J) and `tests/policies.test.ts`.

---

## Workflow K: Account Suspension Enforcement

- **Primary Roles:** Org Admin, Super Admin
- **User Intent:** Immediate revocation of platform access for suspended accounts.
- **Enforcement Rules:**
  - `User.status = "SUSPENDED"` or `OrganizationMembership.status = "SUSPENDED"`.
  - Session verification in `src/server/auth/session.ts` rejects session validation if `user.status === "SUSPENDED"`.
  - API routes enforce active status checks before executing mutations.
- **Automated Verification:** Verified in `tests/workflows.test.ts` (Workflow K).

