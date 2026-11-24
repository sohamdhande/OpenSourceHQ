# UX, Navigation and Route Specification

## 1. Visual direction
Build a polished developer-focused SaaS interface. Avoid a generic school ERP appearance.
- Light and dark themes with persistent user preference.
- Neutral surfaces, clear typography, restrained blue/indigo accent.
- Compact but readable data tables.
- Consistent status badges.
- Responsive sidebar: expanded on desktop, drawer on mobile.
- Top bar: breadcrumbs, organization switcher, search, notifications, theme, account menu.
- Accessible contrast, keyboard navigation and visible focus states.

## 2. Global routes
- `/` marketing/landing or redirect to app based on session.
- `/login`
- `/register` only if enabled; otherwise invitation-only.
- `/invite/[token]`
- `/forgot-password`
- `/reset-password`
- `/settings/profile`
- `/settings/security`
- `/settings/notifications`
- `/org/[orgSlug]/...` organization-scoped app routes.

## 3. Organization admin routes
- `/org/[orgSlug]/admin`
- `/org/[orgSlug]/admin/members`
- `/org/[orgSlug]/admin/mentors`
- `/org/[orgSlug]/admin/mentees`
- `/org/[orgSlug]/admin/cohorts`
- `/org/[orgSlug]/admin/cohorts/[cohortId]`
- `/org/[orgSlug]/admin/repositories`
- `/org/[orgSlug]/admin/tasks`
- `/org/[orgSlug]/admin/reports`
- `/org/[orgSlug]/admin/analytics`
- `/org/[orgSlug]/admin/announcements`
- `/org/[orgSlug]/admin/events`
- `/org/[orgSlug]/admin/integrations/github`
- `/org/[orgSlug]/admin/audit`
- `/org/[orgSlug]/admin/settings`

## 4. Mentor routes
- `/org/[orgSlug]/mentor`
- `/org/[orgSlug]/mentor/cohorts`
- `/org/[orgSlug]/mentor/cohorts/[cohortId]`
- `/org/[orgSlug]/mentor/mentees`
- `/org/[orgSlug]/mentor/mentees/[menteeId]`
- `/org/[orgSlug]/mentor/reports`
- `/org/[orgSlug]/mentor/tasks`
- `/org/[orgSlug]/mentor/reviews`
- `/org/[orgSlug]/mentor/analytics`
- `/org/[orgSlug]/mentor/events`

Mentee profile tabs:
Overview | GitHub | Daily Reports | Tasks | Learning | Feedback | Attendance

## 5. Mentee routes
- `/org/[orgSlug]/student`
- `/org/[orgSlug]/student/daily-log`
- `/org/[orgSlug]/student/reports`
- `/org/[orgSlug]/student/github`
- `/org/[orgSlug]/student/repositories`
- `/org/[orgSlug]/student/tasks`
- `/org/[orgSlug]/student/learning`
- `/org/[orgSlug]/student/community`
- `/org/[orgSlug]/student/feedback`
- `/org/[orgSlug]/student/events`
- `/org/[orgSlug]/student/profile`

## 6. Community routes
- `/org/[orgSlug]/community`
- `/org/[orgSlug]/community/discussions`
- `/org/[orgSlug]/community/discussions/[postId]`
- `/org/[orgSlug]/community/members/[userId]` (only shared profile fields)

## 7. Admin dashboard widgets
- Total mentors, mentees and active cohorts.
- Report submission status for selected date range.
- Overdue tasks.
- GitHub activity trend.
- Repository sync health.
- Cohort comparison.
- Recent organization activity.
- Filters: cohort, mentor, date range, activity type.

## 8. Mentor dashboard widgets
- Assigned cohort summary.
- Mentee status distribution.
- Missing reports.
- Overdue tasks.
- Reports awaiting review.
- Recent GitHub activity.
- Upcoming events.
- Quick actions: assign task, review reports, post announcement.

## 9. Student dashboard widgets
- Today's daily report status and submit action.
- My open tasks and due dates.
- My GitHub activity summary.
- Learning milestones.
- Upcoming events.
- Shared cohort activity.
- Recent mentor feedback.

## 10. Key UX workflows
### Invite and onboard a mentee
Admin/mentor authorized to invite → select organization role → optionally assign cohort → system sends invite → user accepts → account is linked → onboarding completes → cohort membership active.

### Create cohort and assign mentors
Admin creates cohort → adds mentor(s) → invites/enrolls mentees → assigns repositories → cohort dashboard becomes available.

### Submit daily report
Mentee selects cohort/date → fills work, learning, blockers and next steps → chooses visibility → saves draft or submits → mentor receives notification → mentor reviews or requests changes.

### Assign and complete task
Mentor creates task → assigns to mentee/cohort → mentee updates status → submits evidence → mentor accepts or requests changes → history retained.

### Connect GitHub
Mentee links GitHub identity → consent flow → backend validates identity → account shown as connected → repository installation/selection occurs → webhook sync begins → activity timeline displays sync state.

### Suggest repository
Mentee submits repository URL and reason → mentor/admin reviews → approve/reject → approved repository linked to cohort.

## 11. Component requirements
Reusable components:
- AppShell, Sidebar, Topbar, OrganizationSwitcher.
- DataTable with search, filters, sorting, pagination.
- MetricCard, ChartCard, ActivityTimeline.
- StatusBadge, VisibilityBadge.
- EmptyState, ErrorState, LoadingSkeleton.
- ConfirmDialog, FormDialog, Sheet/Drawer.
- DateRangePicker, CohortFilter, MemberCombobox.
- ReportEditor, TaskForm, FeedbackForm.
- GitHubConnectionCard, RepositoryCard.
- NotificationCenter.

## 12. Interaction quality
- Every visible primary button must work.
- Forms show inline validation and server errors.
- Destructive actions require confirmation.
- Tables have empty, loading and error states.
- Use optimistic updates only where safe and reconcile server state.
- Preserve filters in URL search parameters where practical.
- Avoid huge unpaginated tables.
- Ensure mobile layouts remain usable.
