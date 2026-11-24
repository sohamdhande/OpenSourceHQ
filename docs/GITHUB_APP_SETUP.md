# GitHub App setup for OpenSourceHQ

This guide configures one GitHub App for both GitHub sign-in and centrally managed repository access. Mentees do not create or share personal access tokens.

## App registration

Create the app at <https://github.com/settings/apps/new> and use:

- App name: `OpenSourceHQ` (or your chosen available name)
- Homepage URL: `https://org.nstsdc.org`
- Setup URL: `https://org.nstsdc.org/api/auth/github/installation`
- Webhook URL: `https://org.nstsdc.org/api/webhooks/github`
- Webhook active: enabled
- Install on: any account, if appropriate for your organization model
- User authorization callback URLs:
  - `http://localhost:3000/api/auth/github/callback`
  - `https://org.nstsdc.org/api/auth/github/callback`

GitHub permits multiple callback URLs for a GitHub App. OpenSourceHQ sets `redirect_uri` explicitly, so local development and production select the matching registered URL. The callback URL and Setup URL are separate settings. The production Setup URL is `https://org.nstsdc.org/api/auth/github/installation`; for local installation testing, temporarily change that single Setup URL or use a secure development tunnel.

Important: leave **Request user authorization (OAuth) during installation** disabled for this configuration. OpenSourceHQ starts user sign-in from its own login button and uses the separate Setup URL to bind a GitHub installation to an OpenSourceHQ organization. GitHub does not allow a separate Setup URL when on-install OAuth authorization is enabled ([GitHub App registration settings](https://docs.github.com/en/apps/maintaining-github-apps/modifying-a-github-app-registration#requesting-user-authorization-oauth-during-installation)).

## Minimum permissions

Set only the permissions required by the enabled features. A reasonable initial read-only configuration is:

- Repository permissions: Metadata — read-only (required)
- Repository permissions: Contents — read-only
- Repository permissions: Pull requests — read-only
- Repository permissions: Issues — read-only
- Account permissions: Email addresses — read-only, for verified-email invitation matching

Select the webhook events that the product consumes:

- `push`
- `pull_request`
- `pull_request_review`
- `issues`
- `issue_comment`
- `installation`
- `release`

If permissions or subscribed events change after installation, review and approve the permission update in the GitHub account where the App is installed.

## Credentials and environment

Generate a private key from the GitHub App settings. Store it securely. Configure these values in the local `.env` file or, for production, in the hosting platform's secret manager:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_APP_ID=...
GITHUB_APP_SLUG=...
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\\n...\\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=...
```

The webhook secret must be the exact value configured in GitHub. Do not commit `.env`, private-key files, or populated credential files. The app's private key is used only on the server to sign short-lived App JWTs; installation access tokens are generated server-side and are not exposed to students.

Local callback settings:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
```

Production callback settings:

```env
NEXT_PUBLIC_APP_URL=https://org.nstsdc.org
GITHUB_CALLBACK_URL=https://org.nstsdc.org/api/auth/github/callback
```

For production, the domain must resolve to the deployed application and have a valid HTTPS certificate before testing the production callbacks. Do not set production environment variables while the domain still points nowhere.

## Install the App for an OpenSourceHQ organization

1. Sign in to OpenSourceHQ as an organization administrator.
2. Open `/org/{orgSlug}/admin/integrations/github`.
3. Select `Install GitHub App`.
4. Choose the GitHub organization/account and repository access scope in GitHub.
5. GitHub redirects to OpenSourceHQ's installation callback, which verifies the installation and stores its ID against the selected OpenSourceHQ organization.
6. Confirm the installation account and ID are shown in the integration page.

The GitHub App must be installed on the GitHub organization or account that owns the repositories OpenSourceHQ needs to access. Public repository visibility alone does not grant access to private repositories.

## Verification and troubleshooting

- If sign-in returns to `/login?error=invalid_oauth_session`, restart the flow; the short-lived state/PKCE cookies may have expired or been blocked.
- If invite acceptance fails, verify that the app has read access to email addresses and that the GitHub email is verified.
- If App installation fails, confirm `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, and the Setup URL.
- If webhook deliveries return `503`, set `GITHUB_WEBHOOK_SECRET` to the exact value configured in GitHub.
- If production OAuth fails, verify the registered callback URL exactly matches the `GITHUB_CALLBACK_URL` environment variable, including scheme, hostname, path, and absence of query parameters.
- An app installation token expires after about one hour. OpenSourceHQ mints a replacement from the App private key; users should not be asked for a PAT.
