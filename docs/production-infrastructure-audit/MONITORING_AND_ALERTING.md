# Monitoring and Alerting Audit — OpenSourceHQ

**Inspection Timestamp:** 2026-11-24T21:21:50Z

---

## 1. Discovered Monitoring & Logging Stack

| Tool / Daemon | Observed State | Confidence | Evidence |
| :--- | :--- | :--- | :--- |
| **Performance Co-Pilot (`pmcd`, `pmlogger`, `pmproxy`, `pmie`)** | Active & running on `nst-n1` (host-level CPU/RAM/IO metrics & inference engine) | VERIFIED | `systemctl list-units` |
| **Atop (`atop`, `atopacct`)** | Active & running (process accounting & historical resource snapshots) | VERIFIED | `systemctl list-units` |
| **Journald & Rsyslog** | Active & running (`systemd-journald`, `rsyslog`) | VERIFIED | `systemctl list-units` |
| **SMART Disk Monitoring (`smartmontools`)** | Active & running (NVMe hardware health) | VERIFIED | `systemctl list-units` |
| **Kubernetes `metrics-server`** | Running in K3s (`ps` shows `metrics-server` pod process) | VERIFIED | `ps` |
| **Prometheus / Grafana / Alertmanager / Loki** | Not running as host systemd services; presence inside K3s namespaces is `BLOCKED` (`kubectl` unauthorized) | VERIFIED (host) / BLOCKED (K3s) | `systemctl`, `kubectl` |
| **External Uptime / Alerting (Email/Slack/Webhook)** | None verified | UNKNOWN | Host inspection |

---

## 2. Monitoring Coverage Matrix for OpenSourceHQ

| Metric / Signal | Currently Observable? | Recommended Implementation |
| :--- | :--- | :--- |
| **Host CPU / RAM / Disk (`/dev/nvme0n1p2`)** | Yes (`pmcd`, `atop`, `smartmontools`) | Alert when NVMe usage `> 80%` or available RAM `< 1.5 GiB`. |
| **App Availability (`https://org.nstsdc.org`)** | No automated external check verified | Add Uptime Kuma / Cloudflare Health Check / Blackbox Exporter polling `/api/auth/session` or `/login` every 60s. |
| **HTTP 5xx & Latency** | Partial (Nginx access/error logs) | Configure structured JSON Nginx logs + Cloudflare Analytics alerts on 5xx spikes. |
| **PostgreSQL Availability & Connections** | No dedicated exporter on host | Deploy `postgres_exporter` or cron healthcheck (`pg_isready` + `pg_stat_activity` vs `max_connections=100`). |
| **Cron / GitHub Sync Failures** | No alert hook | Monitor `/api/cron/github-sync` HTTP status (`200` vs `500`/`503`) and `WebhookDelivery` `FAILED` rows. |
| **Backup Success / Restore Test** | Missing | Alert on backup job exit code != 0 and weekly `pg_restore` verification. |
| **TLS Certificate Expiry** | Managed by Cloudflare Edge | Enable Cloudflare expiry notifications + monitor `certbot.timer` if origin certs are used. |

