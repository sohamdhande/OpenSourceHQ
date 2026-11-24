# OpenSourceHQ — Security Architecture & Access-Control Notes

This file documents the security controls implemented in the source tree. It is not a penetration-test report or a claim that the current deployment has been independently verified. Current executable checks and known limitations are recorded in `docs/TESTING_REPORT.md` and `docs/SANDBOX_WORK_REPORT.md`.

## 1. Tenant isolation and membership checks

Organization-owned operations must verify an active `OrganizationMembership` for the requested organization. Role and cohort authorization are applied server-side; a client-supplied organization ID, cohort ID, mentee ID, or repository ID is not treated as proof of access. Mentors' access to individual mentees is limited to active cohorts assigned to that mentor. Suspended/inactive memberships are rejected by the relevant request policies.

This is implemented across route handlers and shared policies, including `src/server/authorization/policies.ts`, `src/features/repositories/access.ts`, and the scoped report, task, learning, event, blocker, and mentor-dossier queries. The test suite contains policy tests, but the complete suite was not executable in this isolated sandbox because dependencies and PostgreSQL were unavailable.

## 2. Roles and visibility

- Platform super administrators manage platform-level configuration and support operations.
- Organization administrators manage members, invitations, cohorts, repositories, events, announcements, and organization-level reporting.
- Mentors work within active assigned cohorts and see mentee evidence only where the cohort relationship grants access.
- Mentees see their own records and content explicitly shared with their active cohort.
- Observers are read-only and are intended to receive aggregate programme information rather than individual report/evidence payloads.

The API must enforce these rules even when a page or navigation item is hidden. UI-level role checks are not a security boundary.

## 3. Sensitive data

- Password hashes and encrypted GitHub credentials must not be included in server-to-client user projections.
- Feedback `privateNotes` must not be exposed in mentee responses.
- Daily-report visibility is enforced by the report policy and organization/cohort membership.
- Blocker references are validated against the actual source record, owner, and organization before linking.
- Member removal and role changes must preserve final-admin safeguards and clean up incompatible cohort relationships.

## 4. GitHub authentication and repository access

OpenSourceHQ uses GitHub App user authorization for identity and expiring user credentials. GitHub numeric user IDs are used as the durable provider identity; invitation matching requires a GitHub-verified email. Tokens are encrypted at rest using AES-256-GCM and refreshed server-side where refresh credentials are available.

Repository access uses GitHub App installation tokens for private repositories. Public repositories can be discovered and polled through the public GitHub API without a member-created personal access token. Installing the app on one GitHub owner does not grant access to private repositories owned by another organization or user.

The webhook endpoint verifies the `X-Hub-Signature-256` HMAC using constant-time comparison and rejects requests when the secret is missing or the signature is invalid. Delivery IDs are used for webhook idempotency.

## 5. Secrets and deployment

Production secrets belong in the hosting provider's secret manager, not in source control. Do not commit `.env` files, private keys, app secrets, webhook secrets, session secrets, encryption keys, or database credentials. Local private-key file lookup is development-only or must point to an explicitly managed secret mount.

The output ZIP must omit `.env` secrets, `.pem` files, `.certs`, `node_modules`, `.next`, and generated build artifacts.

## 6. Audit trail

Sensitive operations use structured `AuditLog` records with organization, actor, target, action, metadata, and timestamp. Audit metadata must never contain access tokens, refresh tokens, private keys, password hashes, or other authentication secrets.

## 7. Verification boundary

Source-level policy tests exist, but the full test suite, Prisma validation, migration execution, typecheck, lint, production build, dynamic security testing, and live GitHub callback/webhook tests were not run in this sandbox. Before production, run the complete checks in `docs/TESTING_REPORT.md`, review and apply migrations against a staging copy, and perform a dedicated security review of the deployed configuration.
