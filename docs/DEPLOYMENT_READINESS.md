# OpenSourceHQ — deployment readiness

This document separates repository-level checks from environment checks that cannot be completed in a source-only sandbox.

## Production stack

- Next.js 14 App Router, React 18, TypeScript
- PostgreSQL and Prisma
- Cookie-backed `oshq_session`
- AES-256-GCM encryption for server-side GitHub user tokens
- GitHub App user authorization for identity
- GitHub App installation access tokens for organization repositories
- HMAC-SHA256 webhook verification

## Required production environment

Use `.env.production.example` as a key checklist. At minimum configure:

- `NEXT_PUBLIC_APP_URL=https://org.nstsdc.org`
- `AUTH_SECRET` (32+ random characters)
- `APP_ENCRYPTION_KEY` (a different 32+ character random secret)
- `DATABASE_URL` and `DIRECT_URL`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`
- `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`

Do not depend on `.certs` or any developer's laptop filesystem in production. Supply the GitHub App private key through a secret environment variable or a managed secret mount.

## Database schema update

The GitHubAccount model now stores `refreshTokenExpiresAt`. Regenerate Prisma Client and apply the schema change before running the updated application:

```bash
pnpm db:generate
pnpm db:push
```

Review the schema change and take a database backup before applying it to a production database. This project currently has no committed Prisma migration history in the supplied source archive, so do not assume `prisma migrate deploy` will apply the change.

## Local verification checklist

Run in an environment with dependencies and a PostgreSQL database configured:

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm db:generate`
- [ ] `pnpm db:push`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Verify the new GitHub App installation and auth callback routes locally
- [ ] Test hydration with different browser timezones and themes

## External production checks (not executable from this source archive)

- [ ] `org.nstsdc.org` DNS points to the hosting provider
- [ ] TLS certificate is valid
- [ ] Production database is provisioned, backed up, and migrated
- [ ] GitHub App has exact production callback and Setup URLs registered
- [ ] GitHub App is installed on the repository-owning organization/account
- [ ] GitHub webhook URL and secret match the deployed application
- [ ] A real GitHub sign-in completes its production callback round-trip
- [ ] A real installation access token can read the selected repositories
- [ ] Webhook delivery is verified and creates a correctly attributed activity

A passing test suite or a successful local HTTP response does not prove these external integration checks.
