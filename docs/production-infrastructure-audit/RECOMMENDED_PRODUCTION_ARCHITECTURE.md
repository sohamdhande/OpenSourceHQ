# Recommended Production Architecture — OpenSourceHQ

**Target Domain:** `https://org.nstsdc.org`  
**Based on Verified Infrastructure:** Bare-metal `nst-n1` (K3s `v1.36.5+k3s1`, Nginx `1.28.3`, `cloudflared 2026.11.0`, PostgreSQL `18.6`)

---

## Architecture Diagram

```mermaid
flowchart LR
    Users["Users (Students, Mentors, Admins)"] -->|HTTPS| CF["Cloudflare Edge (DNS + TLS + WAF)"]
    GitHub["GitHub.com (OAuth + Webhooks + API)"] <-->|HTTPS| CF

    CF -->|Outbound Tunnel| CFD["cloudflared (nst-n1 / K3s)"]
    CFD -->|HTTP :80 + X-Forwarded-Proto| Proxy["Nginx 1.28.3 / K3s Traefik Ingress"]

    subgraph K3s["K3s Cluster (Namespace: opensourcehq)"]
        App1["OpenSourceHQ Next.js App (Replica 1)"]
        App2["OpenSourceHQ Next.js App (Replica 2)"]
        Cron["K3s CronJob (30m GitHub Public Repo Sync)"]
    end

    Proxy --> App1
    Proxy --> App2
    Cron -->|Bearer CRON_SECRET| App1

    App1 <-->|TLS + Scoped Role| PG["PostgreSQL 18 (Dedicated DB + PVC/Host)"]
    App2 <-->|TLS + Scoped Role| PG

    PG -->|Daily pg_dump + 15m WAL| Backup["Off-Site Encrypted Storage (S3 / R2 / NAS)"]
    App1 -->|Outbound HTTPS| GitHub
```

---

## Deployment Method Recommendation

1. **Primary Recommendation (K3s Manifests / Helm in Dedicated Namespace):** Since K3s `v1.36.5+k3s1` and Helm `v4.0.4` are already active, deploy OpenSourceHQ as a **2-replica Kubernetes `Deployment`** in a dedicated `opensourcehq` namespace with a K3s `CronJob` for `/api/cron/github-sync`, backed by a dedicated PostgreSQL instance (either a K3s PostgreSQL StatefulSet or `postgresql@18-main` with CNI access) and routed via `cloudflared` -> Nginx/Traefik.
2. **Fallback (Host-Level Systemd + Node 22):** If K3s namespace access cannot be provisioned quickly by college IT, run OpenSourceHQ directly on `nst-n1` under a dedicated locked-down system user (`opensourcehq`) with `systemd`, `node v22.22.1`, local `postgresql@18-main` (`127.0.0.1:5432`), and `nginx` -> `cloudflared`.

