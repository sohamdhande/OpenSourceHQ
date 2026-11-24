# Environment and local setup

Copy `.env.example` to `.env`, then provide a PostgreSQL database and locally generated secrets. Do not commit `.env`, PEM files, or real credentials. `.env.production.example` is a template only; production credentials belong in the hosting provider's encrypted secret manager.

## Required local variables

- `DATABASE_URL`, `DIRECT_URL`: PostgreSQL connection strings.
- `NEXT_PUBLIC_APP_URL`: local origin, normally `http://localhost:3000`.
- `AUTH_SECRET`: random signing secret of at least 32 characters.
- `APP_ENCRYPTION_KEY`: separate random encryption secret of at least 32 characters.

## GitHub variables

- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`: GitHub App user-authorization credentials.
- `GITHUB_CALLBACK_URL`: exact callback URL for the current environment.
- `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`: server-side GitHub App credentials.
- `GITHUB_WEBHOOK_SECRET`: required to accept GitHub webhooks.
- `GITHUB_APP_PRIVATE_KEY_PATH`: optional local-only path if the private key is not stored directly in the environment.

Local defaults are documented in `.env.example`. Production values for `https://org.nstsdc.org` are documented in `.env.production.example` and `docs/GITHUB_APP_SETUP.md`.

## Local commands

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

For this repository, `prisma/schema.prisma` is the schema source of truth. Run `pnpm db:push` after pulling schema changes. Production database migration strategy should be established before first production release; do not use `db push` against a live production database without reviewing the planned schema diff and backup.

## Verification commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

GitHub OAuth cannot be fully exercised without a registered GitHub App and valid credentials. A working local web server proves only that the app starts; a live callback round-trip and App installation need to be tested separately.
