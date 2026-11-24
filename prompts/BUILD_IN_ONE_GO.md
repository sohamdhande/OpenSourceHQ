# Antigravity Build Prompt — OpenSourceHQ

Act as a senior full-stack engineer, product designer, database architect, security engineer and QA engineer. Build the complete OpenSourceHQ application in this workspace.

You must first read:
- `GEMINI.md`
- `AGENTS.md`
- every document under `docs/`
- this prompt

Then inspect the workspace. Preserve useful existing code if present. If empty, initialize the project.

## Product to build
OpenSourceHQ is a multi-tenant open-source mentorship management web application. It supports multiple organizations, organization admins, mentors, mentees and optional read-only observers. It includes cohort management, student profiles, daily reports, task assignment/review, GitHub integration, repository tracking, learning milestones, feedback, shared cohort community, announcements, events, attendance, notifications, analytics and audit logs.

AI is not part of this release. Do not implement AI, AI chat, LLMs, embeddings, vector search, agents or AI-related UI. Keep provider interfaces and modular boundaries so future integrations can be added cleanly.

## Required technical direction
- Next.js App Router
- TypeScript strict mode
- PostgreSQL
- Prisma
- Auth.js or equivalent secure authentication
- Tailwind CSS and shadcn/ui or equivalent
- Recharts or equivalent for charts
- GitHub App + OAuth integration
- Background job adapter (Inngest or equivalent) with local development support
- Light and dark themes
- Responsive desktop/tablet/mobile web UI

If the repository already uses a compatible stack, preserve it unless it conflicts with security or core requirements.

## Build requirements
1. Implement real authentication, invitations and organization membership.
2. Implement platform role separation and organization-scoped roles.
3. Implement strict tenant isolation and centralized authorization policies.
4. Implement admin, mentor and student navigation and dashboards.
5. Implement organization, member, cohort, mentor assignment and enrollment management.
6. Implement complete daily report create/edit/submit/review/request-changes flow.
7. Implement task create/assign/update/submit/review flow.
8. Implement mentee profiles with Overview, GitHub, Reports, Tasks, Learning, Feedback and Attendance tabs.
9. Implement GitHub identity linking, GitHub App installation records, repository management, verified webhooks, idempotent processing, activity normalization, sync logs and reconciliation job boundary.
10. Implement local GitHub fixture mode only when clearly marked as demo data.
11. Implement learning paths/milestones and mentor feedback with visibility levels.
12. Implement cohort-shared activity feed and discussions with moderation/reporting basics.
13. Implement announcements, events, attendance and in-app notifications.
14. Implement database-backed analytics for admin, mentor and student roles.
15. Implement audit logs for sensitive operations.
16. Implement profile/settings, notification preferences and theme persistence.
17. Implement responsive design and accessible interactions.
18. Add realistic development seed data for two cohorts, two mentors and at least eight mentees.
19. Add `.env.example`, setup documentation, migrations, seed script and tests.
20. Run lint, typecheck, tests and production build; fix failures.

## UI expectations
Create a polished developer-focused SaaS interface, not a generic school portal. Use a consistent app shell with sidebar, top bar, organization switcher, search, notifications, account menu and theme toggle. Include useful charts, activity timelines, searchable tables, filters, pagination, forms, dialogs and status badges. Provide loading, empty, error and success states. Ensure all buttons and links work.

## Security expectations
- No client-side-only authorization.
- No trusting IDs or roles from the browser.
- No cross-tenant access.
- Mentees see only their own private data and explicitly shared cohort data.
- Mentors see assigned cohorts/mentees.
- Organization admins manage their organization.
- Platform super admin is separate.
- GitHub webhook HMAC signature verification.
- Idempotent webhook processing.
- Encrypted tokens and secret redaction.
- Zod validation and safe error messages.
- Audit sensitive actions.

## Completion behavior
Do not stop after scaffolding, planning or building the dashboard. Continue until all core workflows are implemented and verified. If a third-party credential is unavailable, finish the adapter, configuration UI, local fixture mode and exact setup instructions. Do not fake a successful external connection.

At the end:
- Run all project checks.
- Verify a clean database migration and seed.
- Verify core role/tenant tests.
- Write `docs/BUILD_NOTES.md`.
- Provide a concise implementation report with routes, workflows, setup commands, required credentials and any limitations.
