# Product Requirements Document (PRD)
## OpenSourceHQ — Open Source Mentorship Management Platform

**Status:** Build specification  
**Version:** 1.0  
**Release scope:** MVP + complete core mentorship operations  
**AI:** Explicitly excluded from this release

---

## 1. Product summary

OpenSourceHQ is a responsive, multi-tenant web platform for organizations that run open-source mentorship programs. It helps organization administrators coordinate mentors and cohorts, helps mentors manage mentees and evaluate progress, and gives students a personal workspace for tasks, daily reports, learning milestones and GitHub contributions.

The platform combines human-submitted progress with verified GitHub events. It must not treat raw commit volume as a proxy for contribution quality.

## 2. Problem statement

Mentors currently rely on fragmented spreadsheets, chat messages, GitHub profiles and manual check-ins to understand student progress. This makes it difficult to:
- Know who is active or blocked.
- Review daily work consistently.
- Track tasks and deadlines.
- See actual repository participation.
- Compare progress fairly across a cohort.
- Maintain a history of feedback and mentorship decisions.
- Coordinate multiple mentors and cohorts.

OpenSourceHQ centralizes these workflows and provides transparent, permission-aware progress information.

## 3. Goals

### Primary goals
1. Give administrators a complete view of an organization’s mentorship program.
2. Give mentors a focused view of assigned cohorts and mentees.
3. Give mentees a personal workspace and visibility into shared cohort activity.
4. Collect structured daily progress reports.
5. Assign, track and review mentorship tasks.
6. Synchronize GitHub activity automatically where permissions and credentials allow.
7. Provide useful analytics based on explainable source data.
8. Support multiple organizations, mentors and cohorts without redesign.

### Non-goals for this release
- AI chatbot, AI summaries, AI scoring or AI recommendations.
- Native iOS or Android applications.
- Payroll, stipend or financial management.
- Full learning management system with video hosting and exams.
- Replacement for GitHub issue/PR review.
- Public social network or unrestricted public profiles.
- Microservices architecture.
- Automatic grading of code or students.

## 4. Target users and personas

### Platform Super Admin
Operates the platform itself. Can manage platform-level organizations and platform configuration. Should not automatically gain access to private organization content without an explicit support/audit workflow.

### Organization Admin
Owns an organization workspace. Manages organization members, mentors, cohorts, repositories, settings, announcements and organization analytics.

### Mentor
Assigned to one or more cohorts. Manages assigned mentees, creates tasks, reviews daily reports, provides feedback, monitors GitHub activity and runs cohort reviews.

### Mentee
Belongs to one or more cohorts. Submits daily reports, completes tasks, links GitHub, tracks learning milestones, views own analytics and sees cohort-shared activity.

### Observer / Guest
Can view only explicitly shared pages or reports. Read-only and optional for MVP; do not grant broad access by default.

## 5. Product principles

- Evidence over vanity metrics.
- Transparent progress: every metric should be traceable to underlying reports, tasks or GitHub events.
- Privacy by default for sensitive student information.
- Cohort collaboration without exposing private feedback.
- Human mentor judgment remains authoritative.
- Multi-tenant security is foundational, not an add-on.
- External integrations are replaceable adapters.
- Responsive web first; PWA-friendly.
- Accessible, clear and consistent UI.

## 6. Core product modules

### 6.1 Identity, authentication and onboarding
- Email/password or secure supported authentication provider.
- Email verification and password reset.
- Session management and sign out.
- Invite-based organization membership.
- Role selection must be controlled by authorized admins; users cannot self-assign elevated roles.
- Onboarding captures display name, timezone, avatar and optional GitHub connection.
- Account status: invited, active, suspended, deactivated.
- Profile settings and notification preferences.

### 6.2 Organization management
- Organization profile: name, slug, logo, description, timezone and settings.
- Organization admins can invite/remove members and assign roles.
- Member directory with filters.
- Organization-level settings for report schedule, visibility defaults and contribution targets.
- A user may belong to multiple organizations with a different role in each.
- Data must never leak across organizations.

### 6.3 Cohort management
- Create, edit, archive cohorts.
- Cohort fields: name, description, start/end dates, status, timezone and organization.
- Assign multiple mentors to a cohort.
- Enroll and remove mentees.
- Cohort member directory.
- Cohort-level repositories, tasks, announcements, events and analytics.
- Cohort status: planned, active, completed, archived.
- Preserve historical records when a cohort is archived.

### 6.4 Mentee management
- Mentee directory with search, filters and pagination.
- Individual profile with identity, cohort membership, mentor assignment, GitHub account, activity, reports, tasks, milestones and feedback.
- Status indicators: active, needs_attention, inactive, on_break, completed.
- Status must be derived from explicit rules or set by authorized mentors/admins; do not infer personal circumstances.
- Mentor can see only assigned mentees in assigned cohorts unless organization admin.
- Mentee can edit permitted profile fields only.

### 6.5 Daily progress reports
A mentee can submit one report per cohort per local calendar date. Allow edits until a configurable cutoff or mentor review; preserve updated timestamps and review history.

Fields:
- Report date.
- Work completed.
- What I learned.
- GitHub links (optional list).
- Hours spent (optional; never mandatory by default).
- Blockers / help needed.
- Plan for next working session.
- Visibility: private-to-mentors or cohort-shared.
- Attachments optional, subject to file size/type restrictions.

Statuses:
- draft
- submitted
- reviewed
- changes_requested

Mentor actions:
- View submitted reports.
- Add review comment.
- Mark reviewed.
- Request changes.
- Filter by date, cohort, mentee and status.
- View report history.

Rules:
- A report cannot be submitted on behalf of a mentee unless an explicit administrative correction workflow exists and is audited.
- A missing report is not automatically evidence of no work.
- Do not expose private report fields to other mentees.

### 6.6 Task management
- Mentors/admins create tasks with title, description, priority, category, due date, optional repository/issue URL and estimated effort.
- Assign to one mentee, multiple mentees or a cohort.
- Mentee can view tasks, update progress, add notes and submit links/evidence.
- Mentor can comment, accept submission, request changes or mark complete.
- Task statuses: todo, in_progress, submitted, changes_requested, completed, cancelled.
- Priority: low, normal, high, urgent.
- Track created_by, assigned_by, timestamps and status history.
- Support task templates in a later iteration; schema should not prevent it.

### 6.7 GitHub integration and activity
- Link a GitHub identity to a mentee account.
- Support GitHub App installation for repositories/organizations that grant access.
- Support manually adding a public repository for tracking where permitted.
- Track repositories by organization/cohort and optional individual assignment.
- Ingest webhook events for push, pull request, issue, review, comment and release events as supported.
- Store normalized activity records with source event identifiers and URLs.
- Provide a timeline and basic counts by date/type/repository.
- Do not claim complete visibility into private activity unless installation permissions allow it.
- Include periodic reconciliation to recover missed webhook events where API access permits.
- Show last successful sync and connection health.
- Allow disconnect/revoke.
- Avoid double counting commits and push events.

### 6.8 Repository management
- Admin/mentor can add repositories to an organization or cohort.
- Students can suggest repositories; mentor/admin approves before cohort tracking.
- Repository metadata: provider, external ID, owner, name, full name, URL, default branch, visibility, sync status.
- Associate repository with cohorts and optional tasks.
- Repository detail page shows contributors/activity available to the integration.
- Never imply that a repository is fully monitored if permissions are incomplete.

### 6.9 Learning roadmap and milestones
- Mentor/admin can create learning paths and milestones.
- Assign a learning path to a mentee or cohort.
- Mentee can mark a milestone complete and provide evidence/notes.
- Mentor can review/confirm milestone completion.
- Skill taxonomy should be configurable and not hardcoded to one language.
- Keep learning milestones distinct from GitHub activity.

### 6.10 Feedback and reviews
- Mentor can leave feedback for an assigned mentee.
- Feedback visibility: private_to_mentee, private_to_mentors, cohort_shared (only when appropriate).
- Support feedback category: technical, collaboration, communication, learning, general.
- Mentee can acknowledge feedback and optionally respond.
- Feedback history is immutable in the sense that edits/deletions are audited.
- Never expose private mentor notes to cohort members.

### 6.11 Community and shared cohort activity
- Cohort activity feed for explicitly shareable events: achievements, merged PRs, completed milestones and selected announcements.
- Students can view other students’ shared profile fields and cohort-shared activity.
- Discussion posts and comments are optional but included in the core product scope.
- Users can report inappropriate content; organization admins can moderate.
- No private report details, private feedback, email addresses or tokens in shared feeds.

### 6.12 Announcements, events and attendance
- Admin/mentor can publish announcements to organization or selected cohorts.
- Events include title, description, start/end, location/meeting URL and target audience.
- Attendance statuses: present, absent, excused, not_recorded.
- Attendance is recorded by authorized mentor/admin; mentee can view their own record.
- Reminders use in-app notifications and optional email provider.

### 6.13 Notifications
- In-app notifications for task assignments, due dates, report review, feedback, announcements, events and GitHub connection health.
- Read/unread state.
- User notification preferences.
- Email delivery behind a provider adapter; in-app notifications must work without email credentials.
- Avoid sending duplicate notifications for webhook retries.

### 6.14 Analytics and reporting
Admin views:
- Active cohorts and membership counts.
- Report submission rate.
- Task completion and overdue tasks.
- GitHub activity by type and period.
- Repository participation.
- Attendance summaries.
- Cohort comparison.

Mentor views:
- Assigned mentee activity.
- Missing reports.
- Overdue tasks.
- Blocker frequency from report categories/text search (no AI interpretation).
- GitHub activity timeline.
- Weekly progress based on underlying data.

Mentee views:
- Own task progress.
- Own report history.
- Own GitHub activity.
- Own learning milestones.
- Shared cohort activity.

Analytics must state date range, definitions and source data. Do not use a single opaque “student quality” score in MVP.

### 6.15 Audit logs
Record security-sensitive actions:
- Member invitation, role change, suspension/removal.
- Cohort creation/archive and membership changes.
- Task assignment/status override.
- Report review and changes request.
- Feedback creation/edit/deletion.
- Repository connection/disconnection.
- GitHub installation changes.
- Organization settings changes.

Audit entries include actor, organization, action, target type/id, timestamp, safe metadata and request correlation ID. Never store secrets or full sensitive payloads.

## 7. Shared data and privacy model

Default visibility:
- Profile: selected display name, avatar, cohort and public GitHub handle can be cohort-visible.
- Daily report: private-to-mentors by default; mentee may choose cohort-shared if organization allows.
- GitHub activity: cohort-visible only for repositories/activity configured as shareable.
- Tasks: visible to assignee and assigned mentors; cohort-wide tasks are visible to cohort.
- Feedback: private-to-mentee by default.
- Mentor private notes: mentor/admin only.
- Email, authentication details and tokens: never cohort-visible.

Provide clear visibility badges and controls. Enforce visibility on the server, not only in the UI.

## 8. Success metrics

Product metrics:
- Percentage of active mentees submitting reports.
- Mentor weekly active usage.
- Task completion rate.
- Median time from task assignment to submission.
- GitHub connection rate.
- Percentage of tracked repositories with healthy sync.
- Percentage of reports reviewed within target time.
- Cohort retention/completion rate.

Do not optimize solely for commit count or daily streaks.

## 9. MVP release acceptance

MVP is accepted when:
- Users can authenticate and join an organization by invite.
- Organization admins can create cohorts, invite mentors/mentees and assign roles.
- Mentors can manage assigned cohorts and mentees.
- Mentees can submit and edit daily reports under the defined rules.
- Mentors can review reports and leave feedback.
- Tasks can be created, assigned, submitted and reviewed.
- Users can connect GitHub and see linked identity state.
- GitHub webhook events are verified, processed idempotently and displayed as normalized activity when credentials are configured.
- Repository tracking and cohort association work.
- Dashboards use database-backed data.
- Shared cohort activity respects visibility rules.
- Light/dark themes work.
- Critical authorization tests pass.
- Setup, migration, seed and deployment documentation exists.

## 10. Future extensibility (without implementing AI)
Create integration seams for:
- AI/LLM providers (future, not implemented).
- Discord/Slack/Telegram notifications.
- Calendar providers.
- Additional source-control providers (GitLab/Bitbucket).
- LMS and learning content providers.
- External analytics and reporting.
- SSO providers.
Use interfaces/adapters and event-driven internal domain events. Do not create empty user-facing AI features or speculative dependencies now.
