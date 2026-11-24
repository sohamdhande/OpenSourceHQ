# Security, Privacy and Compliance Requirements

## 1. Authentication
- Use secure, httpOnly, sameSite cookies through a maintained auth library.
- Require verified email for invited organization accounts.
- Rate-limit login, password reset and invitation endpoints.
- Use strong password hashing if credentials are stored.
- Support session revocation and sign out.
- Never store plaintext passwords.

## 2. Authorization
- Server-side authorization on every query and mutation.
- Organization membership and role must be verified for every tenant-scoped request.
- Mentor scope limited to assigned cohorts/mentees.
- Mentee scope limited to self plus explicitly shared cohort data.
- Observer scope read-only and explicit.
- Platform super-admin separated from organization roles.
- Avoid insecure direct object references (IDOR).

## 3. Multi-tenant isolation
- Include tenant scope in repository/service methods.
- Do not rely on client-provided organization IDs.
- Consider PostgreSQL RLS as defense in depth, but application authorization remains mandatory.
- Add automated tests attempting cross-tenant reads and writes.
- Cache keys must include organization and user scope where relevant.

## 4. Privacy
- Collect only necessary data.
- Private report and feedback visibility enforced server-side.
- Cohort feed must use an explicit allowlist of shareable event fields.
- Never display email addresses, auth data, tokens or private notes to other students.
- Provide account export/deletion process appropriate to retention needs.
- Define organization-level retention settings carefully.

## 5. GitHub secrets
- Encrypt OAuth tokens and app credentials at rest.
- Keep encryption keys in a production secret manager.
- Redact tokens from logs and error reports.
- Support disconnect/revocation.
- Use least-privilege GitHub App permissions.
- Verify webhook signatures against raw body.
- Protect OAuth state against CSRF.

## 6. Input and output
- Validate all input with Zod or equivalent.
- Sanitize rich text/Markdown before rendering.
- Restrict attachment types and size.
- Validate external URLs and avoid server-side request forgery.
- Use parameterized ORM queries.
- Add CSRF protections as appropriate to auth/action model.
- Set secure headers and content security policy where practical.

## 7. Audit and monitoring
- Append-only audit logs for sensitive actions.
- Structured logs with correlation IDs.
- Never log passwords, cookies, access tokens, private report text or full webhook secrets.
- Monitor failed login spikes, webhook failures and authorization denials.

## 8. Minimum release security tests
- Mentee A cannot access Mentee B private report.
- Mentee cannot change own role.
- Mentor cannot access unassigned cohort.
- Organization A user cannot access Organization B records by changing URL/ID.
- Observer cannot mutate.
- Invalid GitHub webhook signature rejected.
- Duplicate webhook delivery does not duplicate activity.
- Disconnected GitHub account no longer uses stored credentials.
