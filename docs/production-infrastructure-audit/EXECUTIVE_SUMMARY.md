# Executive Summary — College Infrastructure Production Readiness

**Date:** 2026-11-25 (2026-11-24T21:21:50Z)  
**Target Application:** OpenSourceHQ (`https://org.nstsdc.org`)

---

## 1. What Exists & What Is Usable

- **Compute (`nst-n1`):** Physical Ubuntu 26.04.1 LTS server (Intel Core i7-7700, 8 threads, 14 GiB RAM with `9.5 GiB` available, 233 GB NVMe with `124 GB` free). Sufficient for a **100–500 user** deployment.
- **Orchestration & Runtime:** K3s `v1.36.5+k3s1`, Helm `v4.0.4`, Node.js `v22.22.1`, and Nginx `1.28.3` are installed and running.
- **Ingress & Domain:** `org.nstsdc.org` already resolves to Cloudflare Edge, and `cloudflared 2026.11.0` is actively running on `nst-n1` (bypassing campus NAT cleanly without opening inbound campus firewall ports).
- **Database:** PostgreSQL `18.6` (`postgresql@18-main`) is active on `127.0.0.1:5432`.
- **Outbound Connectivity:** Verified HTTPS `200` to `api.github.com`, `github.com`, `registry.npmjs.org`, and `ghcr.io`.

---

## 2. What Is Missing / Blocked

- **K3s Cluster Visibility & Namespace Access (`BLOCKED`):** Current user `kubeconfig` is unauthorized; node/worker/PVC capacity across the wider K3s cluster could not be inspected.
- **Routing Rule for `org.nstsdc.org` (`P0`):** `cloudflared` currently returns `404` for `org.nstsdc.org` because it is not yet listed in `/etc/cloudflared/config.yml` or Nginx.
- **Off-Site Database Backups & WAL Archiving (`P0`/`P1`):** No PostgreSQL backup cronjobs or WAL archiving were found; `rclone.service` is running but uninspectable without admin privileges.
- **PostgreSQL Tuning & Connection Pooling (`P1`):** `shared_buffers` is at default `128MB` and no PgBouncer is installed.
- **Monitoring & Alerting (`P1`):** Host metrics (`pmcd`, `atop`) exist, but no external uptime/5xx/DB/backup alerting was verified.

---

## 3. Production Readiness Verdict

**Not yet production-ready as-is, but viable with targeted P0/P1 fixes.** The hardware, Cloudflare Tunnel ingress path, Node 22 runtime, and PostgreSQL 18 foundation are strong for a 100–500 user deployment once **namespace access**, **`org.nstsdc.org` tunnel/proxy routing**, **dedicated DB provisioning**, and **automated off-site encrypted backups** are put in place.

---

## 4. Approvals & Resources Needed from College IT

1. Dedicated K3s namespace (`opensourcehq`) + scoped `kubeconfig` (or dedicated non-root systemd service user + `nginx`/`cloudflared` reload approval).
2. `cloudflared` ingress entry + Nginx/Traefik vhost for `org.nstsdc.org`.
3. Dedicated PostgreSQL database + role (`opensourcehq` / `opensourcehq_app`) with TLS enabled.
4. Off-site S3-compatible bucket or NAS mount + credentials for encrypted daily backups and 15-minute WAL archiving.
5. Confirmation of `ufw` firewall rules blocking external access to DB/cluster ports (`5432`, `3306`, `27017`, `6443`).

