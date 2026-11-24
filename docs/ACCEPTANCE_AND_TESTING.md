# Acceptance Criteria and Test Plan

## 1. Authentication and membership
- A user can sign in and sign out.
- An invited user can accept a valid, unexpired invitation.
- Expired/revoked invitation is rejected.
- User cannot self-assign organization admin or mentor role.
- User can switch only among organizations where they have active membership.

## 2. Organization and cohort
- Organization admin can create/edit/archive a cohort.
- Admin can invite mentors and mentees.
- Admin can assign multiple mentors to a cohort.
- Admin can enroll mentees.
- Mentor sees only assigned cohorts.
- Archived cohort history remains readable according to permissions.

## 3. Reports
- Mentee can create one report per cohort/date.
- Duplicate report for same cohort/date is rejected or opens existing report.
- Mentee can save draft and submit.
- Mentor can review or request changes.
- Report visibility is enforced for cohort members.
- Report edits preserve timestamps and review history.

## 4. Tasks
- Mentor can create and assign tasks.
- Mentee can update status and submit evidence.
- Mentor can accept or request changes.
- Unassigned mentee cannot access task assignment.
- Due date and status filters work.

## 5. GitHub
- User can link GitHub account when GitHub App user-authorization credentials are configured.
- Mentees and mentors can search for and choose any public GitHub repository by search query, `owner/repository`, or URL, including OpenMRS and Sugar Labs projects.
- A mentor can assign a repository to a mentee only when the mentee is in a cohort actively assigned to that mentor.
- Public repository activity can be polled without a mentee/mentor personal access token; private activity is available only when the GitHub App is installed by the repository owner and granted repository access.
- OAuth state is validated.
- Webhook signature verification works.
- Duplicate delivery is idempotent.
- Supported events normalize into activity.
- Activity attribution uses stable provider identity.
- A member sees GitHub activity only for repositories they selected in the current organization.
- UI shows sync health and permission limitations.
- Without credentials, development fixture mode is clearly labeled.

## 6. Shared community
- Cohort-shared activity is visible to cohort members.
- Private reports and private feedback never appear in shared feed.
- User cannot access a different cohort's discussions without membership.
- Observer role cannot select repositories or read member-level evidence.
- Moderation/reporting flow works if included.

## 7. UI quality
- All primary navigation routes load.
- All primary buttons perform real actions.
- Forms validate and show errors.
- Loading, empty, success and failure states exist.
- Light and dark themes persist.
- Desktop, tablet and mobile layouts are usable.
- Keyboard navigation and focus indicators work.

## 8. Analytics
- Dashboard metrics are database-backed.
- Date filters affect all relevant widgets.
- Metric definitions are visible or documented.
- Empty datasets show useful empty states.
- Counts are consistent with source records.

## 9. Automated checks
Run:
- formatter
- linter
- TypeScript typecheck
- unit tests for domain services and policies
- integration tests for critical API flows
- authorization/tenant isolation tests
- production build

## 10. Required test personas/seed data
Seed a local demo organization with:
- 1 organization admin
- 2 mentors
- 8 mentees across 2 cohorts
- several daily reports with varied statuses
- tasks in multiple states
- GitHub fixture activity clearly labeled as demo data
- announcements and events

Use non-real names/emails and development-only credentials. Document seed login details only for local development.
