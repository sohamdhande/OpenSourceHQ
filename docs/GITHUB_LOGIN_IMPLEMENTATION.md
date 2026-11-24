# OpenSourceHQ — GitHub authentication implementation

## Authentication model

OpenSourceHQ uses a GitHub App's user authorization flow for sign-in and account linking. GitHub numeric user IDs are the durable identity key; usernames and email addresses are profile attributes, not identity keys. A separate GitHub App installation flow binds an installation to an OpenSourceHQ organization for server-side repository access.

The user authorization flow does not ask mentees for personal access tokens. The user access token belongs to OpenSourceHQ's GitHub App authorization and is stored encrypted server-side. Organization repository operations use GitHub App installation access tokens, minted by the backend and cached in process memory until shortly before expiry.

## Sign-in flow

1. `GET /api/auth/github` creates a random anti-CSRF state value and an independent PKCE verifier/challenge pair.
2. The signed state and PKCE verifier are held in short-lived, HTTP-only, same-site cookies. Only the state and S256 challenge are sent to GitHub.
3. GitHub redirects to the exact callback configured by `GITHUB_CALLBACK_URL`.
4. `GET /api/auth/github/callback` checks the state cookie, validates its HMAC and expiry, and exchanges the one-time code using the PKCE verifier and the same redirect URI.
5. OpenSourceHQ retrieves the numeric GitHub user ID and the user's verified email addresses. An unverified email is never used to accept an organization invitation.
6. The identity is linked to an existing account or used to accept an unexpired invitation. Suspended and deactivated accounts are rejected.
7. Access and refresh tokens are encrypted at rest. The normal `oshq_session` cookie is issued with the existing server-side session format.

GitHub Apps do not use OAuth App-style runtime scopes. OpenSourceHQ requests only `offline_access` to obtain an expiring user access token and rotating refresh token. Configure the relevant user and repository permissions on the GitHub App itself. For private email retrieval, grant the app the minimum required account permission to read email addresses.

## Token lifecycle

- GitHub App user access tokens expire after approximately eight hours when expiring-token support is enabled.
- Their refresh tokens expire after approximately six months and rotate when used.
- `getFreshGitHubUserAccessToken` refreshes the user token shortly before expiry, encrypts the replacement pair, and updates expiry timestamps.
- Installation access tokens are minted with the App JWT via `POST /app/installations/{installation_id}/access_tokens`, remain server-side, and are cached in memory with a safety margin before expiry.
- If a refresh token expires, is revoked, or cannot be decrypted, the account must reconnect. The application does not silently fall back to a personal access token.

## Organization installation flow

1. An authenticated organization administrator opens Admin → Integrations → GitHub and selects Install/Manage GitHub App.
2. `GET /api/orgs/{orgId}/github/install` verifies the administrator's organization permissions and creates signed, short-lived install state.
3. The browser opens the GitHub App installation page.
4. GitHub returns to `/api/auth/github/installation` with `installation_id`, `setup_action`, and state.
5. OpenSourceHQ verifies the state and current user, then uses an App JWT to retrieve the installation details from GitHub.
6. The installation ID, owning GitHub account, type, and granted permissions are associated with the selected OpenSourceHQ organization.

The GitHub App's Setup URL must point to `/api/auth/github/installation`. The callback URL used for sign-in is a different setting and must point to `/api/auth/github/callback`.

## Environment configuration

Local development uses:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
```

Production uses:

```env
NEXT_PUBLIC_APP_URL=https://org.nstsdc.org
GITHUB_CALLBACK_URL=https://org.nstsdc.org/api/auth/github/callback
```

The GitHub App may have both local and production callback URLs registered. The authorization request explicitly sends the callback matching the current environment. The GitHub App's Setup URL is configured in GitHub App settings as `https://org.nstsdc.org/api/auth/github/installation`; it is not the OAuth callback. There is only one Setup URL per app, so local installation testing needs a secure tunnel or a temporary Setup URL change.

Required server-side GitHub variables:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`
- `GITHUB_APP_ID`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_PRIVATE_KEY` (or `GITHUB_APP_PRIVATE_KEY_PATH` for local development only)
- `GITHUB_WEBHOOK_SECRET`

Never expose any of these values to client-side bundles or logs. In production, put the private key and all secrets in the hosting provider's encrypted secret manager. Do not rely on a developer's local `.certs` directory.

## Security controls

- HMAC-signed anti-CSRF state, ten-minute expiry, HTTP-only cookies, and PKCE S256.
- Exact callback path validation; production callbacks must use HTTPS.
- Internal-path-only post-link redirects to prevent open redirects.
- Verified email required for invite auto-enrollment.
- Numeric GitHub user ID matching; legacy seeded identifiers are supported only as a migration compatibility lookup.
- AES-256-GCM token encryption with a production-required `APP_ENCRYPTION_KEY`.
- Production requires a configured `AUTH_SECRET` of at least 32 characters.
- Webhooks fail closed if `GITHUB_WEBHOOK_SECRET` is absent or signature verification fails.
- Webhook delivery IDs are idempotently recorded and processed.

## Important deployment limitation

The sandbox can validate source code and local configuration templates, but it cannot register or modify a GitHub App, add DNS records, provision a production database, deploy `org.nstsdc.org`, or run a live GitHub authorization without the user's external credentials and infrastructure.
