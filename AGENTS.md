# AGENTS.md — OpenSourceHQ

## Source of truth
- Product requirements: `docs/PRD.md`
- Architecture: `docs/ARCHITECTURE.md`
- Data model: `docs/DATA_MODEL.md`
- UX and routes: `docs/UX_AND_ROUTES.md`
- API contract: `docs/API_SPEC.md`
- GitHub integration: `docs/GITHUB_INTEGRATION.md`
- Security: `docs/SECURITY.md`
- Test and acceptance criteria: `docs/ACCEPTANCE_AND_TESTING.md`
- Delivery plan: `docs/IMPLEMENTATION_PLAN.md`

Read all of these before implementation. In case of conflict, PRD governs product behavior; Security governs access and data protection.

## Non-negotiable rules
1. No AI functionality in this release.
2. No fake data as the production source of truth.
3. No dead buttons or placeholder routes for primary features.
4. All mutations require server-side authorization and validation.
5. Multi-tenant isolation is mandatory.
6. Use database migrations; do not rely on ad-hoc schema changes.
7. Keep external integrations behind typed adapters.
8. Include tests for permissions and core workflows.
9. Include accessible loading, empty, error and success states.
10. Document all environment variables and local setup.

## Code quality
- TypeScript strict mode.
- Avoid `any`; use explicit types and Zod schemas.
- Keep UI components presentational where practical.
- Put domain logic in feature services, not page components.
- Use transactions for multi-record operations.
- Add pagination to potentially large collections.
- Avoid N+1 queries.
- Use structured logging with sensitive fields redacted.
- Use consistent error handling and user-facing messages.
