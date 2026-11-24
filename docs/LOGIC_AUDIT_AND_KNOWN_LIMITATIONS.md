# OpenSourceHQ logic audit and known limitations

This record describes the repairs made in the sandbox source. It is not a claim that the deployed production site or a live database has been tested.

## Repaired behavior

- Member repository choice is separated from the organization's shared repository catalogue. A mentee or mentor may choose any public GitHub repository by search, `owner/repository`, or URL. OpenMRS and Sugar Labs are included as discovery shortcuts.
- Mentors can choose repositories for their own workspace and assign a repository to a mentee only when the mentee is in one of the mentor's active assigned cohorts. Administrators can assign to active mentees in their organization.
- Repository identities are unique per organization, member selections are unique per organization/member/repository, and primary selections are protected by a PostgreSQL partial unique index plus serializable writes.
- Public repositories are polled through GitHub's public API; private repositories are accessed only with an installation token from an authorized GitHub App installation. No mentee or mentor personal access token is required.
- Public GitHub commit activity identifiers are repository-scoped so a shared commit SHA in two repositories cannot collide within one tenant.
- Linked blockers are idempotent by source record. Database uniqueness protects concurrent report/task submissions; a resolved linked blocker is reopened if its source is resubmitted as an active blocker.
- Daily report save/review transitions are serialized and use guarded state updates so a concurrent save cannot silently overwrite a mentor review.
- Member removal and role demotion protect the final active organization administrator and use serializable transactions.
- Role and organization scoping was tightened for mentor cohorts, mentee profile dossiers, events, reports, tasks, announcements, observer endpoints, and member-directory data. Server-to-client user projections omit password hashes and encrypted GitHub credentials.
- Obsolete repository-assignment handlers were removed from the mentee profile. The mentor, mentee, and mentor-managed mentee screens use the same repository selector.
- Shared form fields now generate IDs and connect error messages; navigation links have names/current-page state; the workspace command dialog handles focus; the shell has a skip link.

## Repository behavior and limits

- Any public repository on GitHub can be selected. Discovery queries use GitHub's public repository search. A direct public repository URL is resolved through GitHub's repository endpoint.
- A private repository can be selected only if the GitHub App is installed on the owning GitHub account and has access to that repository. Installing the App only on `nstsdc` does not grant access to private repositories owned by `openmrs`, `sugarlabs`, or another account.
- Public repository snapshots are polled, not delivered as real-time webhooks. The scheduled job currently processes a bounded number of repositories per run to reduce unauthenticated API-rate-limit use; large programs need a durable queue and authenticated rate-limit strategy.
- The polling snapshot reads only a recent window of commits, pull requests, and issues. It does not reconstruct a complete historic contribution stream. It can attribute activity only when the GitHub identity is linked to a member account.
- GitHub search and public API rate limits may delay results. The UI must surface a rate-limit response instead of claiming sync succeeded.

## Migration notes

- The `prisma/migrations` directory contains incremental PostgreSQL migrations for an existing database with the earlier OpenSourceHQ schema. It is not a generated baseline for an empty database.
- The partial unique index for a single primary member repository is authored directly in SQL because Prisma's schema syntax does not express this partial-index predicate. Do not remove that index from the live database.
- Before production migration, take a database backup, inspect the current schema, apply the incremental migrations in a staging database, and verify the repository and blocker constraints. Do not blindly run `prisma db push` against production.
- If the current database was previously created with `prisma db push`, migration history must be reconciled deliberately before `prisma migrate deploy`; do not mark migrations applied without confirming the corresponding schema changes already exist.

## Additional logic repairs in the latest sandbox pass

- Learning-path visibility is now enforced in the query: mentees receive organization/cohort learning paths, while mentor-only paths are excluded from the mentee payload.
- Public GitHub polling updates an existing PR/issue activity record when its current upstream state changes, rather than leaving stale state in a prior row.
- GitHub account credentials used for public polling are selected only from active members of the same organization; a revoked user token falls back to anonymous public reads only for HTTP 401.
- Missing upstream activity timestamps are skipped instead of being replaced with the current time.
- Submitted, under-review, resubmitted, and reviewed daily reports are presented as read-only; editable controls are limited to drafts and reports returned for changes.
- Daily-report date selection and labels use the configured organization timezone.
- The student event page reads real event records and RSVP state; it no longer renders the old hard-coded sample meeting.
- Cohort-wide task creation creates real assignments for active mentees, so a visible task always has a submission target.

## Verification status in this sandbox

- Static TypeScript/TSX transpilation and internal path checks are performed in the final handoff report.
- Full dependency-based typecheck, ESLint, Vitest, Prisma client generation, migration execution, integration tests, and production build require the project's dependencies and a PostgreSQL database. Those checks are not represented as passing unless executed successfully.
- GitHub OAuth, App installation, webhooks, actual repository search, and polling require valid externally configured GitHub credentials and are not live-tested by sandbox-only code changes.
