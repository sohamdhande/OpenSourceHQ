# Database Readiness Report — OpenSourceHQ Audit

**Inspection Timestamp:** 2026-11-24T21:21:50Z  
**Database Required by OpenSourceHQ:** PostgreSQL (Prisma ORM `^5.22.0`)

---

## 1. PostgreSQL Discovery Findings

| Attribute | Observed State | Confidence | Evidence |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Installed** | Yes — `psql (PostgreSQL) 18.6` (`postgresql@18-main.service` active & enabled); `/etc/postgresql/17` config dir also present | VERIFIED | `psql --version`, `systemctl`, `ls /etc/postgresql` |
| **Listen Address & Port** | `127.0.0.1:5432` (loopback only, accepting connections) | VERIFIED | `ss -tuln`, `pg_isready -h 127.0.0.1 -p 5432` |
| **Managed Service?** | No — self-hosted Debian/Ubuntu `postgresql@18-main` on `nst-n1` local NVMe (`/var/lib/postgresql`) | VERIFIED | `systemctl`, `df -hT` |
| **Configured `max_connections`** | `100` | VERIFIED | `/etc/postgresql/18/main/postgresql.conf` |
| **Configured `shared_buffers`** | `128MB` (default; under-tuned for 14 GiB RAM host) | VERIFIED | `/etc/postgresql/18/main/postgresql.conf` |
| **SSL/TLS Support** | `ssl = on` in `postgresql.conf` | VERIFIED | `/etc/postgresql/18/main/postgresql.conf` |
| **WAL Archiving / PITR** | `wal_level` and `archive_mode` are not customized in `postgresql.conf` (default `archive_mode = off`, no PITR WAL archiving configured) | INFERRED | `grep ... postgresql.conf` |
| **Connection Pooling (PgBouncer)** | Not installed on host (`command -v pgbouncer` absent) | VERIFIED | Binary scan |
| **Auth Rules (`pg_hba.conf`) & Existing DBs** | Unreadable (`Permission denied` for user `soham`; no DB credentials provided or probed) | BLOCKED | `grep ... pg_hba.conf` |
| **Replication / Standby** | No standby database or streaming replication detected on `nst-n1`; external nodes `UNKNOWN` | UNKNOWN | Single-host observation |

---

## 2. Capacity & Sharing Risks

1. **Shared Host Contention:** `nst-n1` runs `k3s-server` (19.1% RAM), `mysqld`, `mongod`, `ollama`, and `postgresql@18-main` on a single `14 GiB` RAM / `233 GB` NVMe host.
2. **Loopback-Only Binding (`127.0.0.1:5432`):** If OpenSourceHQ is deployed inside K3s pods (even on `nst-n1`), pods cannot reach `127.0.0.1:5432` directly without either:
   - Deploying OpenSourceHQ as a host-level systemd service, **or**
   - Running a dedicated PostgreSQL StatefulSet inside K3s with a PersistentVolumeClaim, **or**
   - Binding host PostgreSQL to the CNI/LAN interface with strict `pg_hba.conf` + `ufw` + TLS rules.
3. **Default `shared_buffers = 128MB` & No Connection Pooler:** Multiple Next.js replicas + background workers could exhaust `max_connections = 100` under load if Prisma connection limits or PgBouncer are not configured.

---

## 3. Recommended PostgreSQL Architecture

- **Short-Term (Single-Node / Pilot):** Provision a dedicated `opensourcehq` database and least-privilege `opensourcehq_app` role on `postgresql@18-main` (with `shared_buffers` tuned to `1GB–2GB` if RAM permits, `sslmode=require`, and `connection_limit=15` in `DATABASE_URL`).
- **Production / Multi-Node K3s:** Run a dedicated PostgreSQL instance (or CloudNativePG / Bitnami PostgreSQL StatefulSet with a replicated/backed-up PVC) paired with **PgBouncer** transaction pooling (`max_connections` protected) and automated `pg_dump` + WAL archiving to off-node storage.

