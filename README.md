# OpenSourceHQ — Product & Build Specification

This package is the canonical product specification and implementation brief for building OpenSourceHQ.

## What this is
OpenSourceHQ is a multi-organization open-source mentorship management platform. It provides:
- Organization administration
- Mentor and cohort management
- Student portals and shared cohort visibility
- Daily progress reports
- Task assignment and review
- GitHub account linking and activity synchronization
- Member-selected repository tracking (mentees and mentors can choose public repositories across GitHub organizations, including OpenMRS and Sugar Labs)
- Feedback, announcements, events and attendance
- Analytics and auditability

**AI is explicitly out of scope for this release.** The architecture must leave clean extension points for future integrations and optional intelligence modules, but must not implement AI, LLM calls, agents, embeddings, vector search or AI UI.

## How to use this package
1. Open this folder as the project workspace in Antigravity.
2. Read `GEMINI.md` and `AGENTS.md`.
3. Read all documents in `docs/`.
4. Use `prompts/BUILD_IN_ONE_GO.md` as the build request.
5. Build and verify the application, not just mock up screens.
6. If requirements conflict, follow `docs/PRD.md`, then `docs/ARCHITECTURE.md`, then this README.

## Canonical decisions
- Product name: OpenSourceHQ (working name; keep branding configurable).
- Product type: responsive web application, SaaS-ready and multi-tenant.
- Architecture: modular monolith.
- Frontend/backend: Next.js App Router + TypeScript.
- Database: PostgreSQL + Prisma.
- Authentication: Auth.js or a comparably secure session-based implementation.
- UI: Tailwind CSS + shadcn/ui or equivalent accessible component system.
- GitHub: GitHub App user authorization for sign-in and GitHub App installations for private repository access. Public repository discovery and polling do not require each member to create a personal access token.
- Background jobs: Inngest or a provider-neutral job interface with a working local implementation.
- Theme: light and dark.
- Roles: platform super admin, organization admin, mentor, mentee, observer/guest.
- Student visibility: shared cohort activity by default for explicitly shareable fields; private fields remain private.
- AI: not included.

## Definition of done
A feature is not done when a page merely renders. It is done when it has:
- A usable responsive UI
- Persisted data and migrations
- Server-side authorization
- Validation and useful error states
- Loading, empty and success states
- Tests for critical logic and permissions
- Documentation where configuration is needed

## Important implementation principle
Do not create fake buttons, dead navigation, hardcoded dashboard metrics or static mock data as the final implementation. Seed data is acceptable for local development, but all primary workflows must use the database and working server actions/API routes.
