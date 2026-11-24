# GitHub integration

## Authentication and access model

OpenSourceHQ uses a GitHub App for both user identity authorization and server-to-server repository access. Students do not provide personal access tokens.

- User sign-in and account linking use the GitHub App user authorization flow with HMAC-signed state, PKCE S256, and the `offline_access` scope.
- GitHub numeric user IDs are the durable identity key. Verified email addresses are required for invitation matching; an unverified profile email is never treated as verified.
- The backend stores GitHub user access and rotating refresh tokens encrypted with AES-256-GCM. Refresh occurs server-side shortly before access-token expiry.
- Organization admins install the GitHub App for their organization. OpenSourceHQ verifies the installation with an App JWT and stores the installation ID and granted permissions.
- Repository operations mint short-lived GitHub App installation access tokens on the server. Tokens are cached in process memory only until shortly before expiry; they are not sent to the browser or stored as student credentials.

## Implemented source locations

- `src/features/github/github-auth-service.ts`: user OAuth, PKCE, verified identity resolution, token encryption and refresh.
- `src/features/github/github-app-service.ts`: App JWTs, installation lookup, short-lived installation tokens and signed setup state.
- `src/app/api/auth/github/route.ts`: starts sign-in/account linking.
- `src/app/api/auth/github/callback/route.ts`: handles the user authorization callback.
- `src/app/api/orgs/[orgId]/github/install/route.ts`: starts installation for an authorized organization admin.
- `src/app/api/auth/github/installation/route.ts`: validates and records the installation callback.
- `src/app/api/orgs/[orgId]/repositories/route.ts`: verifies repository visibility through the organization's installation before saving GitHub-sourced repository metadata.
- `src/app/api/webhooks/github/route.ts`: verifies HMAC signatures and records webhook deliveries.

## Callback and setup URLs

For local sign-in:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
```

For production sign-in:

```env
NEXT_PUBLIC_APP_URL=https://org.nstsdc.org
GITHUB_CALLBACK_URL=https://org.nstsdc.org/api/auth/github/callback
```

The `GITHUB_CALLBACK_URL` must be registered as a callback URL in the GitHub App and must use the same origin as `NEXT_PUBLIC_APP_URL`. The authorization request and token exchange both use that exact value. GitHub Apps allow multiple callback URLs, so the local and production callback can both be registered.

The GitHub App's separate Setup URL is:

```text
https://org.nstsdc.org/api/auth/github/installation
```

For a local installation-flow test, temporarily set the GitHub App Setup URL to the localhost callback or use a secure development tunnel; GitHub cannot send a browser back to an unreachable local machine. The user sign-in callback and App Setup URL serve different purposes.

## Required permissions and events

Configure permissions on the GitHub App itself. Do not add OAuth App-style `read:user` or `user:email` scopes. OpenSourceHQ requests `offline_access`; account/repository permissions belong in the GitHub App configuration.

Select the minimum permissions required by enabled features, including account email address read access for verified-email lookup, and repository metadata/content/pull-request/issues access as required by repository tracking. Subscribe to at least `installation`, `push`, `pull_request`, `pull_request_review`, `issues`, `issue_comment`, and `release` events for the corresponding workflows.

Configure the webhook URL as `https://org.nstsdc.org/api/webhooks/github` in production and set the same randomly generated value in `GITHUB_WEBHOOK_SECRET`. The webhook route fails closed when the secret is missing or the HMAC is invalid.

## Environment variables

See `.env.example` and `.env.production.example`. Required server-side values include `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET`, in addition to database connection strings.

Keep private keys, client secrets, webhook secrets, database credentials and encryption keys out of source control and client-side bundles. In production, use the hosting provider's secret manager or a managed secret mount. Do not depend on a developer's local `.certs` directory.

## Important limitations

The repository source can implement and locally test the flow, but it cannot register the GitHub App, configure its permissions or callback URLs, install it on a GitHub organization, create DNS/TLS records, provision PostgreSQL, or deploy `org.nstsdc.org`. Those tasks require access to the external GitHub and hosting accounts.
