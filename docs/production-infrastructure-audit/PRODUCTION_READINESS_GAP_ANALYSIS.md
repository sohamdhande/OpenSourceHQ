# Production Readiness Gap Analysis — OpenSourceHQ

**Inspection Timestamp:** 2026-11-24T21:21:50Z

---

## P0 — Must Fix Before Any Production Deployment

1. **Cluster Access (`kubectl` Unauthorized):** User `~/.kube/config` is expired/unauthorized and `/etc/rancher/k3s/k3s.yaml` is root-only. College IT must provision a dedicated K3s namespace (`opensourcehq`) and scoped kubeconfig (`RoleBinding`) for deployment and inspection.
2. **Ingress Routing for `org.nstsdc.org`:** `https://org.nstsdc.org` currently hits Cloudflare Tunnel's catch-all `404` rule. Add `org.nstsdc.org` to `/etc/cloudflared/config.yml` and configure Nginx/Traefik reverse proxy with `X-Forwarded-Proto: https`.
3. **Dedicated PostgreSQL Database, Role & Connectivity:** Provision an isolated `opensourcehq` database and least-privilege role on PostgreSQL 18 (or a dedicated K3s PostgreSQL StatefulSet) — and resolve loopback-only `127.0.0.1:5432` reachability if app runs inside K3s pods.
4. **Automated Encrypted Off-Site Backups:** No automated PostgreSQL backup or WAL archiving was found. Implement daily `pg_dump` + off-site encrypted storage before hosting any real data.
5. **Production Secrets & GitHub App Configuration:** Generate production `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `CRON_SECRET`, `GITHUB_WEBHOOK_SECRET`, and configure the GitHub App callback (`https://org.nstsdc.org/api/auth/github/callback`) and webhook (`https://org.nstsdc.org/api/webhooks/github`).

---

## P1 — Must Fix Before Onboarding Real Users

1. **External Uptime & Error Alerting:** Configure external availability monitoring for `https://org.nstsdc.org` and alerts for HTTP 5xx, disk > 80%, and PostgreSQL downtime.
2. **WAL Archiving for 15-Minute RPO:** Enable `archive_mode = on` + `wal_level = replica` pushing WAL segments off-node every 15 minutes, plus weekly automated `pg_restore` verification.
3. **PostgreSQL Tuning & Connection Limits:** Increase `shared_buffers` from `128MB` (default) and configure Prisma `connection_limit` / PgBouncer so shared `max_connections = 100` is never exhausted.
4. **Scheduled Public Repo Sync Job:** Configure a K3s `CronJob` or systemd timer hitting `GET /api/cron/github-sync` every 30 minutes with `Authorization: Bearer $CRON_SECRET`.
5. **Firewall & Port Exposure Audit:** Verify with `sudo ufw status` that PostgreSQL (`5432`), MySQL (`3306`), MongoDB (`27017`), and K3s API (`6443`) are blocked from external networks.

---

## P2 — Important Operational Improvements

1. **Multi-Replica App Deployment + `output: "standalone"`:** Enable `output: "standalone"` in `next.config.mjs` and run 2 Next.js replicas in K3s for zero-downtime rolling updates.
2. **Database & App Metrics Exporters:** Add `postgres_exporter` and Nginx/app structured logging into Prometheus/Grafana (or PCP/Loki).
3. **High-Availability `cloudflared`:** Run a second `cloudflared` replica on another K3s node so `nst-n1` maintenance doesn't sever the Cloudflare Tunnel.

---

## P3 — Future Optimization

1. **Dedicated Database / Compute Node Separation:** Move heavy AI/batch workloads (`ollama`, `judge0`) off the node hosting production PostgreSQL if user count approaches 1,000+.
2. **PgBouncer + Read Replica:** Add PgBouncer transaction pooling and a streaming standby PostgreSQL replica for instant failover.

