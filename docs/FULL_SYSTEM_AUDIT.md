# OpenSourceHQ — Comprehensive System Audit & Defect Catalog

**Audit Date:** November 2026  
**Auditor:** Principal Software Architect, Senior Full-Stack Engineer, Product Engineer, Database Architect & Application Security Engineer  
**Scope:** Complete Codebase, Database Schema, API Routes, Backend Services, Frontend Pages, Authorization Policies, Notification System, GitHub Integration, and Workflows.  
**Document status:** This is the initial defect catalog, retained as audit history. Its observations describe the source tree at the time of the initial audit and are not a live production assessment. Later source remediations and current verification boundaries are documented in `docs/BUG_FIX_REPORT.md`, `docs/LOGIC_AUDIT_AND_KNOWN_LIMITATIONS.md`, and `docs/SANDBOX_WORK_REPORT.md`. The current sandbox source has not been dependency-built or integration-tested.

---

## 1. Executive Summary

A source review at the time of this initial audit identified **18 critical-to-medium functional disconnects and missing interactive workflows**. This document preserves the original findings for traceability; it should not be used alone to infer current implementation or runtime status.

The primary architectural issues identified:
1. **Passivity in Mentee Workspace:** Several student pages (Tasks, Learning Milestones, Repositories, Events, Profile) rendered database records but lacked interactive mutation controls (e.g. cannot start tasks, cannot submit evidence for learning milestones, cannot RSVP to events, notification checkboxes were unpersisted).
2. **Missing Dedicated Blocker Management:** Blockers were merely treated as an optional text string inside `DailyReport`. There was no persistent `Blocker` entity to assign urgency, track response/resolution times, assign mentors, or allow students to raise blockers from tasks or milestones.
3. **Passive Admin Workspaces:** Organization Admin pages (Members, Cohorts, Repositories, Events, Announcements) displayed tables but lacked interactive modals/forms to invite members, suspend accounts, create cohorts, add repositories, or create events.
4. **Disconnected In-App Notification Center:** The `Notification` model existed, but the Topbar bell was never rendered, no notification popover existed, and no API endpoints existed to fetch or mark notifications as read.
5. **Incomplete State Machines:** State machines for Daily Reports, Tasks, and Learning Milestones lacked transitional states (`UNDER_REVIEW`, `RESUBMITTED`, `CHANGES_REQUESTED`, `BLOCKED`, `OVERDUE`).
6. **Mentor Mentee Profile Incompleteness:** The Mentee Profile in the Mentor Workspace had 7 tabs instead of the 10 tabs required by specification (missing Repositories, Blockers, Communication History).

---

## 2. Detailed Defect Catalog

### Issue 1: Missing Notification Center & Bell Icon in Topbar
- **Feature:** In-App Notifications
- **Page/Route:** `src/components/layout/topbar.tsx`
- **Severity:** High
- **Root Cause:** Topbar imported `Bell` from `lucide-react` but never rendered it. No UI popover, unread count badge, or fetch mechanism existed.
- **Affected User Roles:** All (Org Admin, Mentor, Mentee, Super Admin)
- **Required Correction:** Implement `NotificationCenter` component with unread count badge, notification list popover, target URL navigation, and &ldquo;Mark All as Read&rdquo; action backed by `/api/notifications`.
- **Verification Method:** Create a notification, verify badge updates, click popover, mark read, and verify database state.

---

### Issue 2: Missing Dedicated Blocker Management System
- **Feature:** Blocker Management & Resolution Workflow
- **Page/Route:** Missing `/org/[orgSlug]/student/blockers`, `/org/[orgSlug]/mentor/blockers`, `/api/blockers`
- **Severity:** Critical
- **Root Cause:** Blockers were only stored as an ad-hoc nullable string on `DailyReport`. No database model existed to track status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `REOPENED`), urgency (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), source, mentor assignment, response times, or resolution notes.
- **Affected User Roles:** Mentee, Mentor, Org Admin
- **Required Correction:**
  1. Add `Blocker` model to `prisma/schema.prisma` with relations to Mentee, Mentor, Organization, and Cohort.
  2. Implement `src/features/blockers/blockers-service.ts`.
  3. Create API endpoints `/api/blockers` and `/api/blockers/[id]`.
  4. Build Student Blocker submission UI and Mentor Blocker triage/resolution workspace.
- **Verification Method:** Mentee logs a blocker with High urgency; Mentor receives notification, responds with guidance, and marks resolved; Mentee receives notification.

---

### Issue 3: Incomplete Daily Report State Transitions & Revisions
- **Feature:** Daily Progress Reports
- **Page/Route:** `src/app/org/[orgSlug]/student/daily-log/page.tsx`, `src/features/reports/reports-service.ts`
- **Severity:** High
- **Root Cause:** `ReportStatus` enum lacked `UNDER_REVIEW` and `RESUBMITTED`. Students could not view previous review comments while editing returned reports, nor could they respond directly to mentor feedback.
- **Affected User Roles:** Mentee, Mentor
- **Required Correction:**
  1. Extend `ReportStatus` to include `UNDER_REVIEW` and `RESUBMITTED`.
  2. Add mentee revision notes support.
  3. In `daily-log/page.tsx`, pre-fill existing report for the date if returned for changes, display mentor comment, and support `RESUBMITTED` transition.
- **Verification Method:** Submit report -> Mentor requests changes -> Mentee edits and resubmits -> Status updates to `RESUBMITTED` -> Mentor marks `REVIEWED`.

---

### Issue 4: Student Report History Lacks Filters & Detailed Inspection View
- **Feature:** Report History
- **Page/Route:** `src/app/org/[orgSlug]/student/reports/page.tsx`
- **Severity:** Medium
- **Root Cause:** Displayed a flat list with no date filters, status filters, cohort filters, or search bar.
- **Affected User Roles:** Mentee
- **Required Correction:** Implement interactive filtering by status (`ALL`, `SUBMITTED`, `REVIEWED`, `CHANGES_REQUESTED`), search input, and expandable detailed view showing all fields (hours, deliverables, learnings, blockers, review timestamps).
- **Verification Method:** Filter reports by status and verify list dynamically filters matching records.

---

### Issue 5: Student Task Interaction Gaps
- **Feature:** Task Management
- **Page/Route:** `src/app/org/[orgSlug]/student/tasks/page.tsx`, `src/app/api/tasks/route.ts`
- **Severity:** High
- **Root Cause:** The page showed assigned tasks and previous submissions, but had no modal or button for the mentee to submit new evidence, attach PR links, report blockers on the task, or update status to `IN_PROGRESS`.
- **Affected User Roles:** Mentee
- **Required Correction:** Add interactive submission dialog allowing mentees to:
  1. Update task to `IN_PROGRESS`.
  2. Submit evidence URL, notes, and pull request links.
  3. Resubmit after changes requested.
- **Verification Method:** Mentee opens task modal, enters PR link and notes, submits; task status moves to `SUBMITTED`; mentor sees submission.

---

### Issue 6: Learning Milestones Actionability Gaps
- **Feature:** Learning Paths & Skill Milestones
- **Page/Route:** `src/app/org/[orgSlug]/student/learning/page.tsx`
- **Severity:** High
- **Root Cause:** Milestones were rendered as static cards with status badges. Mentees could not mark milestones as started (`IN_PROGRESS`), submit completion evidence URLs, or record notes for mentor evaluation.
- **Affected User Roles:** Mentee, Mentor
- **Required Correction:**
  1. Add modal dialog on each milestone to submit evidence URL and practical notes.
  2. Support `IN_PROGRESS -> SUBMITTED -> APPROVED` / `CHANGES_REQUESTED -> RESUBMITTED` lifecycle.
  3. Create `/api/learning/milestones/[milestoneId]/submit` endpoint.
- **Verification Method:** Mentee clicks &ldquo;Submit Evidence&rdquo;, enters URL and notes; status updates to `SUBMITTED`; Mentor reviews and approves.

---

### Issue 7: Community Discussions Lacks Threading, Deletion, and Locking
- **Feature:** Cohort Community
- **Page/Route:** `src/app/org/[orgSlug]/student/community/page.tsx`
- **Severity:** Medium
- **Root Cause:** Comments were single-level only. No `parentId` existed on `DiscussionComment` for nested replies. Authors could not delete their own posts, and mentors could not lock discussions.
- **Affected User Roles:** Mentee, Mentor, Org Admin
- **Required Correction:**
  1. Add `parentId` to `DiscussionComment` and `isLocked` to `DiscussionPost`.
  2. Add delete post button for post author or admin.
  3. Add reply button on comments for threaded discussion.
  4. Allow mentors/admins to lock/unlock posts.
- **Verification Method:** Create post, add comment, add nested reply, verify correct hierarchy and permissions.

---

### Issue 8: Feedback Acknowledgment & Mentee Response Missing
- **Feature:** Mentor Feedback
- **Page/Route:** `src/app/org/[orgSlug]/student/feedback/page.tsx`, `src/features/feedback/feedback-service.ts`
- **Severity:** Medium
- **Root Cause:** Mentee feedback showed whether it was acknowledged, but had no button to actually trigger acknowledgment or submit a response/clarification back to the mentor.
- **Affected User Roles:** Mentee, Mentor
- **Required Correction:**
  1. Add `menteeResponse` text field and `status` (`DRAFT`, `PUBLISHED`) to `Feedback`.
  2. Add &ldquo;Acknowledge Feedback&rdquo; button and &ldquo;Reply / Clarification&rdquo; form on Student Feedback page.
  3. Create `/api/feedback/[id]/respond` endpoint.
- **Verification Method:** Mentee types response and clicks acknowledge; database records timestamp and response; mentor sees acknowledgment.

---

### Issue 9: Events RSVP & Absence Excuse Workflow Missing
- **Feature:** Events & Attendance
- **Page/Route:** `src/app/org/[orgSlug]/student/events/page.tsx`
- **Severity:** Medium
- **Root Cause:** Mentees could only view event cards. They could not RSVP (`YES`, `NO`, `MAYBE`) or submit an excuse for absence with notes.
- **Affected User Roles:** Mentee, Mentor, Org Admin
- **Required Correction:**
  1. Add `EventRsvp` model to Prisma schema (`eventId`, `userId`, `status`, `isExcuseRequested`, `excuseReason`).
  2. Add RSVP controls and &ldquo;Request Excuse for Absence&rdquo; dialog on Student Events page.
  3. Create `/api/events/[id]/rsvp` endpoint.
- **Verification Method:** Mentee RSVPs with excuse note; mentor/admin attendance view displays the excuse request.

---

### Issue 10: Profile Settings Checkboxes Unpersisted & Password Change Missing
- **Feature:** Profile & Notification Preferences
- **Page/Route:** `src/app/org/[orgSlug]/student/profile/page.tsx`
- **Severity:** High
- **Root Cause:** The profile page had raw HTML checkboxes with `defaultChecked` and no `onChange` handlers. Display name and timezone could not be updated. Password change was absent.
- **Affected User Roles:** All
- **Required Correction:**
  1. Convert profile page to interactive client component with form state.
  2. Add display name and timezone inputs with submit button.
  3. Connect notification preferences checkboxes to `/api/settings/notifications` endpoint with database persistence.
  4. Add Change Password form validating current password and updating `passwordHash`.
- **Verification Method:** Toggle a notification preference, reload page, verify preference persisted in database.

---

### Issue 11: Mentor Mentee Profile Missing 3 of 10 Required Tabs
- **Feature:** Mentee Management
- **Page/Route:** `src/app/org/[orgSlug]/mentor/mentees/[menteeId]/page.tsx`
- **Severity:** High
- **Root Cause:** Mentee profile contained only 7 tabs: Overview, GitHub, Reports, Tasks, Learning, Feedback, Attendance. It lacked **Repositories**, **Blockers**, and **Communication History** (all required by specification).
- **Affected User Roles:** Mentor, Org Admin
- **Required Correction:** Add the 3 missing tabs:
  - *Repositories:* Repositories contributed to by this mentee and assigned issue work.
  - *Blockers:* History of blockers raised by this mentee, urgency, status, and resolution timestamps.
  - *Communication History:* Forum posts, comments, and mentor-mentee feedback threads.
- **Verification Method:** Navigate through all 10 tabs; verify each loads correct mentee-scoped database records.

---

### Issue 12: Mentor Task Creation & Evaluation Dialogs Missing
- **Feature:** Mentor Task Management
- **Page/Route:** `src/app/org/[orgSlug]/mentor/tasks/page.tsx`
- **Severity:** High
- **Root Cause:** Mentors could see a list of tasks, but could not create new tasks, assign them to mentees/cohorts, or evaluate/accept submissions directly from the page.
- **Affected User Roles:** Mentor
- **Required Correction:**
  1. Add &ldquo;Create New Task&rdquo; modal with title, description, priority, category, cohort/mentee selector, due date, repository link, and acceptance criteria.
  2. Add &ldquo;Evaluate Submission&rdquo; action on pending task assignments with Accept / Request Changes options and feedback comments.
- **Verification Method:** Mentor creates task assigned to Mentee; Mentee sees task in dashboard; Mentee submits evidence; Mentor evaluates and marks accepted.

---

### Issue 13: Mentor Action Center Missing on Dashboard
- **Feature:** Mentor Dashboard
- **Page/Route:** `src/app/org/[orgSlug]/mentor/page.tsx`
- **Severity:** Medium
- **Root Cause:** The dashboard showed high-level metric counts but lacked an actionable &ldquo;Action Center&rdquo; listing concrete operational alerts (e.g. &ldquo;3 daily reports awaiting review&rdquo;, &ldquo;2 tasks submitted for acceptance&rdquo;, &ldquo;1 unresolved blocker&rdquo;).
- **Affected User Roles:** Mentor
- **Required Correction:** Add an actionable &ldquo;Mentor Action Center&rdquo; section with immediate links to review reports, evaluate task submissions, and address unresolved blockers.
- **Verification Method:** Submit reports and tasks in seed data; verify Action Center reflects exact actionable items.

---

### Issue 14: Student Dashboard Missing "Needs Your Attention" & Streak Calculations
- **Feature:** Student Dashboard
- **Page/Route:** `src/app/org/[orgSlug]/student/page.tsx`
- **Severity:** Medium
- **Root Cause:** Dashboard lacked streak calculation, reports awaiting review vs requiring changes counts, and a dedicated &ldquo;Needs Your Attention&rdquo; alert section.
- **Affected User Roles:** Mentee
- **Required Correction:**
  1. Calculate consecutive day reporting streak from database `DailyReport` records.
  2. Add &ldquo;Needs Your Attention&rdquo; card listing pending actions (e.g. daily report missing today, changes requested by mentor, upcoming task deadlines).
  3. Ensure all metric cards link directly to relevant sub-pages.
- **Verification Method:** Verify streak is accurately computed; verify attention items display when changes are requested or report is unsubmitted.

---

### Issue 15: Admin Member Management Lacks Invite & Role Modification Controls
- **Feature:** Member Management
- **Page/Route:** `src/app/org/[orgSlug]/admin/members/page.tsx`
- **Severity:** High
- **Root Cause:** Page showed member table, but lacked &ldquo;Invite Member&rdquo; button, role change dropdown, account suspension toggle, or invitation revocation controls.
- **Affected User Roles:** Org Admin
- **Required Correction:**
  1. Add &ldquo;Invite Member&rdquo; modal dialog (email, role: `MENTOR` or `MENTEE`, cohort selection).
  2. Add role change dropdown and suspend/reactivate actions per member.
  3. Add pending invitations section with &ldquo;Resend&rdquo; and &ldquo;Revoke&rdquo; buttons.
- **Verification Method:** Admin invites new user, changes role, suspends user; verify suspended user cannot sign in.

---

### Issue 16: Admin Cohort Management Lacks Creation & Assignment Controls
- **Feature:** Cohort Management
- **Page/Route:** `src/app/org/[orgSlug]/admin/cohorts/page.tsx`
- **Severity:** High
- **Root Cause:** Displayed existing cohorts, but lacked &ldquo;Create Cohort&rdquo; button, mentor assignment dialog, mentee enrollment dialog, or archive cohort action.
- **Affected User Roles:** Org Admin
- **Required Correction:** Add &ldquo;Create Cohort&rdquo; modal (name, slug, description, start/end dates, timezone) and &ldquo;Manage Mentors & Repositories&rdquo; dialog.
- **Verification Method:** Admin creates new cohort; cohort immediately appears in list and becomes available for enrollment.

---

### Issue 17: Admin Events & Announcements Lack Creation Forms
- **Feature:** Events & Announcements
- **Page/Route:** `src/app/org/[orgSlug]/admin/events/page.tsx`, `src/app/org/[orgSlug]/admin/announcements/page.tsx`
- **Severity:** Medium
- **Root Cause:** Pages were read-only displays with no interactive &ldquo;Create Event&rdquo; or &ldquo;New Announcement&rdquo; buttons or modals.
- **Affected User Roles:** Org Admin
- **Required Correction:** Add creation dialogs for events (title, startsAt, endsAt, meetingUrl, cohort selection) and announcements (title, body, cohort or org-wide).
- **Verification Method:** Create event and announcement; verify they display in student and mentor dashboards.

---

### Issue 18: Account Suspension Policy Enforcement in Session Handler
- **Feature:** Security & Access Control
- **Page/Route:** `src/server/auth/session.ts`
- **Severity:** Critical
- **Root Cause:** While `getSession()` checked `user.status === "SUSPENDED"`, API routes that accept tokens directly or cached sessions must ensure suspended users are instantly revoked.
- **Affected User Roles:** All
- **Required Correction:** Ensure every API endpoint checks active membership status (`membership.status === 'ACTIVE'`) and user status (`user.status === 'ACTIVE'`).
- **Verification Method:** Admin suspends Mentee A; Mentee A’s subsequent API requests are rejected with 403 Forbidden.

---

## 3. Implementation Roadmap

1. **Database Schema Enhancements:**
   - Add `Blocker` model, `EventRsvp` model.
   - Update enums for `ReportStatus`, `TaskAssignmentStatus`, `MilestoneStatus`, `BlockerUrgency`, `BlockerStatus`.
   - Update `Feedback` with structured evaluation fields and private notes.
   - Run `pnpm prisma db push`.
2. **Backend Services & API Expansion:**
   - Create `src/features/blockers/blockers-service.ts` and `/api/blockers`.
   - Create `/api/notifications` routes (list, mark read, mark all read).
   - Create `/api/settings/notifications` and `/api/settings/profile`.
   - Create `/api/learning/milestones/[milestoneId]/submit`.
   - Create `/api/events/[id]/rsvp`.
   - Create `/api/feedback/[id]/respond`.
   - Create `/api/orgs/[orgId]/members/[membershipId]` for role changes and suspension.
   - Create `/api/cohorts` creation route.
3. **Frontend Workspaces Repair:**
   - Add `NotificationCenter` into Topbar.
   - Build Student Blocker, Tasks, Learning, Community, Events, and Profile interactive forms.
   - Build Mentor Blocker triage, Action Center, Task creation/evaluation, and 10-tab Mentee Profile.
   - Build Admin Member invitation, Cohort creation, Event creation, and Announcement publishing modals.
4. **Automated Testing & Verification:**
   - Expand unit and integration test suite to cover all 11 cross-role workflows (A through K).
   - Run full typecheck, lint, test, and production build.
5. **Documentation & Deliverables:**
   - `docs/FULL_SYSTEM_AUDIT.md` (this document)
   - `docs/WORKFLOW_MATRIX.md`
   - `docs/BUG_FIX_REPORT.md`
   - `docs/SECURITY_AUDIT.md`
   - `docs/TESTING_REPORT.md`
   - `docs/DEPLOYMENT_READINESS.md`

