# OpenSourceHQ Deployment Compatibility Audit

**Inspection Timestamp:** 2026-11-24T21:21:50Z  
**Codebase Audited:** `/Users/sohamdhande/Docs_Local/OpenSourceHQ` (read-only)

---

## 1. Runtime & Build Requirements (Verified from Source)

| Requirement | Verified Value | Cluster Compatibility (`nst-n1`) |
| :--- | :--- | :--- |
| **Runtime** | Node.js `v22.x` (`@types/node ^22.9.0`) | Compatible (`node v22.22.1` installed on `nst-n1`; containers can use `node:22-alpine` / `node:22-slim`) |
| **Package Manager** | `pnpm` (project uses `pnpm-lock.yaml`; not installed globally on `nst-n1` host) | Use Corepack (`corepack enable`) or container build stage |
| **Framework** | Next.js `^14.2.18` (`react ^18.3.1`) | Compatible (`next build` + `next start`) |
| **ORM & Database** | Prisma `^5.22.0` targeting PostgreSQL (`prisma migrate deploy`) | Compatible with `postgresql@18-main` (`18.6`) |
| **Required Env Vars (Names Only)** | `NODE_ENV`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `CRON_SECRET`, optional `EMAIL_FROM`, `EMAIL_PROVIDER_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Must be injected via K8s `Secret` or root-owned `chmod 600` systemd `EnvironmentFile` |

---

## 2. Multi-Replica, Proxy, and Filesystem Assessment

| Architectural Check | Finding | Confidence | Source Evidence |
| :--- | :--- | :--- | :--- |
| **Session Storage** | Stateless HMAC-SHA256 signed JWT cookie (`oshq_session`, 7-day TTL) signed with `AUTH_SECRET` — **multi-replica safe** | VERIFIED | `src/server/auth/session.ts` |
| **In-Memory State** | `installationTokenCache = new Map(...)` in `github-app-service.ts` caches short-lived GitHub App installation tokens per process — **multi-replica safe** | VERIFIED | `src/features/github/github-app-service.ts` |
| **Local Filesystem Uploads** | No local file upload endpoints (`writeFile`/`mkdir` unused in `src/`); deliverable links use external URLs — **no shared RWX PVC needed** | VERIFIED | `grep` across `src/` |
| **Local `.certs` Dependency** | `.certs/opensourcesoham.private-key.pem` fallback is strictly gated behind `NODE_ENV !== "production"`; production reads `GITHUB_APP_PRIVATE_KEY` | VERIFIED | `src/features/github/github-auth-service.ts` |
| **`localhost` Assumptions** | `NEXT_PUBLIC_APP_URL` and `GITHUB_CALLBACK_URL` default to `http://localhost:3000` if unset; in `NODE_ENV=production`, `getAppBaseUrl()` and `getCallbackUrl()` enforce `https://` and exact `/api/auth/github/callback` path | VERIFIED | `src/features/github/github-auth-service.ts` |
| **Background Sync / Cron** | `/api/cron/github-sync` (`GET`, protected by `Bearer ${CRON_SECRET}`) polls up to 6 public repos per run (30-min cadence) | VERIFIED | `src/app/api/cron/github-sync/route.ts` |
| **Docker Standalone Build** | `next.config.mjs` does **not** currently set `output: "standalone"` | VERIFIED | `next.config.mjs` |

---

## 3. Compatibility Verdict & Minimal Code/Config Changes Needed

- **Can run with 1 replica:** Yes (host systemd or K3s Deployment).
- **Can run with multiple replicas:** Yes — sessions are stateless JWTs, GitHub App tokens are safely per-process cached, and webhook deliveries are idempotent via `WebhookDelivery.deliveryId` in PostgreSQL.
- **Behind reverse proxy (`cloudflared` + Nginx / Traefik):** Yes, provided `X-Forwarded-Proto: https` and `Host: org.nstsdc.org` are forwarded and `NEXT_PUBLIC_APP_URL=https://org.nstsdc.org`.
- **Recommended minor code/packaging addition (for K3s containerization):** Add `output: "standalone"` to `next.config.mjs` (plus a `Dockerfile`) and add a Kubernetes `CronJob` (or systemd timer) calling `/api/cron/github-sync` every 30 minutes with `CRON_SECRET`.

