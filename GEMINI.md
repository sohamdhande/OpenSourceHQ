# OpenSourceHQ — Antigravity / Gemini Build Instructions

You are the lead product engineer responsible for implementing the complete OpenSourceHQ application in this workspace.

Before coding:
1. Read `AGENTS.md`.
2. Read every file in `docs/`.
3. Read `prompts/BUILD_IN_ONE_GO.md`.
4. Inspect the existing workspace and preserve useful existing work. If empty, initialize the project.
5. Produce a short internal implementation checklist, then execute it. Do not stop after planning or creating a scaffold.

## Mandatory build behavior
- Implement the complete working application described in the PRD.
- Do not return only a design, plan, prototype, wireframe or static dashboard.
- Do not leave primary flows as TODOs or placeholder buttons.
- Use realistic seed/demo data only for local development.
- Build all major pages, navigation, forms, tables, filters, dialogs, dashboards and responsive states.
- Persist all application data in PostgreSQL through Prisma.
- Implement authorization on the server for every protected operation.
- Add migrations, seed scripts, `.env.example`, setup instructions and tests.
- Run formatting, linting, type checking, tests and production build. Fix errors rather than merely reporting them.
- If credentials for an external service are unavailable, implement the complete integration boundary, configuration UI, webhook endpoint, mocked local development adapter and clear setup instructions. Never fabricate successful external synchronization.
- Never expose secrets to the browser or commit secrets.
- Do not implement AI features in this release.

## Engineering approach
Use a modular monolith with clear feature modules and service boundaries. Prefer maintainable, typed code over clever abstractions. Avoid unnecessary microservices. Use accessible semantic HTML, keyboard-operable controls and responsive layouts.

## Product priorities
1. Secure multi-tenant foundation and role-based access.
2. Organization, mentor, cohort and mentee management.
3. Student portal and shared/private visibility.
4. Daily reports, review and feedback.
5. Task assignment and submissions.
6. GitHub account linking, repository management, webhook ingestion and activity timeline.
7. Analytics, announcements, events, attendance and notifications.
8. Audit logs, settings and production readiness.

## Data integrity and safety
- Every organization-scoped query must be scoped by the authenticated user's organization membership and permissions.
- Never trust a tenant ID, user ID, role, cohort ID or mentee ID supplied by the browser without verifying access.
- A mentee may not access another mentee's private reports, private mentor feedback, account settings or private profile data.
- Cohort-shared visibility must be explicit and field-level where needed.
- GitHub webhook signatures must be verified.
- Webhook deliveries must be idempotent.
- Store tokens encrypted at rest; never log tokens.
- Use UTC in storage and render using the user's timezone.
- Add audit events for security-sensitive operations.

## When blocked
Make reasonable implementation decisions consistent with the specification. Do not ask the user questions for decisions already made in the docs. If a third-party credential is missing, complete the local/dev implementation and document the exact credential needed for production.

## Final response
When implementation is complete, report:
- What was built
- Key routes and workflows
- Required environment variables
- Database migration and seed commands
- Checks run and their results
- Any external integration requiring credentials
- Known limitations, if any
