# OpenSourceHQ workspace rules

- Follow `AGENTS.md`, `GEMINI.md` and all `docs/` specifications.
- Treat `docs/PRD.md` as the product contract.
- Do not implement AI, LLM, embeddings, agents, vector database or AI chat in this release.
- Use Next.js App Router, TypeScript strict mode, PostgreSQL and Prisma unless the existing workspace has a justified compatible setup.
- All protected data access must be authorized server-side and tenant-scoped.
- Use GitHub App/webhook integration through a dedicated adapter and service layer.
- Do not fabricate external API success when credentials are absent.
- Build complete workflows, not static mockups.
- Run lint, typecheck, tests and build before declaring completion.
