# Capacity Planning & Resource Estimation — OpenSourceHQ

**Inspection Timestamp:** 2026-11-24T21:21:50Z  
**Baseline Host (`nst-n1`):** 8 logical CPUs (i7-7700), 14 GiB RAM (`9.5 GiB` available), 124 GiB free NVMe.  
*Note: Multi-node K3s worker capacity is `BLOCKED` (`kubectl` unauthorized); estimates below assume deployment on `nst-n1` or equivalent K3s worker capacity.*

---

## 1. Per-Component Baseline Allocation

| Component | CPU Request / Limit | Memory Request / Limit | Storage |
| :--- | :--- | :--- | :--- |
| **OpenSourceHQ Next.js App (1–2 replicas)** | `250m` req / `1000m` limit each | `512 MiB` req / `1 GiB` limit each | Ephemeral (~1 GiB image) |
| **PostgreSQL 18 (dedicated DB)** | `250m` req / `1000m` limit | `512 MiB` req / `2 GiB` limit (`shared_buffers` 512MB–1GB) | `10 GiB` initial (`+2–5 GiB/yr`) |
| **Cron / Sync Trigger (`/api/cron/github-sync`)** | `50m` | `64 MiB` (lightweight `curl` CronJob) | None |
| **Backup Storage (Off-Site)** | Minimal | Minimal | `30–50 GiB` (daily dumps + 7d WAL + monthly) |

---

## 2. Scaling Estimates by User Tier (Estimates, Not Guarantees)

| Tier | Concurrent Active Users | App Replicas | Est. App CPU / RAM | Est. DB RAM / Connections | Bottleneck / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **100 Users (Pilot)** | ~10–20 concurrent | 1 replica (or 2 for zero-downtime) | `0.5 vCPU` / `512 MiB–1 GiB` | `512 MiB–1 GiB` / `< 20` conns | Easily fits in `9.5 GiB` available RAM on `nst-n1`. |
| **500 Users (Campus Scale)** | ~50–100 concurrent | 2 replicas | `1.5–2 vCPU` / `1.5–2 GiB` | `1.5–2 GiB` / `30–50` conns | Requires `shared_buffers` tuning & PgBouncer or Prisma `connection_limit` to stay below `max_connections=100`. |
| **2,000 Users (Multi-Org)** | ~200–350 concurrent | 3–4 replicas | `3–4 vCPU` / `3–4 GiB` | `3–4 GiB` / `80+` conns | **Will saturate `nst-n1`** alongside `k3s-server`, `mysqld`, `mongod`, and `ollama`. Requires dedicated K3s worker nodes and PgBouncer. |

