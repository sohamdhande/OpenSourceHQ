# OpenSourceHQ sandbox work report

## Scope and boundary

The source project was repaired in `/mnt/data/OpenSourceHQ-final` only. No GitHub account, GitHub App registration, DNS, deployment, hosting configuration, external service, or production database was modified. The ZIP contains source, documentation, configuration templates, and migrations only; it must not contain real environment files or private keys.

## Repository selection and GitHub activity

- Added member-owned repository selection independent of the organization's shared repository catalogue. Both mentees and mentors can search and choose any public GitHub repository using search terms, `owner/repository`, or a GitHub URL.
- Added OpenMRS, Sugar Labs, and good-first-issue discovery shortcuts. The selected repository belongs to the member within the current organization; another member's selection is not silently changed.
- Mentors can select repositories for their own workspace and can assign repositories to mentees only when the mentee is actively enrolled in a cohort assigned to that mentor. Organization admins can assign to active mentees in their organization.
- Added organization-scoped repository records and member selections, primary-repository handling, conflict handling, audit events, and compatibility mapping for the earlier mentee-repository table.
- Public repository metadata/activity is polled through the GitHub public API without a mentee/mentor-created PAT. Private repositories require an installation of the OpenSourceHQ GitHub App on the repository owner's GitHub account and explicit access to that repository.
- Added bounded scheduled polling, public API 401 fallback to anonymous reads, active-member token selection, missing-timestamp rejection, and activity upserts that update a PR/issue when its state changes.
- The sync surface distinguishes public polling from private installation access. It does not claim public webhooks or complete historical contribution ingestion.

## Authorization, privacy, and data integrity

- Tightened active organization membership checks for tenant APIs and role changes; inactive and suspended memberships are rejected by the relevant routes.
- Limited mentor views and review queues to active assigned cohorts, including mentor dossiers, learning evidence, reports, tasks, blockers, and event attendance.
- Restricted observer views to aggregate/read-only programme information and corrected organization/cohort scope in member-facing pages.
- Validated blocker source references against the actual report/task/milestone/GitHub activity and owner before creating or deduplicating a blocker.
- Made role transitions clean up incompatible cohort enrollment/mentor assignment relationships.
- Preserved final active organization administrator safeguards and used transactions for sensitive role/invitation/repository changes.
- Excluded password hashes and encrypted GitHub token fields from client projections; feedback private notes remain mentor/admin-only.
- Added a mentee visibility filter for learning paths so mentor-only paths are not returned to mentee clients.

## Workflow and product logic

- Daily reports use explicit draft, submit, change-request, resubmission, and review transitions with guarded updates. The daily page is read-only after submit/review and editable only for drafts or returned reports.
- Daily report lookup uses the exact calendar date in the organization's configured IANA timezone; the timezone setting is persisted and used by relevant date/event logic.
- Cohort-wide tasks create real task assignments for each active enrolled mentee, so an actionable task has a valid assignment target.
- Student events are loaded from the event API with current RSVP/attendance state; the old hard-coded sample event was removed.
- Learning paths and milestone evidence are loaded from scoped programme data; a missing route parameter reference was fixed.
- Feedback acknowledgement-only responses are accepted and distinguished from a written response; validation errors and saved states are surfaced.
- Dashboard cohort, blocker, task, and milestone counts are based on live scoped records rather than fixed cohort labels or misleading denominators.
- Mentor notification links use routes that actually exist.

## UI/UX work

The application uses an original OpenSourceHQ design system informed by GitHub Primer, Vercel Geist, Linear's workspace hierarchy, and WCAG 2.2. It applies restrained neutral surfaces, clearer typographic hierarchy, predictable spacing, accessible labels and focus states, keyboard navigation, mobile-friendly controls, progressive disclosure, and explicit empty/loading/error/success states. The shared repository search/selection component is used by mentee, mentor-self, and mentor-managed mentee views. Reference rationale and review checklist are in `docs/UI_UX_REFERENCE_AND_SYSTEM.md`.

## Hydration and dates

- Replaced browser-locale date rendering with deterministic formatters and removed blanket `suppressHydrationWarning` usage.
- Activity-relative timestamps render only after mount; initial output is deterministic.
- Organization-local calendar dates and event times use the saved IANA timezone.

## Validation performed

| Check | Result |
|---|---|
| TypeScript/TSX syntax transpilation | 154 source, test, and Prisma TypeScript files parsed; zero syntax diagnostics. |
| Internal import scan | Zero unresolved `@/` and relative TypeScript/TSX imports. |
| Locale/hydration scan | Zero `toLocaleDateString`/`toLocaleTimeString` calls and zero `suppressHydrationWarning` occurrences under `src`. |
| Repository reference helper cases | Manual helper checks passed for valid OpenMRS/Sugar Labs references and invalid/malicious references. The test file contains five valid examples and twelve rejection cases. |
| Timezone helper cases | Manual checks passed for Asia/Kolkata date boundary, local-to-UTC conversion, daylight-saving gap rejection, and timezone rendering. |

## Not verified in this sandbox

`node_modules` and a configured PostgreSQL database are unavailable. A `tsc --noEmit` attempt could not complete because React, Next.js, Prisma, Node, and other package/type declarations were not installed. The Vitest suite, ESLint, Next production build, Prisma generation/schema validation, migration execution, database-backed integration tests, and live route checks were not run. No claim is made that those checks pass.

GitHub OAuth, refresh-token rotation, GitHub App installation, private repository access, webhook delivery, public API polling against GitHub, DNS/TLS, and production deployment remain untested live integrations because valid external credentials and infrastructure were not provided.

## Before deployment

1. Install dependencies with `pnpm install --frozen-lockfile` in a provisioned environment.
2. Generate Prisma Client and run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
3. Apply reviewed incremental migrations to a staging copy of the existing schema; do not blindly run `prisma db push` against production.
4. Configure GitHub App credentials, local and production callback URLs, the production installation Setup URL, webhook URL, and exact permissions/events.
5. Test public repository search and sync, private repository access using an authorized installation, and webhook signature/idempotency behavior.
6. Deploy `https://org.nstsdc.org` only after schema, credentials, HTTPS callback, and end-to-end role workflows have been verified.
