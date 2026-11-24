# OpenSourceHQ testing and verification status

This document describes the tests present in the source tree and the checks actually run in the current isolated sandbox. It does not present historical Antigravity output as a current test result.

## Test files present

- `tests/date-formatting.test.ts` — deterministic date formatting.
- `tests/encryption.test.ts` — AES-256-GCM token encryption/decryption behavior.
- `tests/feedback-response.test.ts` — acknowledgment-only feedback and bounded written responses.
- `tests/github-app.test.ts` — GitHub App JWT/signing helpers.
- `tests/github-auth.test.ts` — OAuth state, PKCE and callback behavior.
- `tests/github-webhook.test.ts` — webhook signature and delivery handling.
- `tests/policies.test.ts` — centralized role and report visibility policy.
- `tests/repository-reference.test.ts` — repository reference parsing and rejection of unsafe inputs.
- `tests/timezone.test.ts` — timezone date keys and daylight-saving conversion behavior.
- `tests/workflows.test.ts` — database-backed critical workflow integration tests.

## Current sandbox checks

| Check | Current result |
|---|---|
| TypeScript/TSX syntax parse | 154 files parsed after the latest changes, zero syntax diagnostics. |
| Internal import path scan | All 154 TypeScript/TSX files scanned, zero unresolved internal imports. |
| Pure repository-reference helper cases | Passed manually: valid OpenMRS/Sugar Labs references and malicious/invalid URLs. |
| Pure timezone helper cases | Passed manually: Asia/Kolkata date boundary, local-to-UTC conversion and daylight-saving gap rejection. |
| `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` | Not executable in this sandbox because dependencies are not installed and package registry access is unavailable. |
| Prisma generation/schema validation/migrations | Not run; no installed Prisma CLI/client or configured PostgreSQL database is available. |
| Live GitHub OAuth/App installation/webhooks/API polling | Not run; requires externally registered GitHub App credentials and deployed callback/webhook URLs. |

The repository includes integration tests, but their presence is not proof that they pass. The test suite must be executed in an environment with dependencies and a disposable PostgreSQL database before deployment.

## Required verification before release

Run in a provisioned environment:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Run database-backed integration tests only against a dedicated test database. Validate incremental migrations on a copy of the current production schema before applying them to production. Then test GitHub user sign-in, App installation, repository access, webhook deliveries, public repository polling, and the production callback over HTTPS.

## Known limits

- Public GitHub repository activity is polled on a bounded schedule; it is not real-time webhook data unless the repository owner installs and authorizes the GitHub App.
- Public API rate limits can delay discovery and sync. Private repository activity requires explicit GitHub App installation permission.
- The migrations are incremental migrations for the earlier OpenSourceHQ schema, not an empty-database baseline.
