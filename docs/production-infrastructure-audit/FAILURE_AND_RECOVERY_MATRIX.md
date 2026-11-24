# Failure and Recovery Matrix — OpenSourceHQ

**Inspection Timestamp:** 2026-11-24T21:21:50Z

| # | Failure Scenario | Detection Method | Expected Impact | Recovery Mechanism | Human Intervention? | Missing Infrastructure Capability |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **One app container crashes** | K3s liveness/readiness probe (`kubectl` / `systemd` restart) | Brief 502 if 1 replica; zero downtime if 2+ replicas | Automatic container/service restart | Only if crash-looping | Automated alerting on pod restarts (`CrashLoopBackOff`) |
| 2 | **Cron / GitHub sync job fails** | HTTP non-200 from `/api/cron/github-sync` | Public repo polling pauses; webhooks still arrive | Next 30-min scheduled run retries automatically | Check `CRON_SECRET` or GitHub rate-limit errors | Cron failure alerting hook |
| 3 | **PostgreSQL becomes unavailable** | `pg_isready` failure, HTTP 500 across app routes | Full application outage (auth + all DB queries fail) | Restart `postgresql@18-main` or failover DB pod | Required if disk full or service crashed | DB uptime alert + standby replica |
| 4 | **Node `nst-n1` goes offline** | Cloudflare Tunnel disconnect / external uptime monitor | **Total outage** (single `cloudflared`, Nginx, and local PG18 live on `nst-n1`) | Restore node hardware or fail over `cloudflared` + DB to another K3s node | High (manual unless HA tunnel + replicated DB exist) | Multi-node HA for `cloudflared` & PostgreSQL |
| 5 | **Persistent volume unavailable** | K3s `FailedMount` event / DB read-only error | DB/app cannot start or write | Reattach/repair volume or restore from backup | Yes | K3s StorageClass details currently `BLOCKED` |
| 6 | **Disk space reaches 100% (`nst-n1`)** | `atop`/`pmie`/SMART alert; PG refuses writes | DB corruption risk / total write failure | Prune logs/old images (`containerd`), expand disk | Yes | Automated disk-usage threshold alert (`>80%`) |
| 7 | **GitHub API unavailable** | Non-2xx responses in `github-service` / `public-repository-sync` | OAuth login & repo sync fail; core portal (reports, tasks) stays up | Automatic recovery when GitHub returns; webhooks queued by GitHub | None unless prolonged | External status visibility |
| 8 | **GitHub rate limits reached** | `403`/`429` from `api.github.com` | Public repo polling pauses | Exponential backoff / next hourly window; use GitHub App installation tokens | Ensure GitHub App credentials are configured | Rate-limit metric dashboard |
| 9 | **TLS certificates expire** | Cloudflare Edge cert monitor / browser TLS error | Users blocked by HTTPS warning; webhooks fail | Cloudflare auto-renews Edge certs; `certbot.timer` handles local certs | Verify Cloudflare DNS/SSL status | Cert expiry alerting |
| 10 | **Campus internet connectivity lost** | `cloudflared` disconnects; external uptime alert | `org.nstsdc.org` returns Cloudflare 502/530; local LAN unaffected | `cloudflared` auto-reconnects when WAN returns | Campus ISP / IT team | Redundant WAN (campus dependency) |
| 11 | **Entire cluster unavailable** | External uptime monitor down | Complete outage | Rebuild on fresh host/cloud using IaC + off-site DB backup | High | Off-site encrypted backups + documented DR runbook |
| 12 | **Primary database corrupted** | Prisma query errors / PG checksum errors | Data loss or service failure | Stop writes, `pg_restore` latest daily dump + replay WAL to pre-corruption timestamp | High | **WAL archiving & automated backups currently missing** |
| 13 | **Breaking deployment bug** | HTTP 5xx spike / failed smoke test | Broken route or UI | `kubectl rollout undo` (K3s) or revert release tag | Low (developer rollback) | Automated post-deploy smoke test & alerting |
| 14 | **Backup storage unavailable** | Backup job exit code != 0 | RPO degrades until restored | Re-authenticate/restore target storage (`rclone`/S3) | Medium | Verified off-site backup target + failure alert |

